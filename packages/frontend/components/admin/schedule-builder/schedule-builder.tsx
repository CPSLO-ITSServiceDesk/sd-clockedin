"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Check, Clock } from "lucide-react"
import { toast } from "sonner"

import { Panel } from "@/components/admin/schedule-builder/builder-ui"
import { ChangeShifts } from "@/components/admin/schedule-builder/change-shifts"
import { SchedulesHome } from "@/components/admin/schedule-builder/schedules-home"
import { CurrentSchedule } from "@/components/admin/schedule-builder/current-schedule"
import { StepGuidelines } from "@/components/admin/schedule-builder/step-guidelines"
import { StepImport } from "@/components/admin/schedule-builder/step-import"
import { StepPublish } from "@/components/admin/schedule-builder/step-publish"
import { StepReview } from "@/components/admin/schedule-builder/step-review"
import { sortTermsByActiveStatus } from "@/components/admin/terms/term-types"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ApiRequestError } from "@/lib/api/client"
import {
  scheduleDraftsApi,
  type AvailabilityImportResult,
  type ChangeLogEntry,
  type DraftPerson,
  type ScheduleDraft,
} from "@/lib/api/schedule-drafts"
import { studentAssistantsApi, type StudentAssistant } from "@/lib/api/student-assistants"
import { termsApi, type Term } from "@/lib/api/terms"
import { queryKeys } from "@/lib/query-keys"
import { GROUP_ORDER } from "@/lib/schedule-builder/model"
import { cn } from "@/lib/utils"

const STEPS = ["Import", "Guidelines", "Review", "Publish"] as const
const AUTOSAVE_MS = 800

export interface BuilderContext {
  draft: ScheduleDraft
  term: Term
  termName: string
  students: Map<number, StudentAssistant>
  /** People sorted by group, then first name. */
  people: DraftPerson[]
  nameOf: (_studentId: number) => string
  edit: (_change: (_draft: ScheduleDraft) => ScheduleDraft) => void
  log: (_text: string, _by?: ChangeLogEntry["by"]) => void
  goTo: (_step: number) => void
  runImport: (_file: File) => Promise<AvailabilityImportResult | null>
  runGenerate: () => Promise<boolean>
  runPublish: () => Promise<boolean>
  /** Wait for pending edits to reach the server. */
  flush: () => Promise<void>
  /** Re-read the draft from the server after a change made there (e.g. a send to Teams). */
  reload: () => Promise<void>
  busy: "import" | "generate" | "publish" | null
}

function errorMessage(err: unknown): string {
  return err instanceof ApiRequestError || err instanceof Error ? err.message : "Something went wrong"
}

export function ScheduleBuilder() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()

  const { data: terms = [], isLoading: termsLoading } = useQuery({
    queryKey: queryKeys.terms.all,
    queryFn: termsApi.list,
  })
  const { data: studentList = [], isLoading: studentsLoading } = useQuery({
    queryKey: queryKeys.students.all,
    queryFn: studentAssistantsApi.list,
  })

  const termParam = Number(searchParams.get("term"))
  // Set together with the working draft when switching terms, so they never disagree for a render.
  const [termChoice, setTermChoice] = useState<number | null>(null)
  const termId =
    termChoice ??
    (Number.isInteger(termParam) && termParam > 0 ? termParam : null) ??
    terms.find((term) => term.is_active)?.id ??
    terms[0]?.id ??
    null
  const term = terms.find((entry) => entry.id === termId)

  const draftQuery = useQuery({
    queryKey: queryKeys.scheduleDrafts.byTerm(termId ?? 0),
    queryFn: () => scheduleDraftsApi.latestForTerm(termId!),
    enabled: termId != null,
    // The working copy below owns the draft once loaded; don't refetch over edits.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })

  const [work, setWork] = useState<ScheduleDraft | null>(null)
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved")
  const [busy, setBusy] = useState<BuilderContext["busy"]>(null)
  const [starting, setStarting] = useState(false)
  /** null = Schedules home (14). */
  const [view, setView] = useState<"home" | "current" | "draft" | "change" | null>(null)

  const workRef = useRef(work)
  workRef.current = work
  const dirty = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveChain = useRef<Promise<void>>(Promise.resolve())

  useEffect(() => {
    const loaded = draftQuery.data
    if (loaded && loaded.academic_term_id === termId && loaded.id !== workRef.current?.id) setWork(loaded)
  }, [draftQuery.data, termId])

  const save = useCallback(() => {
    saveChain.current = saveChain.current.then(async () => {
      const current = workRef.current
      if (!dirty.current || !current) return
      dirty.current = false
      setSaveState("saving")
      try {
        await scheduleDraftsApi.update(current.id, {
          step: current.step,
          rules: current.rules,
          people: current.people,
          unmatched: current.unmatched,
          change_log: current.change_log,
        })
        setSaveState(dirty.current ? "saving" : "saved")
      } catch (err) {
        console.error("Save schedule draft failed:", err)
        dirty.current = true
        setSaveState("error")
      }
    })
    return saveChain.current
  }, [])

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    await save()
  }, [save])

  const edit = useCallback(
    (change: (draft: ScheduleDraft) => ScheduleDraft) => {
      setWork((prev) => (prev ? change(prev) : prev))
      dirty.current = true
      setSaveState("saving")
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => void save(), AUTOSAVE_MS)
    },
    [save],
  )

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty.current) event.preventDefault()
    }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [])

  const log = useCallback(
    (text: string, by: ChangeLogEntry["by"] = "you") =>
      edit((draft) => ({
        ...draft,
        change_log: [...draft.change_log, { at: new Date().toISOString(), by, text }],
      })),
    [edit],
  )

  const replaceWork = (next: ScheduleDraft) => {
    dirty.current = false
    setWork(next)
    setSaveState("saved")
    queryClient.setQueryData(queryKeys.scheduleDrafts.byTerm(next.academic_term_id), next)
  }

  const runServer = async <T,>(
    kind: NonNullable<BuilderContext["busy"]>,
    call: (draftId: number) => Promise<T>,
    pickDraft: (result: T) => ScheduleDraft,
  ): Promise<T | null> => {
    const current = workRef.current
    if (!current) return null
    setBusy(kind)
    try {
      await flush()
      const result = await call(current.id)
      replaceWork(pickDraft(result))
      return result
    } catch (err) {
      toast.error(errorMessage(err))
      return null
    } finally {
      setBusy(null)
    }
  }

  const students = useMemo(() => new Map(studentList.map((s) => [s.id, s])), [studentList])
  const nameOf = useCallback(
    (studentId: number) => {
      const student = students.get(studentId)
      return student ? `${student.first_name ?? ""} ${student.last_name ?? ""}`.trim() : `Student #${studentId}`
    },
    [students],
  )
  const people = useMemo(
    () =>
      [...(work?.people ?? [])].sort(
        (a, b) =>
          GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) ||
          nameOf(a.student_assistant_id).localeCompare(nameOf(b.student_assistant_id)),
      ),
    [work?.people, nameOf],
  )

  /** Switch term (and view) at once; the term's draft loads into the working copy. */
  const selectTerm = async (nextTermId: number, nextView: typeof view = view) => {
    if (nextTermId !== termId) {
      await flush()
      setWork(null)
      setTermChoice(nextTermId)
      router.replace(`/admin/schedules/new?term=${nextTermId}`, { scroll: false })
    }
    setView(nextView)
  }

  /** Resume the term's draft in progress, or start one (optionally copying another term's shifts). */
  const buildSchedule = async (targetTermId: number, copyFromTermId?: number) => {
    setStarting(true)
    try {
      await flush()
      const existing =
        copyFromTermId != null
          ? null
          : targetTermId === termId && workRef.current
            ? workRef.current
            : await scheduleDraftsApi.latestForTerm(targetTermId)
      const draft =
        existing?.status === "draft" ? existing : await scheduleDraftsApi.create(targetTermId, copyFromTermId)
      if (targetTermId !== termId) {
        setTermChoice(targetTermId)
        router.replace(`/admin/schedules/new?term=${targetTermId}`, { scroll: false })
      }
      replaceWork(draft)
      setView("draft")
      void queryClient.invalidateQueries({ queryKey: queryKeys.scheduleDrafts.latestPerTerm })
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setStarting(false)
    }
  }

  const startDraft = () => (termId ? buildSchedule(termId) : Promise.resolve())

  const changeTerm = (nextTermId: number) => void selectTerm(nextTermId)

  const goHome = async () => {
    await flush()
    setView("home")
    void queryClient.invalidateQueries({ queryKey: queryKeys.scheduleDrafts.latestPerTerm })
  }

  const saveAndExit = goHome

  const [deleteTarget, setDeleteTarget] = useState<ScheduleDraft | null>(null)
  const [deleting, setDeleting] = useState(false)

  /** Delete a draft. Live schedules and anything already sent to Teams aren't touched. */
  const deleteDraft = async (draft: ScheduleDraft) => {
    setDeleting(true)
    try {
      if (workRef.current?.id === draft.id) {
        // Drop pending edits so an autosave can't land on the deleted draft.
        if (timer.current) clearTimeout(timer.current)
        timer.current = null
        dirty.current = false
        await saveChain.current
      }
      await scheduleDraftsApi.remove(draft.id)
      if (workRef.current?.id === draft.id) {
        setWork(null)
        setSaveState("saved")
      }
      queryClient.removeQueries({ queryKey: queryKeys.scheduleDrafts.byTerm(draft.academic_term_id) })
      await queryClient.invalidateQueries({ queryKey: queryKeys.scheduleDrafts.all })
      setView("home")
      toast.success("Draft deleted")
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  const deleteDialog = (
    <AlertDialog open={deleteTarget != null} onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}>
      <AlertDialogContent className="border-border bg-card">
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this draft?</AlertDialogTitle>
          <AlertDialogDescription>
            {deleteTarget
              ? `The ${terms.find((entry) => entry.id === deleteTarget.academic_term_id)?.name ?? "term"} draft, its imported availability, rules and change log are deleted. Live schedules and anything already sent to Teams stay as they are. This can't be undone.`
              : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={deleting}
            onClick={(event) => {
              event.preventDefault()
              if (deleteTarget) void deleteDraft(deleteTarget)
            }}
            className="bg-destructive text-white hover:bg-destructive/90"
          >
            {deleting ? "Deleting…" : "Delete draft"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  if (termsLoading || studentsLoading || (termId != null && draftQuery.isLoading)) {
    return <p className="text-sm text-muted-foreground">Loading schedule builder...</p>
  }

  if (!termId || !term) {
    return (
      <Panel className="flex flex-col items-start gap-2 p-6">
        <span className="text-base font-bold">No terms yet</span>
        <span className="text-sm text-muted-foreground">Add a term before building its schedule.</span>
        <Link href="/admin/terms" className="text-sm font-semibold text-accent hover:underline">
          Go to Terms
        </Link>
      </Panel>
    )
  }

  if (draftQuery.error) {
    return (
      <Panel className="flex flex-col gap-1 p-6">
        <span className="text-base font-bold">Couldn&apos;t load the schedule builder</span>
        <span className="text-sm text-muted-foreground">{errorMessage(draftQuery.error)}</span>
      </Panel>
    )
  }

  const termName = term.name ?? "Term"

  const termPicker = (
    <Select value={String(termId)} onValueChange={(value) => changeTerm(Number(value))}>
      <SelectTrigger className="h-[34px] w-[170px] rounded-full bg-card text-[13px]" aria-label="Term">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {sortTermsByActiveStatus(terms).map((entry) => (
          <SelectItem key={entry.id} value={String(entry.id)}>
            {entry.name}
            {entry.is_active ? " (Active)" : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )

  if (view == null || view === "home") {
    return (
      <>
        <SchedulesHome
          terms={terms}
          selectedTermId={termId}
          onSelectTerm={(id) => void selectTerm(id, "home")}
          onOpenCurrent={(id) => void selectTerm(id, "current")}
          onBuild={buildSchedule}
          onDeleteDraft={setDeleteTarget}
          starting={starting}
        />
        {deleteDialog}
      </>
    )
  }

  // 14.5 and 14.0: what's live.
  if (view === "change") {
    return (
      <ChangeShifts
        term={term}
        students={students}
        nameOf={nameOf}
        draft={work}
        onBack={() => setView("current")}
      />
    )
  }

  if (!work || view === "current") {
    return (
      <CurrentSchedule
        term={term}
        students={students}
        nameOf={nameOf}
        draft={work}
        termPicker={
          <>
            <button
              type="button"
              onClick={() => void goHome()}
              className="h-[34px] rounded-full border border-border bg-card px-3.5 text-[13px] font-semibold hover:bg-muted"
            >
              Schedules home
            </button>
            {termPicker}
          </>
        }
        onChangeShifts={() => setView("change")}
        primaryAction={
          work
            ? {
                label: work.status === "published" ? "Edit term schedule" : "Continue draft",
                onClick: () => setView("draft"),
              }
            : {
                label: starting ? "Starting..." : "New term schedule",
                onClick: () => void startDraft(),
                disabled: starting,
              }
        }
      />
    )
  }

  const context: BuilderContext = {
    draft: work,
    term,
    termName,
    students,
    people,
    nameOf,
    edit,
    log,
    goTo: (step) => edit((draft) => ({ ...draft, step })),
    runImport: (file) =>
      runServer("import", (id) => scheduleDraftsApi.importAvailability(id, file), (result) => result.draft),
    runGenerate: async () =>
      (await runServer("generate", scheduleDraftsApi.generate, (draft) => draft)) != null,
    runPublish: async () => {
      const ok = (await runServer("publish", scheduleDraftsApi.publish, (draft) => draft)) != null
      if (ok) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.schedules.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.scheduleBlocks.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.scheduleDrafts.preview(work.id) }),
        ])
      }
      return ok
    },
    flush,
    reload: async () => {
      await flush()
      const fresh = await scheduleDraftsApi.latestForTerm(work.academic_term_id)
      if (fresh) replaceWork(fresh)
    },
    busy,
  }

  return (
    <div className="flex flex-col gap-5">
      <Panel className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
        <div className="flex items-center gap-3">
          <span className="flex size-[30px] items-center justify-center rounded-[9px] bg-primary text-primary-foreground">
            <Clock className="size-4" />
          </span>
          <div className="flex flex-col">
            <span className="text-base font-bold">
              {work.status === "published" ? "" : "New schedule · "}
              {termName}
            </span>
            <span className="text-xs text-muted-foreground">
              {saveState === "saving"
                ? "Saving..."
                : saveState === "error"
                  ? "Couldn't save. Retrying on your next change."
                  : work.status === "published"
                    ? `Published ${new Date(work.published_at ?? work.updated_at).toLocaleDateString()} · edits stay in this draft until you publish again`
                    : "All changes saved"}
            </span>
          </div>
        </div>
        <nav aria-label="Steps" className="flex flex-wrap items-center gap-1.5">
          {STEPS.map((label, index) => {
            const step = index + 1
            const current = work.step === step
            const done = step < work.step
            return (
              <button
                key={label}
                type="button"
                aria-current={current ? "step" : undefined}
                onClick={() => context.goTo(step)}
                className={cn(
                  "flex items-center gap-2 rounded-full py-1.5 pr-3 pl-1.5 transition-colors",
                  current ? "bg-accent/10" : "hover:bg-muted",
                )}
              >
                <span
                  className={cn(
                    "flex size-[22px] items-center justify-center rounded-full text-[11px] font-bold",
                    current || done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-3" strokeWidth={3} /> : step}
                </span>
                <span
                  className={cn(
                    "text-[13px]",
                    current ? "font-bold text-accent" : done ? "font-semibold" : "font-semibold text-muted-foreground",
                  )}
                >
                  {label}
                </span>
              </button>
            )
          })}
        </nav>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setView("current")}
            className="h-[34px] rounded-full border border-border bg-card px-3.5 text-[13px] font-semibold hover:bg-muted"
          >
            Current schedule
          </button>
          {work.status === "draft" ? (
            <button
              type="button"
              onClick={() => setDeleteTarget(work)}
              className="h-[34px] rounded-full px-3 text-[13px] font-semibold text-destructive hover:bg-destructive/10"
            >
              Delete draft
            </button>
          ) : null}
        <button
          type="button"
          onClick={saveAndExit}
          className="h-[34px] rounded-full border border-border bg-card px-3.5 text-[13px] font-semibold hover:bg-muted"
        >
          Save and exit
        </button>
        </div>
      </Panel>

      {work.step === 1 ? <StepImport {...context} /> : null}
      {work.step === 2 ? <StepGuidelines {...context} /> : null}
      {work.step === 3 ? <StepReview {...context} /> : null}
      {work.step === 4 ? <StepPublish {...context} /> : null}
      {deleteDialog}
    </div>
  )
}

"use client"

import { useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { Search, Upload } from "lucide-react"
import { toast } from "sonner"

import { ScheduleCoverage } from "@/components/admin/schedules/schedule-coverage"
import { ScheduleImportDialog } from "@/components/admin/schedules/schedule-import-dialog"
import {
  ScheduleSideEditor,
  ScheduleSideEditorEmpty,
  type ScheduleDraft,
} from "@/components/admin/schedules/schedule-side-editor"
import {
  formatWeeklyHours,
  normalizeDraftBlocks,
  totalWeeklyHours,
  validateDraftBlocks,
} from "@/components/admin/schedules/schedule-utils"
import { TeamWeekTable, type TeamWeekRow } from "@/components/admin/schedules/team-week-table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useStudentTermSelection, type RoleFilter } from "@/hooks/use-student-term-selection"
import { queryKeys } from "@/lib/query-keys"
import { validateScheduleDateOverrides } from "@/lib/schedules/date-range"
import { saveStudentTermSchedule } from "@/lib/schedules/persistence"
import { blocksEqual, buildCoverage } from "@/lib/schedules/team-week"
import { cn } from "@/lib/utils"

/** First names listed as unscheduled in the header before collapsing to "+N". */
const MISSING_NAME_LIMIT = 3

const ROLE_FILTERS: { value: RoleFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "assistant", label: "Assistants" },
  { value: "lead", label: "Leads" },
]

function draftsEqual(a: ScheduleDraft, b: ScheduleDraft): boolean {
  if (a.customDates !== b.customDates || !blocksEqual(a.blocks, b.blocks)) return false
  return !a.customDates || (a.startDate === b.startDate && a.endDate === b.endDate)
}

export function SchedulesManager() {
  const queryClient = useQueryClient()
  const [importOpen, setImportOpen] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, ScheduleDraft>>({})
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const {
    isLoading,
    sortedTerms,
    activeTermId,
    selectedTerm,
    activeStudents,
    selectedStudent,
    searchQuery,
    setSearchQuery,
    roleFilter,
    setRoleFilter,
    filteredStudents,
    selectStudent,
    changeTerm,
    getScheduleForStudentTerm,
    allBlocks,
  } = useStudentTermSelection({ basePath: "/admin/schedules" })

  const draftKey = (studentId: number) => `${activeTermId}:${studentId}`

  const savedDrafts = useMemo(() => {
    const map = new Map<number, ScheduleDraft>()
    if (!activeTermId) return map
    for (const student of activeStudents) {
      const { schedule, blocks } = getScheduleForStudentTerm(student.id, activeTermId)
      map.set(student.id, {
        blocks: normalizeDraftBlocks(blocks),
        customDates: Boolean(schedule?.start_date || schedule?.end_date),
        startDate: schedule?.start_date ?? "",
        endDate: schedule?.end_date ?? "",
      })
    }
    return map
  }, [activeStudents, activeTermId, getScheduleForStudentTerm])

  const currentDraft = (studentId: number): ScheduleDraft =>
    drafts[draftKey(studentId)] ??
    savedDrafts.get(studentId) ?? { blocks: [], customDates: false, startDate: "", endDate: "" }

  const isUnsaved = (studentId: number) => {
    const draft = drafts[draftKey(studentId)]
    const saved = savedDrafts.get(studentId)
    return Boolean(draft && saved && !draftsEqual(draft, saved))
  }

  const coverage = buildCoverage(activeStudents.map((student) => currentDraft(student.id).blocks))
  const scheduled = activeStudents.filter((student) => currentDraft(student.id).blocks.length > 0)
  const missing = activeStudents
    .filter((student) => currentDraft(student.id).blocks.length === 0)
    .map((student) => student.first_name)
  const weeklyHours = scheduled.reduce(
    (sum, student) => sum + totalWeeklyHours(currentDraft(student.id).blocks),
    0,
  )
  const missingLabel =
    missing.length > MISSING_NAME_LIMIT
      ? `${missing.slice(0, MISSING_NAME_LIMIT).join(", ")} +${missing.length - MISSING_NAME_LIMIT}`
      : missing.join(", ")

  const rows: TeamWeekRow[] = filteredStudents.map((student) => ({
    student,
    blocks: currentDraft(student.id).blocks,
    unsaved: isUnsaved(student.id),
  }))

  const handleDraftChange = (draft: ScheduleDraft) => {
    if (!selectedStudent) return
    const key = draftKey(selectedStudent.id)
    setDrafts((current) => ({ ...current, [key]: draft }))
    setErrors(({ [key]: _removed, ...rest }) => rest)
  }

  const handleDiscard = () => {
    if (!selectedStudent) return
    const key = draftKey(selectedStudent.id)
    setDrafts(({ [key]: _removed, ...rest }) => rest)
    setErrors(({ [key]: _removed, ...rest }) => rest)
  }

  const handleSave = async () => {
    if (!selectedStudent || !activeTermId) return
    const student = selectedStudent
    const key = draftKey(student.id)
    const draft = currentDraft(student.id)
    const remoteAllowed = selectedTerm?.remote_shifts_allowed ?? false

    const blocks = normalizeDraftBlocks(draft.blocks, { forceInPerson: !remoteAllowed })
    const startDate = draft.customDates ? draft.startDate.trim() || null : null
    const endDate = draft.customDates ? draft.endDate.trim() || null : null
    const validationError =
      validateDraftBlocks(blocks) ??
      validateScheduleDateOverrides(startDate, endDate, {
        start_date: selectedTerm?.start_date ?? null,
        end_date: selectedTerm?.end_date ?? null,
      })
    if (validationError) {
      setErrors((current) => ({ ...current, [key]: validationError }))
      return
    }

    const { schedule } = getScheduleForStudentTerm(student.id, activeTermId)
    setSavingKey(key)
    try {
      await saveStudentTermSchedule(
        student.id,
        activeTermId,
        blocks,
        schedule,
        allBlocks.filter((block) => (schedule ? block.schedule_id === schedule.id : false)),
        { startDate, endDate },
      )
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.schedules.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.scheduleBlocks.all }),
      ])
      setDrafts(({ [key]: _removed, ...rest }) => rest)
      toast.success(`Saved ${student.first_name}'s schedule`)
    } catch (err) {
      console.error("Save schedule failed:", err)
      setErrors((current) => ({ ...current, [key]: "Failed to save schedule. Please try again." }))
    } finally {
      setSavingKey(null)
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-1">
        <h1 className="text-[28px] font-bold tracking-[-0.02em]">Schedules</h1>
        <p className="text-sm text-muted-foreground">Loading schedules...</p>
      </div>
    )
  }

  const selectedKey = selectedStudent ? draftKey(selectedStudent.id) : null

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-[28px] font-bold tracking-[-0.02em]">Schedules</h1>
            <p className="text-sm text-muted-foreground">
              {selectedTerm?.name ?? "No term"} · {scheduled.length} of {activeStudents.length} scheduled ·{" "}
              {formatWeeklyHours(weeklyHours)} weekly
              {missing.length > 0 ? ` · missing ${missingLabel}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={activeTermId ? String(activeTermId) : undefined}
              onValueChange={(value) => changeTerm(Number(value))}
            >
              <SelectTrigger className="h-9 w-[190px] rounded-full bg-card">
                <SelectValue placeholder="Select term" />
              </SelectTrigger>
              <SelectContent>
                {sortedTerms.map((term) => (
                  <SelectItem key={term.id} value={String(term.id)}>
                    {term.name}
                    {term.is_active ? " (Active)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              type="button"
              disabled={!activeTermId}
              onClick={() => setImportOpen(true)}
              className="flex h-9 items-center gap-2 rounded-full border border-border bg-card px-3.5 text-[13px] font-semibold hover:bg-muted disabled:opacity-50"
            >
              <Upload className="size-3.5" />
              Import schedule
            </button>
          </div>
        </div>

        {activeTermId && selectedTerm ? (
          <ScheduleImportDialog
            open={importOpen}
            onOpenChange={setImportOpen}
            termId={activeTermId}
            termName={selectedTerm.name ?? "Selected term"}
          />
        ) : null}

        {!activeTermId ? (
          <p className="text-sm text-muted-foreground">Add a term before managing schedules.</p>
        ) : (
          <>
            <ScheduleCoverage days={coverage} />

            <div className="flex flex-wrap items-center gap-2">
              <label className="flex h-9 min-w-[220px] flex-1 items-center gap-2 rounded-full border border-border bg-card px-3 sm:flex-none">
                <Search className="size-3.5 text-muted-foreground" />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search students"
                  className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </label>
              <div className="flex gap-1 rounded-full border border-border bg-card p-1">
                {ROLE_FILTERS.map((filter) => (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setRoleFilter(filter.value)}
                    className={cn(
                      "h-7 rounded-full px-3 text-xs font-semibold transition-colors",
                      roleFilter === filter.value
                        ? "bg-foreground text-background"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>

            <TeamWeekTable rows={rows} selectedId={selectedStudent?.id ?? null} onSelect={selectStudent} />
          </>
        )}
      </div>

      <div className="lg:pt-[76px]">
        {selectedStudent && activeTermId && selectedKey ? (
          <ScheduleSideEditor
            key={selectedKey}
            student={selectedStudent}
            draft={currentDraft(selectedStudent.id)}
            onDraftChange={handleDraftChange}
            termStartDate={selectedTerm?.start_date ?? null}
            termEndDate={selectedTerm?.end_date ?? null}
            remoteShiftsAllowed={selectedTerm?.remote_shifts_allowed ?? false}
            unsaved={isUnsaved(selectedStudent.id)}
            isSaving={savingKey === selectedKey}
            error={errors[selectedKey] ?? null}
            onSave={handleSave}
            onDiscard={handleDiscard}
          />
        ) : (
          <ScheduleSideEditorEmpty
            message={
              activeTermId
                ? "Click a row to edit that student's weekly schedule."
                : "Add a term before managing schedules."
            }
          />
        )}
      </div>
    </div>
  )
}

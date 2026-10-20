"use client"

import { useMemo, useState, type ReactNode } from "react"
import { useQuery } from "@tanstack/react-query"
import { format, parseISO } from "date-fns"
import { Clock } from "lucide-react"

import { Panel } from "@/components/admin/schedule-builder/builder-ui"
import { sortTermsByActiveStatus } from "@/components/admin/terms/term-types"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useTeamsSyncStatus } from "@/hooks/use-teams-sync"
import { scheduleDraftsApi, type ScheduleDraft } from "@/lib/api/schedule-drafts"
import { scheduleBlocksApi } from "@/lib/api/scheduleBlocks"
import { schedulesApi } from "@/lib/api/schedules"
import type { Term } from "@/lib/api/terms"
import { getOrgLocalDateString } from "@/lib/org-time"
import { queryKeys } from "@/lib/query-keys"
import { currentWeekIndex, termWeeks } from "@/lib/schedule-builder/live-schedule"
import { computeChecks } from "@/lib/schedule-builder/model"
import { cn } from "@/lib/utils"

type TermStatus = "draft" | "live" | "ended" | "none"

interface TermRow {
  term: Term
  status: TermStatus
  draft: ScheduleDraft | null
  shifts: number
  students: number
}

const shortDate = (date: string | null) => (date ? format(parseISO(date), "MMM d") : "—")
const dateRange = (term: Pick<Term, "start_date" | "end_date">) =>
  `${shortDate(term.start_date)} – ${shortDate(term.end_date)}`

interface SchedulesHomeProps {
  terms: Term[]
  selectedTermId: number
  onSelectTerm: (_termId: number) => void
  /** Open the read-only current schedule (14.0) for a term. */
  onOpenCurrent: (_termId: number) => void
  /** Resume the term's draft, or start one (optionally copying another term's shifts). */
  onBuild: (_termId: number, _copyFromTermId?: number) => Promise<void> | void
  /** Ask to delete a draft (the parent confirms). */
  onDeleteDraft: (_draft: ScheduleDraft) => void
  starting: boolean
}

/** 14 · Schedules home: pick a term, then manage what's live or build a new schedule. */
export function SchedulesHome({ terms, selectedTermId, onSelectTerm, onOpenCurrent, onBuild, onDeleteDraft, starting }: Readonly<SchedulesHomeProps>) {
  const { data: drafts = [] } = useQuery({
    queryKey: queryKeys.scheduleDrafts.latestPerTerm,
    queryFn: scheduleDraftsApi.listLatest,
  })
  const { data: schedules = [] } = useQuery({ queryKey: queryKeys.schedules.all, queryFn: schedulesApi.list })
  const { data: blocks = [] } = useQuery({ queryKey: queryKeys.scheduleBlocks.all, queryFn: scheduleBlocksApi.list })
  const { data: syncStatus } = useTeamsSyncStatus(selectedTermId)
  const [copyFrom, setCopyFrom] = useState<Term | null>(null)
  const today = getOrgLocalDateString()

  const rows = useMemo<TermRow[]>(() => {
    const blockCount = new Map<number, number>()
    for (const block of blocks) {
      if (block.schedule_id != null) blockCount.set(block.schedule_id, (blockCount.get(block.schedule_id) ?? 0) + 1)
    }
    return sortTermsByActiveStatus(terms).map((term) => {
      const termSchedules = schedules.filter((schedule) => schedule.academic_term_id === term.id && (blockCount.get(schedule.id) ?? 0) > 0)
      const shifts = termSchedules.reduce((sum, schedule) => sum + (blockCount.get(schedule.id) ?? 0), 0)
      const draft = drafts.find((entry) => entry.academic_term_id === term.id) ?? null
      const ended = Boolean(term.end_date && term.end_date < today)
      const status: TermStatus =
        draft?.status === "draft" && !ended ? "draft" : ended ? "ended" : shifts > 0 ? "live" : "none"
      return { term, status, draft, shifts, students: termSchedules.length }
    })
  }, [terms, schedules, blocks, drafts, today])

  const selected = rows.find((row) => row.term.id === selectedTermId) ?? rows[0]
  if (!selected) return null
  const weeks = termWeeks(selected.term)
  const weekNow = weeks.length ? currentWeekIndex(weeks, today) + 1 : null
  const inProgress = selected.draft?.status === "draft"

  return (
    <div className="flex flex-col gap-5">
      <Panel className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
        <div className="flex items-center gap-3">
          <span className="flex size-[30px] items-center justify-center rounded-[9px] bg-primary text-primary-foreground">
            <Clock className="size-4" />
          </span>
          <span className="text-base font-bold">Schedules</span>
          <span className="text-[13px] text-muted-foreground">{syncStatus?.scheduling_group ?? "Service Desk"}</span>
        </div>
        <Select value={String(selected.term.id)} onValueChange={(value) => onSelectTerm(Number(value))}>
          <SelectTrigger className="h-[34px] w-[190px] rounded-full bg-card text-[13px]" aria-label="Term">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {rows.map(({ term }) => (
              <SelectItem key={term.id} value={String(term.id)}>
                {term.name}
                {term.is_active ? " (Active)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        <HomeCard
          eyebrow="Manage existing"
          badge={
            selected.shifts > 0
              ? { label: syncStatus?.graph_configured ? "Live in Teams" : "Live", tone: "good" }
              : { label: "No shifts yet", tone: "muted" }
          }
          title={selected.term.name ?? "Term"}
          subtitle={[
            dateRange(selected.term),
            weekNow && selected.status !== "ended" ? `week ${weekNow} of ${weeks.length}` : null,
            `${selected.students} ${selected.students === 1 ? "student" : "students"}`,
          ]
            .filter(Boolean)
            .join(" · ")}
          body="See who’s on, change anyone’s shifts, add trainees, or update availability for a week."
          action={{ label: "Open current schedule", primary: false, onClick: () => onOpenCurrent(selected.term.id) }}
        />
        <HomeCard
          eyebrow="Build new"
          badge={inProgress ? { label: `Draft · step ${selected.draft!.step} of 4`, tone: "warn" } : { label: "4 steps", tone: "muted" }}
          title="New term schedule"
          subtitle="Import availability → guidelines → review → publish"
          body="Start from the availability workbook. The live schedule stays untouched until you publish."
          action={{
            label: starting ? "Starting…" : inProgress ? "Resume draft" : "Start new schedule",
            primary: true,
            disabled: starting,
            onClick: () => void onBuild(selected.term.id),
          }}
        />
      </div>

      <Panel className="flex flex-col py-1.5">
        <span className="px-6 pt-3 pb-2 text-sm font-bold">All terms</span>
        {rows.map((row) => (
          <TermRowView
            key={row.term.id}
            row={row}
            onOpen={() => onOpenCurrent(row.term.id)}
            onBuild={() => void onBuild(row.term.id)}
            onCopy={() => setCopyFrom(row.term)}
            onDelete={row.draft ? () => onDeleteDraft(row.draft!) : undefined}
          />
        ))}
      </Panel>

      <CopyDialog
        source={copyFrom}
        rows={rows}
        defaultTarget={rows.find((row) => row.status === "none" || row.status === "draft")?.term.id ?? selected.term.id}
        starting={starting}
        onClose={() => setCopyFrom(null)}
        onCopy={async (targetId) => {
          await onBuild(targetId, copyFrom!.id)
          setCopyFrom(null)
        }}
      />
    </div>
  )
}

function HomeCard({
  eyebrow,
  badge,
  title,
  subtitle,
  body,
  action,
}: Readonly<{
  eyebrow: string
  badge: { label: string; tone: "good" | "warn" | "muted" }
  title: string
  subtitle: string
  body: ReactNode
  action: { label: string; primary: boolean; disabled?: boolean; onClick: () => void }
}>) {
  return (
    <button
      type="button"
      onClick={action.onClick}
      disabled={action.disabled}
      className="flex flex-col gap-3.5 rounded-[20px] border border-border bg-card px-6 py-[22px] text-left transition-colors hover:border-accent disabled:opacity-60"
    >
      <span className="flex w-full items-center justify-between">
        <span className="text-xs font-bold tracking-[0.08em] text-muted-foreground uppercase">{eyebrow}</span>
        <StatusPill tone={badge.tone}>{badge.label}</StatusPill>
      </span>
      <span className="flex flex-col gap-1">
        <span className="text-2xl font-bold tracking-[-0.02em]">{title}</span>
        <span className="text-sm text-muted-foreground">{subtitle}</span>
      </span>
      <span className="text-sm leading-[1.45] text-pretty text-foreground/80">{body}</span>
      <span
        className={cn(
          "flex h-9 items-center self-start rounded-full px-4 text-[13px] font-bold",
          action.primary ? "bg-primary text-primary-foreground" : "border border-accent/30 bg-accent/10 text-accent",
        )}
      >
        {action.label}
      </span>
    </button>
  )
}

function StatusPill({ tone, children }: Readonly<{ tone: "good" | "warn" | "muted"; children: ReactNode }>) {
  return (
    <span
      className={cn(
        "justify-self-start rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap",
        tone === "good" && "bg-accent/15 text-accent",
        tone === "warn" && "bg-amber-500/15 text-amber-800 dark:text-amber-200",
        tone === "muted" && "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  )
}

function TermRowView({
  row,
  onOpen,
  onBuild,
  onCopy,
  onDelete,
}: Readonly<{ row: TermRow; onOpen: () => void; onBuild: () => void; onCopy: () => void; onDelete?: () => void }>) {
  const { term, status, draft, shifts } = row
  const noLeadHours = draft && status === "draft" ? computeChecks(draft.people, draft.rules).noLead.length / 2 : 0
  const pill =
    status === "draft"
      ? { tone: "warn" as const, label: `Draft · step ${draft!.step} of 4` }
      : status === "live"
        ? { tone: "good" as const, label: "Live" }
        : status === "ended"
          ? { tone: "muted" as const, label: "Ended" }
          : { tone: "muted" as const, label: "Not started" }
  const detail =
    status === "draft"
      ? `Edited ${format(parseISO(draft!.updated_at), "MMM d")}${noLeadHours ? ` · ${noLeadHours} hours without a lead` : ""}`
      : status === "live"
        ? `${draft?.published_at ? `Published ${format(parseISO(draft.published_at), "MMM d")} · ` : ""}${shifts} weekly shifts`
        : status === "ended"
          ? `Read-only${shifts ? ` · ${shifts} weekly shifts` : ""}`
          : "No schedule yet"

  const action = (label: string, onClick: () => void) => (
    <button type="button" onClick={onClick} className="text-[13px] font-bold text-accent hover:underline">
      {label}
    </button>
  )

  return (
    <div className="grid items-center gap-x-4 gap-y-1 border-t border-border/60 px-6 py-3 text-[13px] md:grid-cols-[200px_160px_170px_minmax(0,1fr)_auto]">
      <span className="font-bold">{term.name}</span>
      <span className="text-muted-foreground">{dateRange(term)}</span>
      <StatusPill tone={pill.tone}>{pill.label}</StatusPill>
      <span className="text-muted-foreground">{detail}</span>
      <span className="flex items-center gap-3 md:justify-self-end">
        {status === "draft" ? action("Resume draft", onBuild) : null}
        {status === "draft" && onDelete ? (
          <button type="button" onClick={onDelete} className="text-[13px] font-semibold text-destructive hover:underline">
            Delete
          </button>
        ) : null}
        {status === "live" ? action("Open", onOpen) : null}
        {status === "ended" ? (
          <>
            {shifts ? action("Copy as starting point", onCopy) : null}
            {action("Open", onOpen)}
          </>
        ) : null}
        {status === "none" ? action("Start new schedule", onBuild) : null}
      </span>
    </div>
  )
}

function CopyDialog({
  source,
  rows,
  defaultTarget,
  starting,
  onClose,
  onCopy,
}: Readonly<{
  source: Term | null
  rows: TermRow[]
  defaultTarget: number
  starting: boolean
  onClose: () => void
  onCopy: (_targetId: number) => Promise<void>
}>) {
  const targets = rows.filter((row) => row.status !== "ended" && row.term.id !== source?.id)
  const [target, setTarget] = useState<number | null>(null)
  const chosen = target ?? (targets.some((row) => row.term.id === defaultTarget) ? defaultTarget : targets[0]?.term.id ?? null)
  const chosenRow = targets.find((row) => row.term.id === chosen)

  return (
    <Dialog open={source != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="border-border bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Copy {source?.name} as a starting point</DialogTitle>
          <DialogDescription>
            Starts a new draft with everyone&apos;s weekly shifts from {source?.name}. You still import availability and review before
            publishing; nothing live changes.
          </DialogDescription>
        </DialogHeader>
        {targets.length === 0 ? (
          <p className="text-sm text-muted-foreground">Add an upcoming term in Terms first.</p>
        ) : (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground">Build the schedule for</span>
            <Select value={chosen != null ? String(chosen) : undefined} onValueChange={(value) => setTarget(Number(value))}>
              <SelectTrigger className="h-10 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {targets.map((row) => (
                  <SelectItem key={row.term.id} value={String(row.term.id)}>
                    {row.term.name} · {dateRange(row.term)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {chosenRow?.status === "draft" ? (
              <span className="text-xs text-amber-700 dark:text-amber-300">
                {chosenRow.term.name} already has a draft in progress. Copying starts a fresh draft; the old one stays in its history.
              </span>
            ) : null}
          </label>
        )}
        <DialogFooter>
          <button type="button" onClick={onClose} className="h-9 rounded-full border border-border px-4 text-[13px] font-semibold hover:bg-muted">
            Cancel
          </button>
          <button
            type="button"
            disabled={chosen == null || starting}
            onClick={() => chosen != null && void onCopy(chosen)}
            className="h-9 rounded-full bg-primary px-4 text-[13px] font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {starting ? "Starting…" : "Start draft"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

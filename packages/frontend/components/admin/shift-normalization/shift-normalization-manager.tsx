"use client"

import { useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Check } from "lucide-react"
import { toast } from "sonner"

import { Checkmark, ClockOutFixesSection } from "@/components/admin/shift-normalization/clock-out-fixes-section"
import { sortTermsByActiveStatus } from "@/components/admin/terms/term-types"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  applyNormalizationMatches,
  fetchNormalizationPreview,
} from "@/lib/api/shift-normalization"
import { termsApi } from "@/lib/api/terms"
import { formatTimeAgo } from "@/lib/format-time"
import { queryKeys } from "@/lib/query-keys"
import {
  buildProposalView,
  describeUnmatched,
  formatEntryDate,
  formatEntryRange,
} from "@/lib/shifts/normalization-view"
import { cn } from "@/lib/utils"

const MATCH_GRID =
  "grid grid-cols-[28px_minmax(0,1fr)_auto] md:grid-cols-[28px_minmax(0,1.2fr)_110px_150px_minmax(0,1.3fr)_170px_150px] gap-x-3 gap-y-1"
const UNMATCHED_GRID =
  "grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1.2fr)_110px_150px_170px_minmax(0,1.6fr)] gap-x-3 gap-y-1"

export function ShiftNormalizationManager() {
  const queryClient = useQueryClient()
  const { data: terms = [] } = useQuery({ queryKey: queryKeys.terms.all, queryFn: termsApi.list })
  const sortedTerms = useMemo(() => sortTermsByActiveStatus(terms), [terms])
  const [termChoice, setTermChoice] = useState<number | null>(null)
  const termId = termChoice ?? sortedTerms[0]?.id ?? null
  const term = terms.find((candidate) => candidate.id === termId)

  const previewQuery = useQuery({
    queryKey: queryKeys.normalization.preview(termId ?? 0),
    queryFn: () => fetchNormalizationPreview(termId!),
    enabled: termId != null,
  })
  const preview = previewQuery.data
  const views = useMemo(() => (preview?.proposals ?? []).map(buildProposalView), [preview])

  // Admin choices on top of the default (close matches selected); reset on every scan.
  const [overrides, setOverrides] = useState<{ scan: number; picks: Map<number, boolean> }>({
    scan: 0,
    picks: new Map(),
  })
  const picks = overrides.scan === previewQuery.dataUpdatedAt ? overrides.picks : new Map<number, boolean>()
  const isSelected = (id: number, isClose: boolean) => picks.get(id) ?? isClose
  const selected = views.filter((view) => isSelected(view.proposal.timeEntryId, view.isClose))

  const [applying, setApplying] = useState(false)
  const [banner, setBanner] = useState<string | null>(null)
  const [unmatchedOpen, setUnmatchedOpen] = useState(true)

  const setPicks = (update: (_current: Map<number, boolean>) => Map<number, boolean>) =>
    setOverrides({ scan: previewQuery.dataUpdatedAt, picks: update(new Map(picks)) })

  const toggle = (id: number, isClose: boolean) =>
    setPicks((current) => current.set(id, !isSelected(id, isClose)))

  const allSelected = views.length > 0 && selected.length === views.length
  const toggleAll = () =>
    setPicks(() => new Map(views.map((view) => [view.proposal.timeEntryId, !allSelected])))

  const scan = async () => {
    setBanner(null)
    await previewQuery.refetch()
  }

  /** Time entries changed: refresh everything that reads them, then rescan. */
  const refreshAfterChange = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.timeEntries.all }),
      ...(termId ? [queryClient.invalidateQueries({ queryKey: queryKeys.analytics.term(termId) })] : []),
      queryClient.invalidateQueries({ queryKey: queryKeys.todayShifts.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.timesheet.all }),
    ])
    await previewQuery.refetch()
  }

  const apply = async () => {
    if (!termId || selected.length === 0) return
    setApplying(true)
    try {
      const result = await applyNormalizationMatches(
        termId,
        selected.map((view) => ({
          timeEntryId: view.proposal.timeEntryId,
          scheduleBlockId: view.proposal.proposedBlockId,
        })),
      )
      await refreshAfterChange()
      setBanner(
        `Linked ${result.applied} ${result.applied === 1 ? "clock-in" : "clock-ins"} to their shifts.${
          result.skipped.length > 0 ? ` ${result.skipped.length} skipped because they changed since the scan.` : ""
        } Timesheets and analytics are updated.`,
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't link the selected clock-ins")
    } finally {
      setApplying(false)
    }
  }

  const scannedLabel = previewQuery.isFetching
    ? "scanning…"
    : previewQuery.dataUpdatedAt
      ? `last scanned ${formatTimeAgo(new Date(previewQuery.dataUpdatedAt).toISOString())}`
      : "not scanned yet"

  const unmatched = preview?.unmatched ?? []
  const clockOutFixes = preview?.clockOutFixes ?? []
  const kpis = [
    {
      value: preview ? preview.summary.totalUnscheduled : "—",
      label: "Unlinked clock-ins",
      hint: "not tied to a shift",
      className: "bg-muted",
    },
    {
      value: preview ? views.length : "—",
      label: "Suggested matches",
      hint: "close to a scheduled shift",
      className: "bg-accent/15 text-accent",
    },
    {
      value: preview ? unmatched.length : "—",
      label: "No match",
      hint: "need a manual fix",
      className: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
    },
    {
      value: preview ? clockOutFixes.length : "—",
      label: "Odd clock-outs",
      hint: "can be set to shift end",
      className: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
    },
  ]

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-[28px] font-bold tracking-[-0.02em]">Shift normalization</h1>
          <p className="text-sm text-muted-foreground">
            {term?.name ?? "No term"} · {scannedLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={termId ? String(termId) : undefined}
            onValueChange={(value) => {
              setTermChoice(Number(value))
              setBanner(null)
            }}
          >
            <SelectTrigger className="h-[38px] w-[190px] rounded-full bg-card font-bold">
              <SelectValue placeholder="Select term" />
            </SelectTrigger>
            <SelectContent>
              {sortedTerms.map((option) => (
                <SelectItem key={option.id} value={String(option.id)}>
                  {option.name}
                  {option.is_active ? " (Active)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            type="button"
            onClick={scan}
            disabled={!termId || previewQuery.isFetching || applying}
            className="h-[38px] rounded-full border-[1.5px] border-accent bg-card px-3.5 text-[13px] font-bold text-accent hover:bg-accent/10 disabled:opacity-50"
          >
            {previewQuery.isFetching ? "Scanning…" : "Scan again"}
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={selected.length === 0 || applying || previewQuery.isFetching}
            className="h-[38px] rounded-full bg-accent px-4 text-[13px] font-bold text-accent-foreground hover:bg-accent/90 disabled:bg-muted-foreground disabled:text-background"
          >
            {applying ? "Linking…" : selected.length > 0 ? `Link ${selected.length} selected` : "Link selected"}
          </button>
        </div>
      </div>

      {banner ? (
        <div className="flex items-center gap-2.5 rounded-[14px] bg-emerald-500/15 px-4 py-3 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
          <Check className="size-4 shrink-0" strokeWidth={2.5} />
          {banner}
        </div>
      ) : null}

      {previewQuery.error ? (
        <p className="text-sm text-destructive">
          {previewQuery.error instanceof Error ? previewQuery.error.message : "Scan failed"}
        </p>
      ) : null}

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className={cn("flex flex-col gap-0.5 rounded-[14px] px-3.5 py-3", kpi.className)}>
            <span className="font-mono text-2xl font-semibold tabular-nums">{kpi.value}</span>
            <span className="text-xs font-semibold">{kpi.label}</span>
            <span className="text-xs opacity-80">{kpi.hint}</span>
          </div>
        ))}
      </div>

      <section className="overflow-hidden rounded-[20px] border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
          <div className="flex flex-col gap-0.5">
            <span className="text-[15px] font-bold">Suggested matches</span>
            <span className="text-[13px] text-muted-foreground">Clock-in compared with the shift it would link to</span>
          </div>
          <div className="flex items-center gap-3.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-[18px] rounded-full bg-accent" />
              Clocked in
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-3 w-[18px] rounded shadow-[inset_0_0_0_1.5px_var(--muted-foreground)]" />
              Scheduled shift
            </span>
          </div>
        </div>
        <div
          className={cn(
            MATCH_GRID,
            "items-center border-y border-border/60 bg-muted/40 px-5 py-2 text-xs font-semibold text-muted-foreground",
          )}
        >
          <button
            type="button"
            onClick={toggleAll}
            disabled={views.length === 0}
            aria-label={allSelected ? "Clear selection" : "Select all matches"}
          >
            <Checkmark state={allSelected ? "on" : selected.length > 0 ? "some" : "off"} />
          </button>
          <span>Student</span>
          <span className="hidden md:inline">Date</span>
          <span className="hidden md:inline">Clocked in</span>
          <span className="hidden md:inline">Overlap</span>
          <span className="hidden md:inline">Links to shift</span>
          <span className="md:block">Difference</span>
        </div>

        {previewQuery.isLoading ? (
          <p className="px-5 py-9 text-center text-sm text-muted-foreground">Scanning clock-ins…</p>
        ) : views.length === 0 ? (
          <p className="px-5 py-9 text-center text-sm text-muted-foreground">
            {preview && preview.summary.totalUnscheduled === 0
              ? "Every clock-in this term is linked to a shift."
              : "Every clock-in that could be matched has been linked. Scan again after the next Teams sync."}
          </p>
        ) : (
          views.map((view) => {
            const { proposal } = view
            const on = isSelected(proposal.timeEntryId, view.isClose)
            return (
              <button
                key={proposal.timeEntryId}
                type="button"
                onClick={() => toggle(proposal.timeEntryId, view.isClose)}
                aria-pressed={on}
                className={cn(
                  MATCH_GRID,
                  "w-full items-center border-b border-border/60 px-5 py-[11px] text-left last:border-0",
                  on ? "bg-accent/5" : "hover:bg-muted/40",
                )}
              >
                <Checkmark state={on ? "on" : "off"} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-semibold">{proposal.studentName}</span>
                  <span className="truncate font-mono text-xs text-muted-foreground md:hidden">
                    {formatEntryDate(proposal.date)} · {formatEntryRange(proposal.clockIn, proposal.clockOut)} →{" "}
                    {view.blockLabel}
                  </span>
                </span>
                <span className="hidden font-mono text-[13px] text-foreground/80 md:inline">
                  {formatEntryDate(proposal.date)}
                </span>
                <span className="hidden font-mono text-[13px] md:inline">
                  {formatEntryRange(proposal.clockIn, proposal.clockOut)}
                </span>
                <span className="relative hidden h-[22px] md:block" aria-hidden>
                  <span
                    className="absolute inset-y-0 rounded-md bg-muted/60 shadow-[inset_0_0_0_1.5px_var(--muted-foreground)]"
                    style={{ left: `${view.block.left}%`, width: `${view.block.width}%` }}
                  />
                  <span
                    className={cn("absolute top-[7px] h-2 rounded-full", !view.entry.open && "bg-accent")}
                    style={{
                      left: `${view.entry.left}%`,
                      width: `${view.entry.width}%`,
                      ...(view.entry.open
                        ? { backgroundImage: "repeating-linear-gradient(90deg, var(--accent) 0 6px, transparent 6px 10px)" }
                        : null),
                    }}
                  />
                </span>
                <span className="hidden font-mono text-[13px] text-foreground/80 md:inline">{view.blockLabel}</span>
                <span
                  className={cn(
                    "justify-self-start whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold",
                    view.needsLook
                      ? "bg-amber-500/15 text-amber-800 dark:text-amber-200"
                      : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
                  )}
                >
                  {view.difference}
                </span>
              </button>
            )
          })
        )}
      </section>

      <ClockOutFixesSection
        termId={termId}
        fixes={clockOutFixes}
        scanKey={previewQuery.dataUpdatedAt}
        disabled={previewQuery.isFetching || applying}
        onApplied={async (message) => {
          await refreshAfterChange()
          setBanner(message)
        }}
      />

      <section className="overflow-hidden rounded-[20px] border border-border bg-card">
        <button
          type="button"
          onClick={() => setUnmatchedOpen((open) => !open)}
          aria-expanded={unmatchedOpen}
          className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-muted/30"
        >
          <span className="flex flex-col gap-0.5">
            <span className="text-[15px] font-bold">No match · {unmatched.length}</span>
            <span className="text-[13px] text-muted-foreground">These clock-ins can&apos;t be linked automatically</span>
          </span>
          <span className="text-[13px] font-semibold text-accent">{unmatchedOpen ? "Hide" : "Show"}</span>
        </button>
        {unmatchedOpen ? (
          <>
            <div
              className={cn(
                UNMATCHED_GRID,
                "hidden border-y border-border/60 bg-muted/40 px-5 py-2 text-xs font-semibold text-muted-foreground md:grid",
              )}
            >
              <span>Student</span>
              <span>Date</span>
              <span>Clocked in</span>
              <span>Reason</span>
              <span>What to do</span>
            </div>
            {unmatched.length === 0 ? (
              <p className="border-t border-border/60 px-5 py-6 text-sm text-muted-foreground">
                Nothing needs a manual fix.
              </p>
            ) : (
              unmatched.map((entry) => {
                const reason = describeUnmatched(entry)
                return (
                  <div
                    key={entry.timeEntryId}
                    className={cn(UNMATCHED_GRID, "items-center border-b border-border/60 px-5 py-[11px] last:border-0")}
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-semibold">{entry.studentName}</span>
                      <span className="font-mono text-xs text-muted-foreground md:hidden">
                        {formatEntryDate(entry.date)} · {formatEntryRange(entry.clockIn, entry.clockOut)}
                      </span>
                    </span>
                    <span className="hidden font-mono text-[13px] text-foreground/80 md:inline">
                      {formatEntryDate(entry.date)}
                    </span>
                    <span className="hidden font-mono text-[13px] md:inline">
                      {formatEntryRange(entry.clockIn, entry.clockOut)}
                    </span>
                    <span className="justify-self-start whitespace-nowrap rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-800 dark:text-amber-200">
                      {reason.label}
                    </span>
                    <span className="col-span-2 text-[13px] text-muted-foreground md:col-span-1">{reason.next}</span>
                  </div>
                )
              })
            )}
          </>
        ) : null}
      </section>
    </div>
  )
}

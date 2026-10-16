"use client"

import { useMemo, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { MoreHorizontal, Plus, RefreshCw } from "lucide-react"
import { toast } from "sonner"

import { ScheduleImportDialog } from "@/components/admin/schedules/schedule-import-dialog"
import { SetupTermWizard } from "@/components/admin/terms/setup-term-wizard"
import {
  TermExceptionDialog,
  type ExceptionDraft,
} from "@/components/admin/terms/term-exception-dialog"
import { TermForm, toTermOffDays, type TermFormValues } from "@/components/admin/terms/term-form"
import {
  ACADEMIC_CALENDAR_URL,
  parseTermOffDays,
  sortTermsByActiveStatus,
  weekdayLabel,
  type AcademicTerm,
  type TermOffDays,
} from "@/components/admin/terms/term-types"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Switch } from "@/components/ui/switch"
import { useTeamsSyncNow, useTeamsSyncStatus } from "@/hooks/use-teams-sync"
import { termsApi, type Term } from "@/lib/api/terms"
import { getOrgLocalDateString } from "@/lib/org-time"
import { queryKeys } from "@/lib/query-keys"
import {
  buildTermWeeks,
  countTermDays,
  countTermWeeks,
  currentWeekNumber,
  formatExceptionWhen,
  formatLongDate,
  formatShortDate,
  groupTermExceptions,
  summarizeCounts,
  termStatus,
  type TermStatus,
} from "@/lib/terms/term-overview"
import { cn } from "@/lib/utils"

const STATUS_PILL: Record<TermStatus, { label: string; className: string }> = {
  active: { label: "Active", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  upcoming: { label: "Upcoming", className: "border border-border bg-card text-foreground" },
  ended: { label: "Ended", className: "bg-muted text-muted-foreground" },
  inactive: { label: "Inactive", className: "bg-muted text-muted-foreground" },
}

const TABLE_GRID =
  "grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_70px_minmax(0,1.4fr)_100px_110px] gap-3"

function toAcademicTerm(term: Term): AcademicTerm {
  return {
    id: term.id,
    name: term.name ?? "",
    start_date: term.start_date ?? "",
    end_date: term.end_date ?? "",
    is_active: Boolean(term.is_active),
    remote_shifts_allowed: term.remote_shifts_allowed,
    off_days: parseTermOffDays(term.off_days),
  }
}

function formatSyncTime(value: string | null): string {
  if (!value) return "Never"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const time = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
  return getOrgLocalDateString(date) === getOrgLocalDateString() ? `Today, ${time}` : date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

function TeamsSyncCard({ term, onImport }: Readonly<{ term: AcademicTerm; onImport: () => void }>) {
  const { data, isLoading, error } = useTeamsSyncStatus(term.id)
  const syncNow = useTeamsSyncNow(term.id)
  const configured = data?.graph_configured ?? false

  let status = { label: "Loading", className: "bg-muted text-muted-foreground" }
  if (syncNow.isPending) status = { label: "Syncing…", className: "bg-sky-500/15 text-sky-800 dark:text-sky-200" }
  else if (!isLoading && !configured) status = { label: "Not configured", className: "bg-muted text-muted-foreground" }
  else if (data?.status === "success") status = { label: "Synced", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" }
  else if (data?.status === "error") status = { label: "Failed", className: "bg-destructive/10 text-destructive" }
  else if (!isLoading) status = { label: "Not synced yet", className: "bg-muted text-muted-foreground" }

  const rows = data
    ? [
        ["Last run", formatSyncTime(data.finished_at)],
        ["Scheduling group", data.scheduling_group ?? "—"],
        [
          "Students",
          `${data.students_matched} matched · ${data.students_created} new${data.students_deactivated ? ` · ${data.students_deactivated} deactivated` : ""}`,
        ],
        ["Schedules", `${data.total_blocks} blocks · ${data.time_off_upserted} time-off`],
      ]
    : []

  return (
    <section className="flex flex-col gap-4 rounded-[20px] border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-2.5">
        <span className="text-[15px] font-bold">Teams Shifts sync</span>
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", status.className)}>{status.label}</span>
      </div>
      <p className="text-[13px] leading-normal text-muted-foreground">
        Roster, weekly templates and time off come from Teams. Syncs run automatically every morning.
      </p>
      {!isLoading && !configured ? (
        <p className="text-[13px] text-muted-foreground">
          Microsoft Graph isn&apos;t configured on the server, so nothing is pulled from Teams.
        </p>
      ) : null}
      {rows.length > 0 ? (
        <dl className="flex flex-col gap-2.5">
          {rows.map(([key, value]) => (
            <div key={key} className="flex justify-between gap-3 text-[13px]">
              <dt className="text-muted-foreground">{key}</dt>
              <dd className="text-right font-semibold">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {data?.status === "error" && data.error_message ? (
        <p className="text-[13px] text-destructive">{data.error_message}</p>
      ) : null}
      {error || syncNow.error ? (
        <p className="text-[13px] text-destructive">
          {(syncNow.error ?? error) instanceof Error ? (syncNow.error ?? error)?.message : "Teams sync failed"}
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => syncNow.mutate()}
        disabled={!configured || syncNow.isPending}
        className="flex h-[38px] items-center justify-center gap-2 rounded-full border-[1.5px] border-accent bg-card text-[13px] font-bold text-accent hover:bg-accent/10 disabled:opacity-50"
      >
        <RefreshCw className={cn("size-3.5", syncNow.isPending && "animate-spin")} />
        {syncNow.isPending ? "Syncing…" : "Sync now"}
      </button>
      <button
        type="button"
        onClick={onImport}
        className="text-center text-[13px] font-semibold text-accent hover:underline"
      >
        Import a spreadsheet instead
      </button>
    </section>
  )
}

function ActiveTermCard({
  term,
  today,
  onEdit,
  onToggleRemote,
  onAddException,
}: Readonly<{
  term: AcademicTerm
  today: string
  onEdit: () => void
  onToggleRemote: (_allowed: boolean) => void
  onAddException: (_draft: ExceptionDraft) => void
}>) {
  const offDays = term.off_days ?? { vacations: [], special_schedules: [] }
  const weeks = buildTermWeeks(term.start_date, term.end_date, offDays, today)
  const counts = countTermDays(term.start_date, term.end_date, offDays)
  const exceptions = groupTermExceptions(offDays)
  const facts = [
    [counts.workingDays, "working days"],
    [counts.daysOff, counts.daysOff === 1 ? "day off" : "days off"],
    [counts.swaps, counts.swaps === 1 ? "schedule swap" : "schedule swaps"],
  ] as const

  return (
    <section className="flex min-w-0 flex-col gap-5 rounded-[20px] border border-border bg-card px-6 py-[22px]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl font-bold tracking-[-0.01em]">{term.name}</span>
            <span className={cn("rounded-full px-2.5 py-[3px] text-xs font-bold", STATUS_PILL.active.className)}>
              Active
            </span>
          </div>
          <span className="text-sm text-muted-foreground">
            {formatLongDate(term.start_date)} – {formatLongDate(term.end_date)} · Week{" "}
            {currentWeekNumber(term.start_date, term.end_date, today)} of {weeks.length}
          </span>
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="h-[34px] rounded-full border border-border bg-card px-3.5 text-[13px] font-semibold hover:bg-muted"
        >
          Edit term
        </button>
      </div>

      <div className="overflow-x-auto">
        <div
          className="grid min-w-[560px] gap-1"
          style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }}
        >
          {weeks.map((week) => {
            const allOff = week.daysOff === 5
            const mark = week.daysOff ? (allOff ? "Week off" : `${week.daysOff} off`) : week.swaps ? "Swap" : ""
            return (
              <div key={week.monday} className="flex min-w-0 flex-col gap-1.5">
                <div className="flex flex-col">
                  <span
                    className={cn(
                      "text-[11px] font-bold",
                      week.state === "current" ? "text-accent" : "text-foreground/80",
                    )}
                  >
                    W{week.index + 1}
                  </span>
                  <span className="truncate font-mono text-[10px] text-muted-foreground">
                    {formatShortDate(week.monday)}
                  </span>
                </div>
                <div
                  className={cn(
                    "h-2.5 rounded-full",
                    week.state === "past" && "bg-accent",
                    week.state === "current" && "bg-accent/15 shadow-[inset_0_0_0_2px_var(--accent)]",
                    week.state === "future" && "bg-muted",
                  )}
                />
                <span
                  className={cn(
                    "min-h-3.5 truncate text-[10px] font-bold",
                    week.swaps && !week.daysOff ? "text-accent" : "text-muted-foreground",
                  )}
                >
                  {mark}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2.5 md:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,1.3fr)]">
        {facts.map(([value, label]) => (
          <div key={label} className="flex flex-col gap-0.5 rounded-[14px] bg-muted/60 px-3.5 py-3">
            <span className="font-mono text-[22px] font-semibold">{value}</span>
            <span className="text-xs text-muted-foreground">{label}</span>
          </div>
        ))}
        <label className="col-span-3 flex cursor-pointer items-center justify-between gap-3 rounded-[14px] bg-muted/60 px-3.5 py-3 md:col-span-1">
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-sm font-bold">Remote shifts</span>
            <span className="text-xs text-muted-foreground">Blue Teams shifts count as remote</span>
          </span>
          <Switch checked={term.remote_shifts_allowed} onCheckedChange={onToggleRemote} />
        </label>
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-[15px] font-bold">Days off and schedule swaps</span>
          <div className="flex gap-2">
            {(
              [
                ["off", "Add day off"],
                ["swap", "Add schedule swap"],
              ] as const
            ).map(([kind, label]) => (
              <button
                key={kind}
                type="button"
                onClick={() => onAddException({ kind, existing: null })}
                className="h-8 rounded-full border border-border bg-card px-3 text-xs font-semibold hover:bg-muted"
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="overflow-hidden rounded-[14px] border border-border">
          {exceptions.length === 0 ? (
            <p className="px-3.5 py-4 text-sm text-muted-foreground">
              No days off or swaps. Shifts run every weekday of the term.
            </p>
          ) : (
            exceptions.map((exception) => (
              <div
                key={`${exception.kind}-${exception.start}`}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-b border-border/60 px-3.5 py-2.5 last:border-0 sm:grid-cols-[150px_minmax(0,1fr)_150px_60px]"
              >
                <span className="font-mono text-[13px] font-medium">{formatExceptionWhen(exception)}</span>
                <span className="order-3 col-span-2 truncate text-sm text-foreground/80 sm:order-none sm:col-span-1">
                  {exception.label ?? (exception.kind === "swap" ? "Schedule swap" : "Day off")}
                </span>
                <span
                  className={cn(
                    "hidden justify-self-start whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold sm:inline",
                    exception.kind === "swap" ? "bg-accent/10 text-accent" : "bg-muted text-foreground/80",
                  )}
                >
                  {exception.kind === "swap"
                    ? `Runs ${weekdayLabel(exception.swapTo)}`
                    : exception.dates.length > 1
                      ? `${exception.dates.length} days off`
                      : "Day off"}
                </span>
                <button
                  type="button"
                  onClick={() => onAddException({ kind: exception.kind, existing: exception })}
                  className="h-7 justify-self-end rounded-full px-2.5 text-xs font-semibold text-accent hover:bg-accent/10"
                >
                  Edit
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  )
}

export function TermsOverview() {
  const queryClient = useQueryClient()
  const today = getOrgLocalDateString()
  const { data: terms = [], isLoading } = useQuery({
    queryKey: queryKeys.terms.all,
    queryFn: termsApi.list,
  })

  const [setupOpen, setSetupOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [editing, setEditing] = useState<AcademicTerm | null>(null)
  const [creating, setCreating] = useState(false)
  const [exceptionDraft, setExceptionDraft] = useState<ExceptionDraft | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<AcademicTerm | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AcademicTerm | null>(null)

  const sortedTerms = useMemo(() => sortTermsByActiveStatus(terms).map(toAcademicTerm), [terms])
  const activeTerm = sortedTerms.find((term) => term.is_active && term.start_date && term.end_date)

  const invalidateTerms = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.terms.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.schedules.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.scheduleBlocks.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.teamsSync.all }),
    ])

  const updateTerm = async (term: AcademicTerm, patch: Parameters<typeof termsApi.update>[1], success: string) => {
    try {
      await termsApi.update(term.id, patch)
      await invalidateTerms()
      toast.success(success)
    } catch (err) {
      console.error("Update term failed:", err)
      toast.error("Couldn't update the term")
      throw err
    }
  }

  const handleEditSubmit = async (values: TermFormValues) => {
    if (!editing) return
    await updateTerm(
      editing,
      {
        name: values.name.trim(),
        start_date: values.start_date,
        end_date: values.end_date,
        remote_shifts_allowed: values.remote_shifts_allowed,
        off_days: toTermOffDays(values),
      },
      "Term saved",
    ).catch(() => undefined)
  }

  const handleCreateSubmit = async (values: TermFormValues) => {
    try {
      await termsApi.create({
        name: values.name.trim(),
        start_date: values.start_date,
        end_date: values.end_date,
        remote_shifts_allowed: values.remote_shifts_allowed,
        off_days: toTermOffDays(values),
      })
      await invalidateTerms()
      toast.success("Term added")
    } catch (err) {
      console.error("Create term failed:", err)
      toast.error("Couldn't add the term")
    }
  }

  const handleDelete = async (term: AcademicTerm) => {
    try {
      await termsApi.remove(term.id)
      await invalidateTerms()
      toast.success(`Deleted ${term.name}`)
    } catch (err) {
      console.error("Delete term failed:", err)
      toast.error("Couldn't delete the term")
    }
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-[28px] font-bold tracking-[-0.02em]">Terms</h1>
          <p className="text-sm text-muted-foreground">
            Dates come from the{" "}
            <a
              href={ACADEMIC_CALENDAR_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent underline-offset-4 hover:underline"
            >
              Cal Poly academic calendar
            </a>
          </p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setCreating(true)}
            title="Add a term without making it active"
            className="h-[38px] rounded-full border border-border bg-card px-3.5 text-[13px] font-semibold hover:bg-muted"
          >
            Add term
          </button>
          <button
            type="button"
            onClick={() => setSetupOpen(true)}
            className="flex h-[38px] items-center gap-2 rounded-full bg-accent px-4 text-[13px] font-bold text-accent-foreground hover:bg-accent/90"
          >
            <Plus className="size-4" />
            Set up term
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading terms...</p>
      ) : activeTerm ? (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <ActiveTermCard
            term={activeTerm}
            today={today}
            onEdit={() => setEditing(activeTerm)}
            onToggleRemote={(allowed) =>
              void updateTerm(
                activeTerm,
                { remote_shifts_allowed: allowed },
                allowed ? "Remote shifts turned on" : "Remote shifts turned off",
              ).catch(() => undefined)
            }
            onAddException={setExceptionDraft}
          />
          <TeamsSyncCard term={activeTerm} onImport={() => setImportOpen(true)} />
        </div>
      ) : (
        <section className="flex flex-col items-start gap-3 rounded-[20px] border border-dashed border-border bg-card px-6 py-8">
          <span className="text-[17px] font-bold">No active term</span>
          <span className="text-sm text-muted-foreground">
            Set up a term or make one active below to sync schedules from Teams.
          </span>
        </section>
      )}

      <section className="overflow-hidden rounded-[20px] border border-border bg-card">
        <div className="px-5 pb-2.5 pt-4 text-[15px] font-bold">All terms</div>
        <div
          className={cn(
            TABLE_GRID,
            "hidden border-b border-border/60 bg-muted/40 px-5 py-2 text-xs font-semibold text-muted-foreground md:grid",
          )}
        >
          <span>Term</span>
          <span>Dates</span>
          <span>Weeks</span>
          <span>Days off and swaps</span>
          <span>Status</span>
          <span />
        </div>
        {sortedTerms.length === 0 && !isLoading ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">No terms yet.</p>
        ) : (
          sortedTerms.map((term) => {
            const status = termStatus(term, today)
            const hasDates = Boolean(term.start_date && term.end_date)
            const offDays: TermOffDays = term.off_days ?? { vacations: [], special_schedules: [] }
            return (
              <div
                key={term.id}
                className={cn(TABLE_GRID, "items-center border-b border-border/60 px-5 py-3 last:border-0")}
              >
                <div className="flex min-w-0 flex-col">
                  <span
                    className={cn(
                      "truncate text-sm font-bold",
                      status === "ended" && "text-muted-foreground",
                    )}
                  >
                    {term.name || `Term ${term.id}`}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground md:hidden">
                    {hasDates ? `${formatShortDate(term.start_date)} – ${formatLongDate(term.end_date)}` : "No dates"}
                  </span>
                </div>
                <span className="hidden font-mono text-[13px] text-foreground/80 md:inline">
                  {hasDates ? `${formatShortDate(term.start_date)} – ${formatLongDate(term.end_date)}` : "—"}
                </span>
                <span className="hidden font-mono text-[13px] text-foreground/80 md:inline">
                  {hasDates ? countTermWeeks(term.start_date, term.end_date) : "—"}
                </span>
                <span className="hidden truncate text-[13px] text-muted-foreground md:inline">
                  {hasDates ? summarizeCounts(countTermDays(term.start_date, term.end_date, offDays)) : "—"}
                </span>
                <span
                  className={cn(
                    "hidden justify-self-start rounded-full px-2 py-0.5 text-[11px] font-bold md:inline",
                    STATUS_PILL[status].className,
                  )}
                >
                  {STATUS_PILL[status].label}
                </span>
                <div className="flex items-center justify-end gap-0.5">
                  <button
                    type="button"
                    onClick={() => setEditing(term)}
                    className="h-7 rounded-full px-2.5 text-xs font-semibold text-accent hover:bg-accent/10"
                  >
                    {status === "ended" ? "View" : "Edit"}
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                      >
                        <MoreHorizontal className="size-4" />
                        <span className="sr-only">More actions for {term.name}</span>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      {term.is_active ? (
                        <DropdownMenuItem onClick={() => setDeactivateTarget(term)}>Deactivate</DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem
                          onClick={() =>
                            void updateTerm(term, { is_active: true }, `${term.name} is now active`).catch(
                              () => undefined,
                            )
                          }
                        >
                          Make active
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(term)}>
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            )
          })
        )}
      </section>

      <SetupTermWizard open={setupOpen} onOpenChange={setSetupOpen} />

      {activeTerm ? (
        <>
          <ScheduleImportDialog
            open={importOpen}
            onOpenChange={setImportOpen}
            termId={activeTerm.id}
            termName={activeTerm.name}
          />
          <TermExceptionDialog
            draft={exceptionDraft}
            onOpenChange={(open) => {
              if (!open) setExceptionDraft(null)
            }}
            termStart={activeTerm.start_date}
            termEnd={activeTerm.end_date}
            offDays={activeTerm.off_days ?? { vacations: [], special_schedules: [] }}
            onSave={(offDays) => updateTerm(activeTerm, { off_days: offDays }, "Days off updated")}
          />
        </>
      ) : null}

      <TermForm
        key={editing?.id ?? (creating ? "new" : "none")}
        open={editing !== null || creating}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null)
            setCreating(false)
          }
        }}
        term={editing}
        existingTerms={sortedTerms}
        onSubmit={editing ? handleEditSubmit : handleCreateSubmit}
      />

      <AlertDialog
        open={deactivateTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeactivateTarget(null)
        }}
      >
        <AlertDialogContent className="border-border bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate term?</AlertDialogTitle>
            <AlertDialogDescription>
              {deactivateTarget
                ? `${deactivateTarget.name} will be marked inactive and Teams sync will stop for it. You can make it active again later.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deactivateTarget) {
                  void updateTerm(deactivateTarget, { is_active: false }, `${deactivateTarget.name} deactivated`).catch(
                    () => undefined,
                  )
                }
              }}
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent className="border-border bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete term?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `${deleteTarget.name} will be permanently removed along with its schedules and schedule blocks. Time entries will be kept, but unlinked from deleted blocks. This action cannot be undone.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (deleteTarget) void handleDelete(deleteTarget)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

"use client"

import { Fragment, useMemo, useState } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { CalendarDays, Star } from "lucide-react"

import { Panel, StatCard } from "@/components/admin/schedule-builder/builder-ui"
import type { BuilderContext } from "@/components/admin/schedule-builder/schedule-builder"
import { TeamsPublishPanel } from "@/components/admin/schedule-builder/teams-publish-panel"
import { formatTermDate, type Weekday } from "@/components/admin/terms/term-types"
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
import { scheduleDraftsApi, type ShiftRole } from "@/lib/api/schedule-drafts"
import { queryKeys } from "@/lib/query-keys"
import {
  DAY_SHORT,
  WEEKDAYS,
  assignedSlots,
  availableHours,
  computeChecks,
  deskHours,
  hoursLabel,
  hourShort,
  roleAt,
  slotRange,
  summarizeCells,
  toRuns,
  type DraftChecks,
} from "@/lib/schedule-builder/model"
import { cn } from "@/lib/utils"

const GROUPS: { role: ShiftRole; label: string }[] = [
  { role: "L", label: "Leads" },
  { role: "m", label: "Main desk" },
  { role: "t", label: "Training" },
]

export function StepPublish(context: Readonly<BuilderContext>) {
  const { draft, people, nameOf, goTo, flush } = context
  const checks = useMemo(() => computeChecks(draft.people, draft.rules), [draft.people, draft.rules])
  const noAvailability = people.filter((person) => availableHours(person) === 0).length

  // Re-compare whenever any shift changes; flush first so the server sees the latest edits.
  const signature = useMemo(
    () =>
      draft.people
        .map((person) => `${person.student_assistant_id}:${WEEKDAYS.map((day) => assignedSlots(person, day).join(",")).join("|")}`)
        .join(";"),
    [draft.people],
  )
  const previewQuery = useQuery({
    queryKey: [...queryKeys.scheduleDrafts.preview(draft.id), signature],
    queryFn: async () => {
      await flush()
      return scheduleDraftsApi.publishPreview(draft.id)
    },
  })
  const teamsEnabled = previewQuery.data?.teams_sync_enabled ?? false

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          <StatCard
            label="Desk hours"
            value={hoursLabel(checks.totalHours)}
            sub={draft.rules.weekly_budget.enabled ? `of ${draft.rules.weekly_budget.hours}h budget` : "per week"}
            tone={checks.overBudget ? "warn" : undefined}
          />
          <StatCard label="Shifts" value={checks.totalShifts} sub="weekly, repeating" />
          <StatCard
            label="No-lead hours"
            value={checks.noLead.length / 2}
            sub={checks.noLead.length ? summarizeCells(checks.noLead) : "none"}
            tone={checks.noLead.length ? "bad" : "good"}
          />
          <StatCard
            label="Outside requests"
            value={checks.outOfRange.length}
            sub="people"
            tone={checks.outOfRange.length ? "warn" : "good"}
          />
        </div>

        <HeadcountByHour context={context} checks={checks} />
      </div>

      <div className="flex flex-col gap-3.5">
        {previewQuery.isLoading ? (
          <Panel className="px-5 py-[18px] text-[13px] text-muted-foreground">Checking where to publish…</Panel>
        ) : teamsEnabled ? (
          <TeamsPublishPanel context={context} checks={checks} />
        ) : (
          <ClockedInPublishPanel context={context} checks={checks} preview={previewQuery.data} error={previewQuery.error} />
        )}

        <Panel className="flex flex-col gap-2 px-5 py-4">
          <span className="text-sm font-bold">Still open</span>
          {checks.noLead.length === 0 && checks.outOfRange.length === 0 && noAvailability === 0 ? (
            <span className="text-[13px] text-muted-foreground">Nothing. Every hour has a lead and everyone is in range.</span>
          ) : null}
          {checks.noLead.length > 0 ? <OpenItem tone="bad">No lead on {summarizeCells(checks.noLead, 4)}</OpenItem> : null}
          {checks.outOfRange.length > 0 ? (
            <OpenItem tone="warn">
              {checks.outOfRange
                .slice(0, 4)
                .map((person) => nameOf(person.student_assistant_id))
                .join(", ")}
              {checks.outOfRange.length > 4 ? ` +${checks.outOfRange.length - 4}` : ""} outside their requested hours
            </OpenItem>
          ) : null}
          {noAvailability > 0 ? (
            <OpenItem tone="warn">{noAvailability} people have no availability and aren&apos;t scheduled</OpenItem>
          ) : null}
          <button type="button" onClick={() => goTo(3)} className="self-start text-[13px] font-semibold text-accent hover:underline">
            Back to review
          </button>
        </Panel>
      </div>
    </div>
  )
}

/** Shown per group in the "who's on" panel before collapsing the rest into "+N". */
const GROUP_CAP: Record<ShiftRole, number> = { L: 3, m: 5, t: 3 }

/** 14.4 headcount grid: people on desk per hour with ★ lead pills; the panel above shows everyone on the picked hour. */
function HeadcountByHour({ context, checks }: Readonly<{ context: BuilderContext; checks: DraftChecks }>) {
  const { draft, people, nameOf, students } = context
  const hours = deskHours(draft.rules)
  const [selected, setSelected] = useState<{ day: Weekday; hour: number }>({ day: "monday", hour: hours[0] ?? 8 })
  const minOnDesk = draft.rules.min_on_desk.enabled ? draft.rules.min_on_desk.value : 1
  const firstName = (studentId: number) => students.get(studentId)?.first_name?.trim() || nameOf(studentId)

  const hourSlots = (hour: number) =>
    [hour * 2, hour * 2 + 1].filter((slot) => slot >= draft.rules.desk_start_slot && slot < draft.rules.desk_end_slot)
  const onDuring = (day: Weekday, hour: number) =>
    people.flatMap((person) => {
      const slot = hourSlots(hour).find((s) => roleAt(person, day, s))
      if (slot == null) return []
      const run = toRuns(assignedSlots(person, day)).find(([a, b]) => slot >= a && slot < b)!
      return [{ person, role: roleAt(person, day, slot)!, run }]
    })
  const stats = (day: Weekday, hour: number) => {
    const slots = hourSlots(hour)
    const all = Math.min(...slots.map((slot) => checks.headcount(day, slot)))
    const leadCount = Math.min(...slots.map((slot) => checks.leads(day, slot)))
    return { all, leadCount, noLead: draft.rules.lead_every_slot.enabled && leadCount === 0, thin: all < minOnDesk }
  }

  const picked = stats(selected.day, selected.hour)
  const pickedEntries = onDuring(selected.day, selected.hour)

  return (
    <Panel className="flex flex-col gap-2.5 px-5 py-[18px]">
      <div className="flex flex-col gap-0.5">
        <span className="text-base font-bold">Headcount by hour</span>
        <span className="text-xs text-muted-foreground">
          People on the desk each hour. ★ pills are the leads on duty. Click an hour to see everyone.
        </span>
      </div>

      <div className="grid h-[132px] gap-3.5 overflow-hidden rounded-[14px] border border-border bg-muted/40 px-4 py-3 md:grid-cols-[150px_minmax(0,1fr)_minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-sm font-semibold">
            {DAY_SHORT[selected.day]} {hourShort(selected.hour)}
          </span>
          <span
            className={cn(
              "text-xs font-bold",
              picked.noLead ? "text-destructive" : picked.thin ? "text-amber-700 dark:text-amber-300" : "text-accent",
            )}
          >
            {picked.all} on desk · {picked.noLead ? "no lead" : `${picked.leadCount} lead${picked.leadCount === 1 ? "" : "s"}`}
          </span>
        </div>
        {GROUPS.map(({ role, label }) => {
          const all = pickedEntries.filter((entry) => entry.role === role)
          const cap = GROUP_CAP[role]
          const cut = all.length > cap
          const shown = cut ? all.slice(0, cap - 1) : all
          const rest = cut ? all.slice(cap - 1) : []
          return (
            <div key={role} className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
                {label} · {all.length}
              </span>
              <div className="flex flex-wrap gap-[5px] overflow-hidden">
                {all.length === 0 ? <span className="flex h-6 items-center text-[13px] text-muted-foreground">—</span> : null}
                {shown.map(({ person, run }) => (
                  <span
                    key={person.student_assistant_id}
                    className={cn(
                      "flex h-6 items-center gap-[5px] rounded-full border px-[9px] text-xs whitespace-nowrap",
                      role === "L"
                        ? "border-role-lead bg-role-lead font-bold text-role-foreground"
                        : role === "t"
                          ? "border-role-training/40 bg-card font-semibold"
                          : "border-role-main/40 bg-card font-semibold",
                    )}
                  >
                    {role === "L" ? <Star className="size-[9px] fill-amber-300 text-amber-300" /> : null}
                    {nameOf(person.student_assistant_id)}
                    <span className="font-mono font-medium opacity-70">{slotRange(run[0], run[1])}</span>
                  </span>
                ))}
                {rest.length > 0 ? (
                  <span
                    title={rest.map(({ person, run }) => `${nameOf(person.student_assistant_id)} ${slotRange(run[0], run[1])}`).join(", ")}
                    className="flex h-6 cursor-default items-center rounded-full border border-border bg-card px-[9px] text-xs font-bold"
                  >
                    +{rest.length}
                  </span>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-[64px_repeat(5,minmax(0,1fr))] gap-1">
        <span />
        {WEEKDAYS.map((day) => (
          <span key={day} className="text-center text-[13px] font-bold">
            {DAY_SHORT[day]}
          </span>
        ))}
        {hours.map((hour) => (
          <Fragment key={hour}>
            <span className="self-center font-mono text-xs text-muted-foreground">{hourShort(hour)}</span>
            {WEEKDAYS.map((day) => {
              const { all, leadCount, noLead, thin } = stats(day, hour)
              const leads = onDuring(day, hour).filter((entry) => entry.role === "L")
              const on = selected.day === day && selected.hour === hour
              return (
                <button
                  key={day}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setSelected({ day, hour })}
                  title={onDuring(day, hour).map(({ person }) => nameOf(person.student_assistant_id)).join(", ") || "Nobody on"}
                  className={cn(
                    "flex h-[42px] items-center justify-between gap-1.5 overflow-hidden rounded-[10px] border px-2",
                    noLead
                      ? "border-destructive/30 bg-destructive/10"
                      : thin
                        ? "border-amber-500/30 bg-amber-500/15"
                        : "border-transparent bg-accent/10",
                    on && "outline-[3px] outline-offset-2 outline-foreground",
                  )}
                >
                  <span className="font-mono text-base font-semibold">{all}</span>
                  <span className="flex min-w-0 gap-[3px] overflow-hidden">
                    {noLead ? (
                      <span className="flex h-[18px] items-center rounded-full border-[1.5px] border-destructive px-[7px] text-[10px] font-bold whitespace-nowrap text-destructive">
                        No lead
                      </span>
                    ) : (
                      <>
                        {leads.slice(0, 1).map(({ person }) => (
                          <span
                            key={person.student_assistant_id}
                            className="flex h-[18px] items-center gap-[3px] rounded-full bg-role-lead pr-[7px] pl-[5px] text-[10px] font-bold whitespace-nowrap text-role-foreground"
                          >
                            <Star className="size-2 fill-amber-300 text-amber-300" />
                            {firstName(person.student_assistant_id)}
                          </span>
                        ))}
                        {leads.length > 1 ? (
                          <span className="flex h-[18px] items-center rounded-full bg-role-lead px-[6px] text-[10px] font-bold text-role-foreground">
                            +{leads.length - 1}
                          </span>
                        ) : null}
                      </>
                    )}
                  </span>
                </button>
              )
            })}
          </Fragment>
        ))}
      </div>
    </Panel>
  )
}

/** Publishing into ClockedIn's own schedules, for setups without Teams Shifts. */
function ClockedInPublishPanel({
  context,
  checks,
  preview,
  error,
}: Readonly<{
  context: BuilderContext
  checks: DraftChecks
  preview: Awaited<ReturnType<typeof scheduleDraftsApi.publishPreview>> | undefined
  error: unknown
}>) {
  const { draft, runPublish, busy, termName } = context
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [justPublished, setJustPublished] = useState(false)
  const term = preview?.term
  const published = draft.status === "published"
  // Publishing logs last, so any later entry means there are unpublished edits.
  const upToDate = published && (draft.change_log[draft.change_log.length - 1]?.text.startsWith("Published") ?? false)

  const publish = async () => {
    setConfirmOpen(false)
    if (await runPublish()) setJustPublished(true)
  }

  return (
    <Panel className="flex flex-col gap-3 px-5 py-[18px]">
      <div className="flex items-center gap-2.5">
        <span className="flex size-8 items-center justify-center rounded-[9px] bg-role-training/15 text-role-training">
          <CalendarDays className="size-[17px]" />
        </span>
        <span className="text-base font-bold">Publish to Schedules</span>
      </div>
      <div className="flex flex-col gap-2 text-[13px]">
        <Row label="Term" value={term?.name ?? termName} />
        <Row
          label="Repeats weekly"
          value={term?.start_date && term.end_date ? `${formatTermDate(term.start_date)} – ${formatTermDate(term.end_date)}` : "Term dates not set"}
        />
        <Row
          label="Skips"
          value={term && term.skips.length > 0 ? `${term.skips.map((skip) => formatTermDate(skip.date)).join(", ")} (from Terms)` : "None"}
        />
      </div>
      <div className="flex flex-col gap-1.5 rounded-[14px] bg-muted/50 px-3.5 py-3">
        <span className="text-xs font-bold">Compared with Schedules now</span>
        {!preview && !error ? (
          <span className="text-[13px] text-muted-foreground">Comparing...</span>
        ) : error || !preview ? (
          <span className="text-[13px] text-destructive">Couldn&apos;t compare with current schedules.</span>
        ) : (
          <>
            <Diff label="New shifts" value={`+${preview.new_shifts}`} className="text-accent" />
            <Diff label="Removed shifts" value={`−${preview.removed_shifts}`} className="text-destructive" />
            <Diff label="Unchanged (entries stay linked)" value={String(preview.unchanged_shifts)} />
            <Diff label="Students affected" value={String(preview.students_affected)} />
          </>
        )}
      </div>
      {justPublished || upToDate ? (
        <div className="flex flex-col gap-0.5 rounded-[14px] bg-accent/15 px-3.5 py-3">
          <span className="text-sm font-bold text-accent">Published to Schedules</span>
          <span className="text-xs text-accent">
            {checks.totalShifts} shifts saved for {termName}.{" "}
            <Link href="/admin/schedules" className="font-semibold underline">
              View in Schedules
            </Link>
          </span>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy === "publish" || checks.totalShifts === 0}
          onClick={() => setConfirmOpen(true)}
          className="h-11 rounded-full bg-primary text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {busy === "publish" ? "Publishing..." : published ? `Publish changes (${checks.totalShifts} shifts)` : `Publish ${checks.totalShifts} shifts`}
        </button>
      )}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="border-border bg-card">
          <AlertDialogHeader>
            <AlertDialogTitle>Publish {checks.totalShifts} shifts?</AlertDialogTitle>
            <AlertDialogDescription>
              This replaces each student&apos;s weekly schedule for {termName}
              {preview ? ` (${preview.students_affected} students change)` : ""}. Shifts that don&apos;t change keep their
              clock-in history linked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void publish()}>Publish</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Panel>
  )
}

export function Row({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-bold">{value}</span>
    </div>
  )
}

export function Diff({ label, value, className }: Readonly<{ label: string; value: string; className?: string }>) {
  return (
    <div className="flex justify-between text-[13px]">
      <span>{label}</span>
      <span className={cn("font-mono font-semibold", className)}>{value}</span>
    </div>
  )
}

function OpenItem({ tone, children }: Readonly<{ tone: "warn" | "bad"; children: React.ReactNode }>) {
  return (
    <div className="flex items-start gap-2 text-[13px] leading-[1.4]">
      <span className={cn("mt-[5px] size-2 shrink-0 rounded-full", tone === "bad" ? "bg-destructive" : "bg-amber-500")} />
      <span>{children}</span>
    </div>
  )
}

"use client"

import { useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"
import { format, parseISO } from "date-fns"
import { Clock, Download } from "lucide-react"

import { Panel, Segmented, StatCard } from "@/components/admin/schedule-builder/builder-ui"
import { weekdayLabel, type Weekday } from "@/components/admin/terms/term-types"
import { useTeamsSyncStatus } from "@/hooks/use-teams-sync"
import type { DraftPerson, ScheduleDraft } from "@/lib/api/schedule-drafts"
import { scheduleBlocksApi } from "@/lib/api/scheduleBlocks"
import { schedulesApi } from "@/lib/api/schedules"
import type { StudentAssistant } from "@/lib/api/student-assistants"
import type { Term } from "@/lib/api/terms"
import { formatTimeAgo } from "@/lib/format-time"
import { getOrgLocalDateString } from "@/lib/org-time"
import { queryKeys } from "@/lib/query-keys"
import {
  buildLiveWeek,
  compactRange,
  currentWeekIndex,
  onDeskDuring,
  termWeeks,
  type LiveDay,
  type LiveRole,
  type LiveShift,
} from "@/lib/schedule-builder/live-schedule"
import { DAY_SHORT, DEFAULT_DESK, hourShort, hoursLabel, requestedLabel } from "@/lib/schedule-builder/model"
import { cn } from "@/lib/utils"

type RoleFilter = "all" | LiveRole
type View = "calendar" | "people"

const ROLE_SWATCH: Record<LiveRole, string> = { L: "bg-role-lead", m: "bg-role-main" }
const ROLE_NAME: Record<LiveRole, string> = { L: "Lead", m: "Main" }

const dayDate = (date: string) => format(parseISO(date), "MMM d")

interface CurrentScheduleProps {
  term: Term
  students: Map<number, StudentAssistant>
  nameOf: (_studentId: number) => string
  /** Latest draft for the term, for requested hours, budget and desk rules. */
  draft: ScheduleDraft | null
  /** Term picker, rendered in the header. */
  termPicker?: ReactNode
  primaryAction: { label: string; onClick: () => void; disabled?: boolean }
}

/** 14.0 · read-only view of the term schedule that's live right now. */
export function CurrentSchedule({ term, students, nameOf, draft, termPicker, primaryAction }: Readonly<CurrentScheduleProps>) {
  const { data: schedules = [], isLoading: schedulesLoading } = useQuery({
    queryKey: queryKeys.schedules.all,
    queryFn: schedulesApi.list,
  })
  const { data: blocks = [], isLoading: blocksLoading } = useQuery({
    queryKey: queryKeys.scheduleBlocks.all,
    queryFn: scheduleBlocksApi.list,
  })
  const { data: syncStatus } = useTeamsSyncStatus(term.id)

  const weeks = useMemo(() => termWeeks(term), [term])
  const today = getOrgLocalDateString()
  const nowIndex = currentWeekIndex(weeks, today)
  const [weekIndex, setWeekIndex] = useState<number | null>(null)
  const [role, setRole] = useState<RoleFilter>("all")
  const [view, setView] = useState<View>("calendar")

  const week = weeks[weekIndex ?? nowIndex]
  const days = useMemo(
    () => (week ? buildLiveWeek(week, term, schedules, blocks, students) : []),
    [week, term, schedules, blocks, students],
  )

  const rules = draft?.rules
  const deskStart = (rules?.desk_start_slot ?? DEFAULT_DESK.desk_start_slot) * 30
  const deskEnd = (rules?.desk_end_slot ?? DEFAULT_DESK.desk_end_slot) * 30
  const minOnDesk = rules?.min_on_desk.enabled ? rules.min_on_desk.value : 3
  const requested = useMemo(
    () => new Map<number, DraftPerson>((draft?.people ?? []).map((person) => [person.student_assistant_id, person])),
    [draft?.people],
  )

  const allShifts = days.flatMap((day) => day.shifts)
  // Show every hour that has a shift, even outside the usual desk hours.
  const firstHour = Math.floor(Math.min(deskStart, ...allShifts.map((shift) => shift.start)) / 60)
  const lastHour = Math.ceil(Math.max(deskEnd, ...allShifts.map((shift) => shift.end)) / 60)
  const hours = Array.from({ length: Math.max(0, lastHour - firstHour) }, (_, index) => firstHour + index)
  const openDays = days.filter((day) => !day.closedLabel)

  const totalMinutes = allShifts.reduce((sum, shift) => sum + shift.end - shift.start, 0)
  const people = new Set(allShifts.map((shift) => shift.studentId))
  const noLeadHours = openDays.flatMap((day) =>
    hours
      .filter((hour) => hour * 60 >= deskStart && hour * 60 < deskEnd)
      .filter((hour) => !onDeskDuring(day, hour * 60, hour * 60 + 60).some((shift) => shift.role === "L"))
      .map((hour) => `${DAY_SHORT[day.weekday]} ${hourShort(hour)}`),
  )

  const keep = (shift: LiveShift) => role === "all" || shift.role === role
  const closedDays = days.filter((day) => day.closedLabel && day.closedLabel !== "Outside the term")
  const swapped = days.filter((day) => day.runsAs)
  const isPast = (weekIndex ?? nowIndex) < nowIndex
  const notes = [
    ...closedDays.map((day) => `${weekdayLabel(day.weekday)} ${dayDate(day.date)}: ${day.closedLabel}. The desk is closed and no shifts run that day.`),
    ...swapped.map((day) => `${weekdayLabel(day.weekday)} ${dayDate(day.date)} runs the ${weekdayLabel(day.runsAs!)} schedule.`),
    ...(isPast ? ["This week has already been worked. Hours shown are what was scheduled; actual punches are in Timesheet Verification."] : []),
  ]

  const exportCsv = () => {
    const rows = [["Date", "Day", "Name", "Role", "Start", "End", "Remote"]]
    for (const day of days) {
      for (const shift of [...day.shifts].sort((a, b) => a.start - b.start)) {
        const time = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
        rows.push([day.date, weekdayLabel(day.weekday), nameOf(shift.studentId), ROLE_NAME[shift.role], time(shift.start), time(shift.end), shift.remote ? "yes" : "no"])
      }
    }
    const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n")
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
    const link = document.createElement("a")
    link.href = url
    link.download = `${term.name ?? "schedule"} week ${(weekIndex ?? nowIndex) + 1}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const updated = syncStatus?.finished_at
    ? `synced from Teams ${formatTimeAgo(syncStatus.finished_at)}`
    : draft?.published_at
      ? `published ${formatTimeAgo(draft.published_at)}`
      : null

  return (
    <div className="flex flex-col gap-3.5">
      <Panel className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex size-[30px] items-center justify-center rounded-[9px] bg-primary text-primary-foreground">
            <Clock className="size-4" />
          </span>
          <span className="text-base font-bold">{term.name ?? "Term"} schedule</span>
          <span className="rounded-full bg-accent/15 px-2.5 py-1 text-xs font-bold text-accent">
            {syncStatus?.graph_configured ? "Live in Teams" : "Live"}
          </span>
          {updated ? <span className="font-mono text-xs text-muted-foreground">{updated}</span> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {termPicker}
          <button
            type="button"
            onClick={exportCsv}
            disabled={allShifts.length === 0}
            className="flex h-[34px] items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-[13px] font-semibold hover:bg-muted disabled:opacity-50"
          >
            <Download className="size-3.5" />
            Export CSV
          </button>
          <Link
            href={`/admin/schedules`}
            className="flex h-[34px] items-center rounded-full border border-accent/30 bg-accent/10 px-3.5 text-[13px] font-bold text-accent hover:bg-accent/20"
          >
            Change shifts
          </Link>
          <button
            type="button"
            onClick={primaryAction.onClick}
            disabled={primaryAction.disabled}
            className="h-[34px] rounded-full bg-primary px-4 text-[13px] font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {primaryAction.label}
          </button>
        </div>
      </Panel>

      {schedulesLoading || blocksLoading ? (
        <p className="text-sm text-muted-foreground">Loading the current schedule...</p>
      ) : weeks.length === 0 ? (
        <Panel className="px-5 py-6 text-sm text-muted-foreground">
          Set this term&apos;s start and end dates in Terms to see its weeks.
        </Panel>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <StatCard
              label="Desk hours this week"
              value={hoursLabel(totalMinutes / 60)}
              sub={rules?.weekly_budget.enabled ? `of ${rules.weekly_budget.hours}h budget` : "scheduled"}
            />
            <StatCard label="Shifts" value={allShifts.length} sub={`across ${people.size} people`} />
            <StatCard
              label="Hours with no lead"
              value={noLeadHours.length}
              sub={noLeadHours.length ? noLeadHours.slice(0, 3).join(", ") + (noLeadHours.length > 3 ? ` +${noLeadHours.length - 3}` : "") : "all covered"}
              tone={noLeadHours.length ? "bad" : "good"}
            />
            <StatCard
              label="Week"
              value={`W${(weekIndex ?? nowIndex) + 1} of ${weeks.length}`}
              sub={`Mon ${dayDate(week.dates[0])} – Fri ${dayDate(week.dates[4])}`}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-[3px]">
              {weeks.map((entry) => {
                const on = entry.index === (weekIndex ?? nowIndex)
                const past = entry.index < nowIndex
                return (
                  <button
                    key={entry.monday}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setWeekIndex(entry.index)}
                    title={`Week of ${dayDate(entry.monday)}${past ? " · already worked" : ""}`}
                    className={cn(
                      "flex h-10 min-w-[58px] flex-col items-center justify-center rounded-[9px] border px-1.5 leading-[1.15]",
                      on ? "border-foreground bg-foreground text-background" : "border-border bg-card hover:bg-muted",
                    )}
                  >
                    <span className={cn("text-[11px] font-bold", !on && past && "text-muted-foreground")}>
                      W{entry.index + 1}
                      {entry.index === nowIndex ? " · now" : ""}
                    </span>
                    <span className={cn("font-mono text-[10px]", on ? "opacity-70" : "text-muted-foreground")}>
                      {dayDate(entry.monday)}
                    </span>
                  </button>
                )
              })}
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <Segmented
                options={[
                  { value: "all", label: <><span className="size-2.5 rounded-[3px] bg-border" />Everyone</> },
                  { value: "L", label: <><span className="size-2.5 rounded-[3px] bg-role-lead" />Leads</> },
                  { value: "m", label: <><span className="size-2.5 rounded-[3px] bg-role-main" />Main</> },
                ]}
                value={role}
                onChange={setRole}
              />
              <Segmented
                options={[
                  { value: "calendar", label: "Calendar" },
                  { value: "people", label: "By person" },
                ]}
                value={view}
                onChange={setView}
              />
            </div>
          </div>

          {notes.map((note) => (
            <div key={note} className="rounded-xl bg-amber-500/15 px-3.5 py-2.5 text-[13px] font-semibold text-amber-800 dark:text-amber-200">
              {note}
            </div>
          ))}

          {allShifts.length === 0 && closedDays.length < 5 ? (
            <Panel className="flex flex-col items-start gap-1 px-5 py-6">
              <span className="text-sm font-semibold">Nothing scheduled this week</span>
              <span className="text-[13px] text-muted-foreground">
                No one has shifts for {term.name ?? "this term"} yet. Start a new term schedule to build one.
              </span>
            </Panel>
          ) : view === "calendar" ? (
            <CalendarView days={days} hours={hours} keep={keep} minOnDesk={minOnDesk} nameOf={nameOf} students={students} />
          ) : (
            <PeopleView days={days} keep={keep} nameOf={nameOf} requested={requested} />
          )}
        </>
      )}
    </div>
  )
}

function firstName(students: Map<number, StudentAssistant>, nameOf: (_id: number) => string, studentId: number) {
  return students.get(studentId)?.first_name?.trim() || nameOf(studentId)
}

/** Shown next to a name when the shift starts or ends inside the hour, e.g. ":30" or "→:30". */
function partial(shift: LiveShift, hour: number): string {
  const startsInside = shift.start > hour * 60
  const endsInside = shift.end < hour * 60 + 60
  if (startsInside) return `:${String(shift.start % 60).padStart(2, "0")}`
  if (endsInside) return `→:${String(shift.end % 60).padStart(2, "0")}`
  return ""
}

function CalendarView({
  days,
  hours,
  keep,
  minOnDesk,
  nameOf,
  students,
}: Readonly<{
  days: LiveDay[]
  hours: number[]
  keep: (_shift: LiveShift) => boolean
  minOnDesk: number
  nameOf: (_id: number) => string
  students: Map<number, StudentAssistant>
}>) {
  return (
    <Panel className="overflow-x-auto px-4 py-3.5">
      <div className="flex min-w-[900px] flex-col gap-1">
        <div className="grid grid-cols-[64px_repeat(5,minmax(0,1fr))] gap-1.5 pb-1">
          <span />
          {days.map((day) => (
            <div key={day.date} className="flex items-baseline justify-between">
              <span className={cn("text-sm font-bold", day.closedLabel && "text-muted-foreground")}>
                {weekdayLabel(day.weekday)}
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">{dayDate(day.date)}</span>
            </div>
          ))}
        </div>
        {hours.map((hour, row) => (
          <div key={hour} className="grid grid-cols-[64px_repeat(5,minmax(0,1fr))] items-stretch gap-1.5 border-t border-border/60 pt-1.5">
            <span className="pt-1 font-mono text-xs text-muted-foreground">{hourShort(hour)}</span>
            {days.map((day) => {
              if (day.closedLabel) {
                return (
                  <div
                    key={day.date}
                    className="min-h-11 rounded-[10px] bg-[repeating-linear-gradient(45deg,var(--muted)_0_6px,transparent_6px_12px)] px-2 py-1.5 text-[11px] font-bold text-muted-foreground"
                  >
                    {row === 0 ? "Closed" : ""}
                  </div>
                )
              }
              const on = onDeskDuring(day, hour * 60, hour * 60 + 60)
              const leads = on.filter((shift) => shift.role === "L").length
              const remote = day.shifts.filter((shift) => shift.remote && shift.start < hour * 60 + 60 && shift.end > hour * 60)
              const shown = [...on, ...remote].filter(keep).sort((a, b) => (a.role === b.role ? a.start - b.start : a.role === "L" ? -1 : 1))
              const noLead = on.length > 0 && leads === 0
              return (
                <div
                  key={day.date}
                  className={cn(
                    "flex min-h-11 flex-col gap-1 rounded-[10px] px-2 py-1.5",
                    on.length === 0 ? "bg-muted/40" : noLead ? "bg-destructive/10" : on.length < minOnDesk ? "bg-amber-500/15" : "bg-muted/60",
                  )}
                >
                  {on.length > 0 || remote.length > 0 ? (
                    <div
                      className={cn(
                        "flex justify-between text-[11px] font-bold",
                        noLead ? "text-destructive" : on.length < minOnDesk ? "text-amber-800 dark:text-amber-200" : "text-muted-foreground",
                      )}
                    >
                      <span>{on.length} on</span>
                      <span>{leads ? `${leads} lead${leads > 1 ? "s" : ""}` : "no lead"}</span>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap gap-[3px]">
                    {shown.map((shift) => (
                      <span
                        key={`${shift.studentId}-${shift.start}`}
                        title={`${nameOf(shift.studentId)} · ${ROLE_NAME[shift.role]} · ${compactRange(shift.start, shift.end)}${shift.remote ? " · remote" : ""}`}
                        className={cn(
                          "flex h-5 items-center gap-1 rounded-md border bg-card pr-[7px] pl-1 text-[11px] font-semibold whitespace-nowrap",
                          shift.remote ? "border-dashed border-muted-foreground/50 text-muted-foreground" : "border-border",
                        )}
                      >
                        <span className={cn("size-2 rounded-[2px]", ROLE_SWATCH[shift.role])} />
                        {firstName(students, nameOf, shift.studentId)}
                        {shift.remote ? <span className="font-medium">remote</span> : null}
                        <span className="font-mono font-medium text-amber-700 dark:text-amber-300">{partial(shift, hour)}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </Panel>
  )
}

function PeopleView({
  days,
  keep,
  nameOf,
  requested,
}: Readonly<{
  days: LiveDay[]
  keep: (_shift: LiveShift) => boolean
  nameOf: (_id: number) => string
  requested: Map<number, DraftPerson>
}>) {
  const byPerson = new Map<number, { role: LiveRole; byDay: Map<Weekday, LiveShift[]>; minutes: number }>()
  for (const day of days) {
    for (const shift of day.shifts) {
      if (!keep(shift)) continue
      const entry = byPerson.get(shift.studentId) ?? { role: shift.role, byDay: new Map(), minutes: 0 }
      entry.byDay.set(day.weekday, [...(entry.byDay.get(day.weekday) ?? []), shift])
      entry.minutes += shift.end - shift.start
      byPerson.set(shift.studentId, entry)
    }
  }
  const rows = [...byPerson.entries()].sort(
    ([a, x], [b, y]) => (x.role === y.role ? nameOf(a).localeCompare(nameOf(b)) : x.role === "L" ? -1 : 1),
  )

  let lastRole: LiveRole | null = null
  return (
    <Panel className="overflow-x-auto px-4 pt-2.5 pb-3.5">
      <div className="flex min-w-[900px] flex-col">
        <div className="grid grid-cols-[160px_repeat(5,minmax(0,1fr))_110px] gap-2.5 border-b border-border py-1.5 text-xs font-bold text-muted-foreground">
          <span>Person</span>
          {days.map((day) => (
            <span key={day.date} className={cn(!day.closedLabel && "text-foreground")}>
              {DAY_SHORT[day.weekday]} <span className="font-mono font-medium text-muted-foreground">{dayDate(day.date)}</span>
            </span>
          ))}
          <span className="text-right">Week</span>
        </div>
        {rows.map(([studentId, entry]) => {
          const head = entry.role !== lastRole ? (entry.role === "L" ? "Leads" : "Students") : null
          lastRole = entry.role
          const person = requested.get(studentId)
          return (
            <div key={studentId} className="flex flex-col">
              {head ? (
                <span className="pt-2.5 pb-1 text-[11px] font-bold tracking-[0.1em] text-muted-foreground uppercase">{head}</span>
              ) : null}
              <div className="grid grid-cols-[160px_repeat(5,minmax(0,1fr))_110px] items-center gap-2.5 border-t border-border/50 py-[5px]">
                <span className="truncate text-[13px] font-semibold">{nameOf(studentId)}</span>
                {days.map((day) => {
                  const shifts = (entry.byDay.get(day.weekday) ?? []).sort((a, b) => a.start - b.start)
                  return (
                    <div key={day.date} className="flex min-h-6 flex-wrap items-center gap-1">
                      {shifts.length === 0 ? (
                        <span className="text-xs text-muted-foreground/50">—</span>
                      ) : (
                        shifts.map((shift) => (
                          <span
                            key={shift.start}
                            title={shift.remote ? "Remote" : undefined}
                            className={cn(
                              "flex h-6 items-center rounded-[7px] px-[9px] font-mono text-xs font-semibold whitespace-nowrap",
                              shift.remote
                                ? "border border-dashed border-muted-foreground/50 text-muted-foreground"
                                : cn(ROLE_SWATCH[shift.role], "text-role-foreground"),
                            )}
                          >
                            {compactRange(shift.start, shift.end)}
                          </span>
                        ))
                      )}
                    </div>
                  )
                })}
                <span className="text-right font-mono text-[13px]">
                  {hoursLabel(entry.minutes / 60)}
                  <span className="text-[11px] text-muted-foreground"> / {person ? requestedLabel(person) : "—"}</span>
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}


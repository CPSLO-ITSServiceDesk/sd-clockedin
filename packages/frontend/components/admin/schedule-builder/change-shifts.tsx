"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeft, Sparkles, Star } from "lucide-react"
import { toast } from "sonner"

import { Panel, Segmented } from "@/components/admin/schedule-builder/builder-ui"
import { ROLE_BG } from "@/components/admin/schedule-builder/review-grid"
import { Comparison, SendResult, VersionsPanel } from "@/components/admin/schedule-builder/teams-publish-panel"
import {
  WeekRangePicker,
  spanToRange,
  useTermWeeks,
  type WeekSpan,
} from "@/components/admin/schedule-builder/week-range-picker"
import type { Weekday } from "@/components/admin/terms/term-types"
import { usePaintStroke } from "@/hooks/use-paint-stroke"
import { ApiRequestError } from "@/lib/api/client"
import type { DraftPerson, ScheduleDraft, ShiftRole } from "@/lib/api/schedule-drafts"
import { scheduleBlocksApi } from "@/lib/api/scheduleBlocks"
import { schedulesApi } from "@/lib/api/schedules"
import type { StudentAssistant } from "@/lib/api/student-assistants"
import { teamsPublishApi, type PersonWeeklyShift, type TeamsPublishResult } from "@/lib/api/teams-publish"
import type { Term } from "@/lib/api/terms"
import { timeToMinutes } from "@/lib/format-time"
import { queryKeys } from "@/lib/query-keys"
import { DAY_SHORT, DEFAULT_DESK, ROLE_LABEL, WEEKDAYS, deskSlots, hoursLabel, slotClock, slotRange, toRuns } from "@/lib/schedule-builder/model"
import { cn } from "@/lib/utils"

/** Half-hour slot → role, per weekday. */
type WeekGrid = Partial<Record<Weekday, Record<number, ShiftRole>>>
type Mode = "shifts" | "availability"

const PREVIEW_DEBOUNCE_MS = 500
const FALLBACK_TARGET_HOURS = 10
const MIN_SUGGESTED_SLOTS = 4

const errorText = (err: unknown) =>
  err instanceof ApiRequestError || err instanceof Error ? err.message : "Something went wrong"

const slotOf = (time: string) => Math.round(timeToMinutes(time) / 30)
const timeOf = (slot: number) => `${String(Math.floor(slot / 2)).padStart(2, "0")}:${slot % 2 ? "30" : "00"}`

function gridHours(grid: WeekGrid): number {
  return WEEKDAYS.reduce((sum, day) => sum + Object.keys(grid[day] ?? {}).length, 0) / 2
}

function gridToShifts(grid: WeekGrid): PersonWeeklyShift[] {
  return WEEKDAYS.flatMap((day) => {
    const slots = Object.entries(grid[day] ?? {})
      .map(([slot, role]) => [Number(slot), role] as const)
      .sort((a, b) => a[0] - b[0])
    const runs: PersonWeeklyShift[] = []
    let current: { start: number; end: number; role: ShiftRole } | null = null
    for (const [slot, role] of slots) {
      if (current && current.end === slot && current.role === role) current.end = slot + 1
      else {
        if (current) runs.push({ day, start_time: timeOf(current.start), end_time: timeOf(current.end), role: current.role })
        current = { start: slot, end: slot + 1, role }
      }
    }
    if (current) runs.push({ day, start_time: timeOf(current.start), end_time: timeOf(current.end), role: current.role })
    return runs
  })
}

function sameGrid(a: WeekGrid, b: WeekGrid): boolean {
  return JSON.stringify(gridToShifts(a)) === JSON.stringify(gridToShifts(b))
}

interface ChangeShiftsProps {
  term: Term
  students: Map<number, StudentAssistant>
  nameOf: (_studentId: number) => string
  /** Latest schedule draft, for availability, requested hours and desk rules. */
  draft: ScheduleDraft | null
  onBack: () => void
}

/** 14.5 · after a schedule is live: change one person's shifts (or schedule a trainee) for chosen weeks in Teams. */
export function ChangeShifts({ term, students, nameOf, draft, onBack }: Readonly<ChangeShiftsProps>) {
  const queryClient = useQueryClient()
  const { data: schedules = [] } = useQuery({ queryKey: queryKeys.schedules.all, queryFn: schedulesApi.list })
  const { data: blocks = [] } = useQuery({ queryKey: queryKeys.scheduleBlocks.all, queryFn: scheduleBlocksApi.list })

  const rules = draft?.rules ?? null
  const desk = deskSlots(rules ?? DEFAULT_DESK)
  const minOnDesk = rules?.min_on_desk.enabled ? rules.min_on_desk.value : 3
  const draftPeople = useMemo(
    () => new Map<number, DraftPerson>((draft?.people ?? []).map((person) => [person.student_assistant_id, person])),
    [draft?.people],
  )

  // Live ClockedIn pattern per person (synced from Teams): headcount context and weekly hours in the list.
  const liveGrids = useMemo(() => {
    const termSchedules = new Map(
      schedules
        .filter((schedule) => schedule.academic_term_id === term.id && schedule.student_assistant_id != null)
        .map((schedule) => [schedule.id, schedule.student_assistant_id!]),
    )
    const grids = new Map<number, WeekGrid>()
    for (const block of blocks) {
      const studentId = block.schedule_id != null ? termSchedules.get(block.schedule_id) : undefined
      if (studentId == null || !block.days || !block.start_time || !block.end_time || block.is_remote) continue
      const role: ShiftRole = students.get(studentId)?.position === "student_lead" ? "L" : "m"
      const grid = grids.get(studentId) ?? {}
      const day = { ...(grid[block.days] ?? {}) }
      for (let slot = slotOf(block.start_time); slot < slotOf(block.end_time); slot += 1) day[slot] = role
      grids.set(studentId, { ...grid, [block.days]: day })
    }
    return grids
  }, [schedules, blocks, students, term.id])

  const active = useMemo(
    () =>
      [...students.values()]
        .filter((student) => student.is_active)
        .sort((a, b) => nameOf(a.id).localeCompare(nameOf(b.id))),
    [students, nameOf],
  )
  const unscheduled = active.filter((student) => gridHours(liveGrids.get(student.id) ?? {}) === 0)
  const scheduled = active.filter((student) => gridHours(liveGrids.get(student.id) ?? {}) > 0)

  const [selectedId, setSelectedId] = useState<number | null>(null)
  const current = selectedId ?? unscheduled[0]?.id ?? scheduled[0]?.id ?? null
  const [edits, setEdits] = useState<Map<number, WeekGrid>>(new Map())
  const [availabilityEdits, setAvailabilityEdits] = useState<Map<number, WeekGrid>>(new Map())

  const { weeks, today, firstOpen } = useTermWeeks(term)
  const [span, setSpan] = useState<WeekSpan>({ from: firstOpen, to: Math.max(firstOpen, weeks.length - 1) })
  const range = spanToRange(span, weeks, term, today)
  const patternWeek = weeks[span.from]?.monday ?? term.start_date ?? today

  const patternQuery = useQuery({
    queryKey: queryKeys.teamsPublish.pattern(term.id, current ?? 0, patternWeek),
    queryFn: () => teamsPublishApi.personPattern(term.id, current!, patternWeek),
    enabled: current != null,
  })
  const teamsGrid = useMemo<WeekGrid>(() => {
    const grid: WeekGrid = {}
    for (const shift of patternQuery.data?.shifts ?? []) {
      if (shift.remote) continue
      const day = { ...(grid[shift.day] ?? {}) }
      for (let slot = slotOf(shift.start_time); slot < slotOf(shift.end_time); slot += 1) day[slot] = shift.role ?? "m"
      grid[shift.day] = day
    }
    return grid
  }, [patternQuery.data])
  const offGrid = (patternQuery.data?.shifts ?? []).some(
    (shift) => timeToMinutes(shift.start_time) % 30 !== 0 || timeToMinutes(shift.end_time) % 30 !== 0,
  )
  const remoteCount = (patternQuery.data?.shifts ?? []).filter((shift) => shift.remote).length

  const student = current != null ? students.get(current) : undefined
  const editGrid = current != null ? (edits.get(current) ?? teamsGrid) : {}
  const edited = current != null && edits.has(current) && !sameGrid(edits.get(current)!, teamsGrid)
  const person = current != null ? draftPeople.get(current) : undefined
  const availability: WeekGrid =
    current != null
      ? (availabilityEdits.get(current) ??
        Object.fromEntries(
          WEEKDAYS.map((day) => [day, Object.fromEntries((person?.availability[day] ?? []).map((slot) => [slot, "m" as ShiftRole]))]),
        ))
      : {}
  const hasAvailability = gridHours(availability) > 0
  const defaultRole: ShiftRole = student?.position === "student_lead" ? "L" : unscheduled.some((s) => s.id === current) ? "t" : "m"
  const [brushRole, setBrushRole] = useState<ShiftRole | null>(null)
  const role = brushRole ?? defaultRole
  const [mode, setMode] = useState<Mode>("shifts")
  const [suggested, setSuggested] = useState<WeekGrid>({})
  const [hover, setHover] = useState<{ day: Weekday; slot: number } | null>(null)
  const [result, setResult] = useState<TeamsPublishResult | null>(null)
  const [sending, setSending] = useState(false)

  useEffect(() => {
    setSuggested({})
    setResult(null)
    setBrushRole(null)
  }, [current])

  const setGrid = (update: (grid: WeekGrid) => WeekGrid) =>
    current != null && setEdits((map) => new Map(map).set(current, update(map.get(current) ?? teamsGrid)))
  const setAvailability = (update: (grid: WeekGrid) => WeekGrid) =>
    current != null && setAvailabilityEdits((map) => new Map(map).set(current, update(map.get(current) ?? availability)))

  const paint = usePaintStroke<{ day: Weekday; slot: number }, { kind: Mode; on: boolean }>({
    onPaint: ({ day, slot }, stroke) => {
      const apply = (grid: WeekGrid): WeekGrid => {
        const next = { ...(grid[day] ?? {}) }
        if (stroke.on) next[slot] = role
        else delete next[slot]
        return { ...grid, [day]: next }
      }
      if (stroke.kind === "availability") {
        setAvailability(apply)
        if (!stroke.on) setGrid(apply)
      } else {
        setGrid(apply)
      }
      setSuggested((grid) => {
        if (!grid[day]?.[slot]) return grid
        const next = { ...grid[day] }
        delete next[slot]
        return { ...grid, [day]: next }
      })
    },
  })

  // Others on desk at a slot, from the live schedule (this person excluded).
  const othersAt = (day: Weekday, slot: number) =>
    [...liveGrids.entries()].filter(([id, grid]) => id !== current && grid[day]?.[slot])
  const leadsAt = (day: Weekday, slot: number) => othersAt(day, slot).filter(([, grid]) => grid[day]?.[slot] === "L")

  const suggest = () => {
    const target = (person?.ideal_hours ?? person?.min_hours ?? FALLBACK_TARGET_HOURS) * 2
    const cap = (person?.max_hours ?? Number.POSITIVE_INFINITY) * 2
    const grid = { ...editGrid }
    const proposals: WeekGrid = {}
    let total = gridHours(grid) * 2
    const free = (day: Weekday, slot: number) =>
      (hasAvailability ? Boolean(availability[day]?.[slot]) : true) && !grid[day]?.[slot] && !proposals[day]?.[slot]
    // Score each possible new shift by how much it helps the desk: no-lead hours first (for leads), then thin hours.
    const windows: { day: Weekday; start: number; score: number }[] = []
    for (const day of WEEKDAYS) {
      for (const start of desk) {
        const slots = Array.from({ length: MIN_SUGGESTED_SLOTS }, (_, i) => start + i)
        if (!slots.every((slot) => desk.includes(slot) && free(day, slot))) continue
        const score = slots.reduce((sum, slot) => {
          const others = othersAt(day, slot).length
          const noLead = leadsAt(day, slot).length === 0
          return sum + (role === "L" && noLead ? 4 : 0) + Math.max(0, minOnDesk - others)
        }, 0)
        windows.push({ day, start, score })
      }
    }
    windows.sort((a, b) => b.score - a.score || WEEKDAYS.indexOf(a.day) - WEEKDAYS.indexOf(b.day) || a.start - b.start)
    for (const window of windows) {
      if (total + MIN_SUGGESTED_SLOTS > Math.min(target, cap)) break
      const slots = Array.from({ length: MIN_SUGGESTED_SLOTS }, (_, i) => window.start + i)
      if (!slots.every((slot) => free(window.day, slot))) continue
      if (Object.keys(proposals[window.day] ?? {}).length > 0 || Object.keys(grid[window.day] ?? {}).length > 0) continue
      proposals[window.day] = Object.fromEntries(slots.map((slot) => [slot, role]))
      total += MIN_SUGGESTED_SLOTS
    }
    setSuggested(proposals)
    if (gridHours(proposals) === 0) toast.info("No open time fits another shift within their hours.")
  }
  const acceptSuggestions = () => {
    setGrid((grid) => {
      const next = { ...grid }
      for (const day of WEEKDAYS) if (suggested[day]) next[day] = { ...(next[day] ?? {}), ...suggested[day] }
      return next
    })
    setSuggested({})
  }

  // Debounced comparison with Teams for the edited pattern.
  const shifts = useMemo(() => gridToShifts(editGrid), [editGrid])
  const [debounced, setDebounced] = useState(shifts)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(shifts), PREVIEW_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [shifts])
  const previewQuery = useQuery({
    queryKey: ["teams-publish", "person-preview", term.id, current, range?.fromDate, range?.toDate, JSON.stringify(debounced)],
    queryFn: () => teamsPublishApi.previewPerson(term.id, current!, debounced, range!),
    enabled: current != null && range != null && patternQuery.isSuccess && Boolean(student?.entra_user_id),
  })
  const preview = previewQuery.data
  const changes = preview ? preview.create + preview.remove + preview.restore : 0

  // Hours this change leaves without a lead (only matters when a lead gives hours up).
  const leadWarnings = useMemo(() => {
    if (role !== "L" && student?.position !== "student_lead") return []
    const lost: string[] = []
    for (const day of WEEKDAYS) {
      for (const slot of Object.keys(teamsGrid[day] ?? {}).map(Number)) {
        if (editGrid[day]?.[slot] || teamsGrid[day]?.[slot] !== "L") continue
        if (leadsAt(day, slot).length === 0) lost.push(`${DAY_SHORT[day]} ${slotClock(slot)}`)
      }
    }
    return lost
    // leadsAt reads liveGrids, which is a dependency through these values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamsGrid, editGrid, liveGrids, role, student?.position])

  const send = async () => {
    if (current == null || !range) return
    setSending(true)
    try {
      const sent = await teamsPublishApi.publishPerson(term.id, current, shifts, range)
      setResult(sent)
      setEdits((map) => {
        const next = new Map(map)
        next.delete(current)
        return next
      })
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.teamsPublish.all }),
        queryClient.invalidateQueries({ queryKey: ["teams-publish", "person-preview"] }),
      ])
      if (sent.failed.length) toast.error(`${sent.failed.length} changes didn't go through.`)
      else toast.success(`Sent ${nameOf(current)}'s update to Teams as a draft`)
    } catch (err) {
      toast.error(errorText(err))
    } finally {
      setSending(false)
    }
  }

  const liveHours = (id: number) => gridHours(liveGrids.get(id) ?? {})
  const requested = (id: number) => {
    const p = draftPeople.get(id)
    if (!p || (p.min_hours == null && p.max_hours == null)) return ""
    return p.min_hours === p.max_hours || p.max_hours == null ? `${p.min_hours ?? p.max_hours}` : `${p.min_hours ?? 0}–${p.max_hours}`
  }

  return (
    <div className="flex flex-col gap-4">
      <Panel className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to the current schedule"
            className="flex size-[30px] items-center justify-center rounded-[9px] border border-border hover:bg-muted"
          >
            <ArrowLeft className="size-4" />
          </button>
          <span className="text-base font-bold">{term.name ?? "Term"} schedule</span>
          <span className="rounded-full bg-accent/15 px-2.5 py-1 text-xs font-bold text-accent">Live in Teams</span>
        </div>
        <span className="text-[13px] text-muted-foreground">
          Everything else stays as it is. Only the selected person&apos;s shifts change, as a draft in Teams.
        </span>
      </Panel>

      <div className="grid items-start gap-4 xl:grid-cols-[280px_minmax(0,1fr)_340px]">
        <Panel className="flex flex-col gap-2.5 p-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-[15px] font-bold">Not scheduled yet</span>
            <span className="text-xs text-muted-foreground">New trainees and anyone without shifts this term</span>
          </div>
          {unscheduled.length === 0 ? <span className="text-[13px] text-muted-foreground">Everyone has shifts.</span> : null}
          {unscheduled.map((entry) => {
            const on = entry.id === current
            const hours = on ? gridHours(editGrid) : 0
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => setSelectedId(entry.id)}
                className={cn(
                  "flex flex-col gap-1.5 rounded-[14px] border-[1.5px] px-3.5 py-3 text-left",
                  on ? "border-accent bg-accent/5" : "border-border bg-card hover:bg-muted/40",
                )}
              >
                <span className="flex w-full items-baseline justify-between">
                  <span className="text-sm font-bold">{nameOf(entry.id)}</span>
                  <span className="font-mono text-xs text-muted-foreground">{hoursLabel(hours)}</span>
                </span>
                <span className="flex w-full items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    {entry.position === "student_lead" ? "Lead" : "Student"}
                    {entry.entra_user_id ? "" : " · not in Teams yet"}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-[3px] text-[11px] font-bold",
                      on && edited ? "bg-amber-500/15 text-amber-800 dark:text-amber-200" : "bg-muted text-muted-foreground",
                    )}
                  >
                    {on && edited ? "Unsent" : "No shifts"}
                  </span>
                </span>
              </button>
            )
          })}
          <Link
            href="/admin/students"
            className="flex h-[38px] items-center justify-center rounded-full border border-dashed border-border text-[13px] font-semibold hover:bg-muted/40"
          >
            + Add from Students
          </Link>

          <div className="flex flex-col gap-0.5 border-t border-border/60 pt-2.5">
            <span className="text-[15px] font-bold">Change someone&apos;s shifts</span>
            <span className="text-xs text-muted-foreground">Class changes, new availability, hours up or down</span>
          </div>
          <div className="-mx-1.5 flex max-h-[360px] flex-col overflow-y-auto">
            {(["student_lead", "student_assistant"] as const).map((position) => {
              const list = scheduled.filter((entry) => entry.position === position)
              if (list.length === 0) return null
              return (
                <div key={position} className="flex flex-col">
                  <span className="px-2 pt-2 pb-0.5 text-[10px] font-bold tracking-[0.1em] text-muted-foreground uppercase">
                    {position === "student_lead" ? "Leads" : "Students"}
                  </span>
                  {list.map((entry) => {
                    const on = entry.id === current
                    const isEdited = edits.has(entry.id) && (entry.id !== current || edited)
                    return (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={() => setSelectedId(entry.id)}
                        className={cn("flex h-8 items-center gap-2 rounded-[9px] px-2 text-left", on ? "bg-accent/10" : "hover:bg-muted")}
                      >
                        <span className={cn("flex-1 truncate text-[13px] font-semibold", on && "text-accent")}>{nameOf(entry.id)}</span>
                        {isEdited ? (
                          <span className="rounded-full bg-role-training/15 px-[7px] py-0.5 text-[10px] font-bold text-role-training">Edited</span>
                        ) : null}
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {liveHours(entry.id)}
                          {requested(entry.id) ? `/${requested(entry.id)}` : ""} h
                        </span>
                      </button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </Panel>

        <Panel className="flex flex-col gap-3 px-[18px] py-4 select-none">
          {current == null || !student ? (
            <span className="text-sm text-muted-foreground">Pick someone on the left.</span>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-baseline gap-2">
                    <span className="text-base font-bold">{nameOf(current)}</span>
                    <span className="text-xs text-muted-foreground">{student.position === "student_lead" ? "Lead" : "Student"}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {hasAvailability ? `${hoursLabel(gridHours(availability))} available · ` : ""}
                    <b className="text-foreground">{hoursLabel(gridHours(editGrid))} scheduled</b>
                    {person?.ideal_hours ?? person?.min_hours ? ` · target ${person?.ideal_hours ?? person?.min_hours} h` : ""}
                    {patternQuery.data?.week_of ? ` · from Teams, week of ${patternQuery.data.week_of.slice(5).replace("-", "/")}` : ""}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Segmented
                    options={[
                      { value: "availability", label: "Availability" },
                      { value: "shifts", label: "Shifts" },
                    ]}
                    value={mode}
                    onChange={setMode}
                  />
                  {mode === "shifts" ? (
                    <Segmented
                      options={(["L", "m", "t"] as const).map((value) => ({
                        value,
                        label: (
                          <>
                            <span className={cn("size-3 rounded-[3px]", ROLE_BG[value])} />
                            {ROLE_LABEL[value]}
                          </>
                        ),
                      }))}
                      value={role}
                      onChange={setBrushRole}
                    />
                  ) : null}
                  {gridHours(suggested) > 0 ? (
                    <button
                      type="button"
                      onClick={acceptSuggestions}
                      className="h-9 rounded-full border border-border bg-card px-3.5 text-[13px] font-semibold hover:bg-muted"
                    >
                      Accept {hoursLabel(gridHours(suggested))}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={suggest}
                    className="flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-[13px] font-bold text-primary-foreground hover:bg-primary/90"
                  >
                    <Sparkles className="size-3.5" />
                    {gridHours(suggested) > 0 ? "Suggest again" : "Suggest shifts"}
                  </button>
                </div>
              </div>

              {!student.entra_user_id ? (
                <Notice>
                  {nameOf(current)} isn&apos;t linked to a Teams account yet. Add them to the Teams scheduling group; they link on the
                  next sync.
                </Notice>
              ) : null}
              {!hasAvailability ? (
                <Notice>
                  No availability yet. Paint it in the Availability layer, or import their form response in the schedule builder.
                  Suggestions use every desk hour until then.
                </Notice>
              ) : null}
              {offGrid ? <Notice>Some of their Teams shifts don&apos;t start on the hour or half hour; editing rounds them.</Notice> : null}
              {remoteCount ? <Notice>{remoteCount} remote shifts aren&apos;t shown here and aren&apos;t changed.</Notice> : null}

              <span className="-mt-1 text-xs text-muted-foreground">
                {mode === "availability"
                  ? "Drag to open or close hours. Closing an hour removes its shift."
                  : `Drag across free hours to add ${ROLE_LABEL[role]} time. Drag over a shift to remove it. Dashed cells are suggestions.`}
              </span>

              <HoverBar
                hover={hover}
                leads={hover ? leadsAt(hover.day, hover.slot).map(([id]) => students.get(id)?.first_name ?? nameOf(id)) : []}
                count={hover ? othersAt(hover.day, hover.slot).length + (editGrid[hover.day]?.[hover.slot] ? 1 : 0) : 0}
                minOnDesk={minOnDesk}
              />

              {patternQuery.isLoading ? (
                <span className="py-10 text-center text-sm text-muted-foreground">Loading their shifts from Teams…</span>
              ) : patternQuery.error ? (
                <span className="py-10 text-center text-sm text-destructive">{errorText(patternQuery.error)}</span>
              ) : (
                <div className="grid grid-cols-[64px_repeat(5,minmax(0,1fr))] gap-1" onMouseLeave={() => setHover(null)}>
                  <span />
                  {WEEKDAYS.map((day) => (
                    <span key={day} className="pb-0.5 text-[13px] font-bold">
                      {DAY_SHORT[day]}
                    </span>
                  ))}
                  {desk.map((slot) => (
                    <div key={slot} className="contents">
                      <span className="font-mono text-xs text-muted-foreground">{slot % 2 === 0 ? slotClock(slot) : ""}</span>
                      {WEEKDAYS.map((day) => {
                        const shift = editGrid[day]?.[slot]
                        const open = availability[day]?.[slot]
                        const proposal = suggested[day]?.[slot]
                        const wasLive = teamsGrid[day]?.[slot]
                        const noLead = leadsAt(day, slot).length === 0 && shift !== "L"
                        const label = shift && (slot === desk[0] || editGrid[day]?.[slot - 1] !== shift)
                        const run = shift ? toRuns(Object.keys(editGrid[day] ?? {}).map(Number)).find(([a, b]) => slot >= a && slot < b) : null
                        return (
                          <div
                            key={day}
                            onMouseDown={(event) => {
                              event.preventDefault()
                              if (mode === "availability") paint.start({ day, slot }, { kind: "availability", on: !open })
                              else paint.start({ day, slot }, { kind: "shifts", on: !shift })
                            }}
                            onMouseEnter={() => {
                              setHover({ day, slot })
                              paint.enter({ day, slot })
                            }}
                            className={cn(
                              "relative flex h-[22px] cursor-crosshair items-center overflow-hidden rounded-md px-2",
                              shift
                                ? cn(ROLE_BG[shift], "text-role-foreground", mode === "availability" && "opacity-40")
                                : proposal
                                  ? "border-[1.5px] border-dashed border-accent bg-card"
                                  : open
                                    ? "bg-avail"
                                    : "bg-muted/50",
                              !shift && wasLive && "outline-[1.5px] outline-dashed outline-destructive/70",
                            )}
                          >
                            {label && run ? (
                              <span className="font-mono text-[11px] font-bold whitespace-nowrap">{slotRange(run[0], run[1])}</span>
                            ) : null}
                            {noLead ? <span className="absolute top-1 right-1 size-[6px] rounded-full bg-destructive" /> : null}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                <Legend className="bg-avail" label="Available" />
                <Legend className="bg-role-main" label="Shift" />
                <Legend className="border-[1.5px] border-dashed border-accent bg-card" label="Suggestion" />
                <Legend className="outline-[1.5px] outline-dashed outline-destructive/70" label="Removed vs. Teams" />
                <span className="flex items-center gap-1.5">
                  <span className="size-[6px] rounded-full bg-destructive" />
                  No lead
                </span>
              </div>
            </>
          )}
        </Panel>

        <div className="flex flex-col gap-3.5">
          <Panel className="flex flex-col gap-3 px-5 py-[18px]">
            <span className="text-base font-bold">Update in Teams</span>
            <Comparison
              title="Compared with what's live"
              preview={preview}
              loading={previewQuery.isFetching && !preview}
              error={previewQuery.error}
              extraRows={[
                ["Weekly hours", `${hoursLabel(gridHours(teamsGrid))} → ${hoursLabel(gridHours(editGrid))}`],
                ["Everyone else", "No changes"],
              ]}
            />
            <WeekRangePicker term={term} value={span} onChange={setSpan} />
            {leadWarnings.length > 0 ? (
              <div className="flex flex-col gap-1 rounded-xl bg-destructive/10 px-3 py-2.5">
                <span className="text-xs font-semibold text-destructive">
                  Leaves no lead on {leadWarnings.slice(0, 4).join(", ")}
                  {leadWarnings.length > 4 ? ` +${leadWarnings.length - 4}` : ""}.
                </span>
              </div>
            ) : null}
            <span className="text-xs leading-[1.45] text-muted-foreground">
              Goes to Teams as a draft. Students aren&apos;t notified until a manager shares the schedule.
            </span>
            {result ? <SendResult result={result} /> : null}
            {current != null && changes > 0 ? (
              <button
                type="button"
                disabled={sending || !student?.entra_user_id}
                onClick={() => void send()}
                className="h-11 rounded-full bg-primary text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {sending ? "Sending…" : `Send update for ${student?.first_name ?? nameOf(current)} as a draft`}
              </button>
            ) : (
              <div className="flex h-11 items-center justify-center rounded-full bg-muted text-[13px] font-semibold text-muted-foreground">
                {previewQuery.isFetching ? "Comparing…" : "Nothing to send yet"}
              </div>
            )}
          </Panel>
          <VersionsPanel termId={term.id} />
        </div>
      </div>
    </div>
  )
}

function HoverBar({
  hover,
  leads,
  count,
  minOnDesk,
}: Readonly<{ hover: { day: Weekday; slot: number } | null; leads: string[]; count: number; minOnDesk: number }>) {
  return (
    <div className="flex min-h-[34px] flex-wrap items-center gap-2.5 rounded-xl bg-muted/50 px-3 py-1.5">
      <span className="min-w-[150px] font-mono text-sm font-semibold">
        {hover ? `${DAY_SHORT[hover.day]} ${slotRange(hover.slot, hover.slot + 1)}` : "Hover an hour"}
      </span>
      {hover ? (
        <>
          <span className="flex items-center gap-1">
            {leads.length ? (
              leads.map((name) => (
                <span key={name} className="flex h-[22px] items-center gap-1 rounded-full bg-role-lead pr-[9px] pl-[7px] text-xs font-bold text-role-foreground">
                  <Star className="size-[9px] fill-amber-300 text-amber-300" />
                  {name}
                </span>
              ))
            ) : (
              <span className="flex h-[22px] items-center rounded-full border-[1.5px] border-destructive px-[9px] text-xs font-bold text-destructive">
                No lead
              </span>
            )}
          </span>
          <span className={cn("text-[13px] font-semibold", count < minOnDesk ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground")}>
            {count} on desk
          </span>
        </>
      ) : (
        <span className="text-[13px] text-muted-foreground">to see who else is on</span>
      )}
      <span className="flex-1" />
      <span className="text-xs text-muted-foreground">Red dot: no lead · amber: under {minOnDesk} people</span>
    </div>
  )
}

function Notice({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="rounded-[14px] bg-amber-500/15 px-3.5 py-2.5 text-[13px] text-amber-800 dark:text-amber-200">{children}</div>
  )
}

function Legend({ className, label }: Readonly<{ className: string; label: string }>) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("h-3 w-4 rounded-[3px]", className)} />
      {label}
    </span>
  )
}

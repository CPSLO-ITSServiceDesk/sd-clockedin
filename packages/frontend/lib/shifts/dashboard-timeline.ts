import type { TodayTimeOffShift, UpcomingTimeOff } from "@/lib/api/today-shifts"
import { formatOrgClock, getOrgLocalDateString, ORG_TIMEZONE, toOrgWallClockMinutes } from "@/lib/org-time"
import {
  formatShiftName,
  getShiftInitials,
  type TodayShift,
} from "@/lib/shifts/today-shifts"
import { addOrgDateDays } from "@/lib/shifts/hourly-staffing-dates"

/** Default visible window on the dashboard timeline (8 AM – 5 PM). */
export const TIMELINE_DEFAULT_START_HOUR = 8
export const TIMELINE_DEFAULT_END_HOUR = 17

export type TimelineTone = "scheduled" | "absent" | "time-off"

export interface TimelineSegment {
  key: string
  /** Scheduled window in org-local minutes; null for unscheduled walk-ins. */
  scheduled: { start: number; end: number } | null
  /** Clocked window in org-local minutes (open punches run to now). */
  worked: { start: number; end: number } | null
  tone: TimelineTone
  late: boolean
  tag: string | null
}

export interface TimelineRow {
  studentAssistantId: number
  firstName: string
  name: string
  initials: string
  isRemote: boolean
  isTimeOff: boolean
  sortKey: number
  segments: TimelineSegment[]
}

export interface TimelineRange {
  startHour: number
  endHour: number
}

function formatOrgShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: ORG_TIMEZONE,
    month: "short",
    day: "numeric",
  })
}

/** "Vacation" / "Off until 1:00 PM" for a time-off block on the timeline. */
function timeOffTag(shift: TodayTimeOffShift): string {
  const endsMinutes = toOrgWallClockMinutes(shift.timeOffEndsAt)
  const shiftEnd = toOrgWallClockMinutes(shift.endTime)
  const endsToday = getOrgLocalDateString(new Date(shift.timeOffEndsAt)) === getOrgLocalDateString()

  if (endsToday && !Number.isNaN(endsMinutes) && endsMinutes < shiftEnd) {
    return `Off until ${formatOrgClock(shift.timeOffEndsAt)}`
  }
  return shift.timeOffReason ?? "Time off"
}

function shiftSegment(shift: TodayShift, nowMinutes: number): TimelineSegment {
  const start = toOrgWallClockMinutes(shift.startTime)
  const end = toOrgWallClockMinutes(shift.endTime)
  const scheduled =
    shift.startTime && !Number.isNaN(start) && !Number.isNaN(end) ? { start, end } : null

  let worked: TimelineSegment["worked"] = null
  if (shift.isRemote && !shift.clockInActual && scheduled) {
    // Remote staff don't clock in; they count as working through their scheduled window.
    const workedEnd = Math.min(nowMinutes, scheduled.end)
    if (workedEnd > scheduled.start) {
      worked = { start: scheduled.start, end: workedEnd }
    }
  } else if (shift.clockInActual) {
    const workedStart = toOrgWallClockMinutes(shift.clockInActual)
    const workedEnd = shift.clockOutActual
      ? toOrgWallClockMinutes(shift.clockOutActual)
      : nowMinutes
    if (!Number.isNaN(workedStart) && !Number.isNaN(workedEnd) && workedEnd > workedStart) {
      worked = { start: workedStart, end: workedEnd }
    }
  }

  const absent = shift.status === "absent" && !shift.isRemote
  let tag: string | null = null
  if (absent) tag = "No clock-in"
  else if (!scheduled) tag = "Unscheduled"

  return {
    key: `shift-${shift.scheduleBlockId ?? `entry-${shift.timeEntryId}`}`,
    scheduled,
    worked,
    tone: absent ? "absent" : "scheduled",
    late: !shift.isRemote && shift.status === "late",
    tag,
  }
}

function timeOffSegment(shift: TodayTimeOffShift, partial = false): TimelineSegment {
  return {
    key: partial ? `off-${shift.scheduleBlockId}-${shift.startTime}` : `off-${shift.scheduleBlockId}`,
    scheduled: {
      start: toOrgWallClockMinutes(shift.startTime),
      end: toOrgWallClockMinutes(shift.endTime),
    },
    worked: null,
    tone: "time-off",
    late: false,
    tag: timeOffTag(shift),
  }
}

/**
 * One row per student, combining scheduled shifts, time-off blocks and the
 * time-off hours of partly covered shifts. Sorted by earliest start time,
 * then first name.
 */
export function buildTimelineRows(
  shifts: TodayShift[],
  timeOffShifts: TodayTimeOffShift[],
  nowMinutes: number,
  partialTimeOff: TodayTimeOffShift[] = [],
): TimelineRow[] {
  const rows = new Map<number, TimelineRow & { remoteFlags: boolean[] }>()

  const rowFor = (
    person: Pick<TodayShift, "studentAssistantId" | "firstName" | "lastName">,
  ) => {
    let row = rows.get(person.studentAssistantId)
    if (!row) {
      row = {
        studentAssistantId: person.studentAssistantId,
        firstName: person.firstName,
        name: formatShiftName(person),
        initials: getShiftInitials(person),
        isRemote: false,
        isTimeOff: true,
        sortKey: Number.POSITIVE_INFINITY,
        segments: [],
        remoteFlags: [],
      }
      rows.set(person.studentAssistantId, row)
    }
    return row
  }

  for (const shift of shifts) {
    const row = rowFor(shift)
    const segment = shiftSegment(shift, nowMinutes)
    row.segments.push(segment)
    row.remoteFlags.push(shift.isRemote)
    row.isTimeOff = false
    row.sortKey = Math.min(
      row.sortKey,
      segment.scheduled?.start ?? segment.worked?.start ?? row.sortKey,
    )
  }

  for (const piece of partialTimeOff) {
    const row = rowFor(piece)
    const segment = timeOffSegment(piece, true)
    row.segments.push(segment)
    row.sortKey = Math.min(row.sortKey, segment.scheduled?.start ?? row.sortKey)
  }

  for (const shift of timeOffShifts) {
    const row = rowFor(shift)
    const segment = timeOffSegment(shift)
    row.segments.push(segment)
    row.remoteFlags.push(shift.isRemote)
    row.sortKey = Math.min(row.sortKey, segment.scheduled?.start ?? row.sortKey)
  }

  return Array.from(rows.values())
    .map(({ remoteFlags, ...row }) => ({
      ...row,
      isRemote: remoteFlags.length > 0 && remoteFlags.every(Boolean),
    }))
    .sort(
      (a, b) =>
        a.sortKey - b.sortKey ||
        a.firstName.localeCompare(b.firstName) ||
        a.name.localeCompare(b.name),
    )
}

/**
 * Widen the default 8 AM – 5 PM window to fit any scheduled segment outside it.
 * Clock punches don't widen it (an early 7:56 clock-in would add a 7 AM
 * column); bars clip to the edge. Unscheduled walk-ins still count.
 */
export function getTimelineRange(rows: TimelineRow[]): TimelineRange {
  let startHour = TIMELINE_DEFAULT_START_HOUR
  let endHour = TIMELINE_DEFAULT_END_HOUR

  for (const row of rows) {
    for (const segment of row.segments) {
      for (const span of [segment.scheduled ?? segment.worked]) {
        if (!span || Number.isNaN(span.start) || Number.isNaN(span.end)) continue
        startHour = Math.min(startHour, Math.floor(span.start / 60))
        endHour = Math.max(endHour, Math.ceil(span.end / 60))
      }
    }
  }

  return { startHour, endHour: Math.min(endHour, 24) }
}

/** Percent offset of an org-local minute within the timeline range. */
export function toTimelinePercent(minutes: number, range: TimelineRange): number {
  const start = range.startHour * 60
  const span = (range.endHour - range.startHour) * 60
  return Math.min(100, Math.max(0, ((minutes - start) / span) * 100))
}

export function formatHourTick(hour: number): string {
  const suffix = hour >= 12 && hour < 24 ? "p" : "a"
  return `${hour % 12 || 12}${suffix}`
}

/** "Today", "Today, until 1:00 PM", "Oct 22", "Oct 27 – Oct 29". */
export function formatTimeOffWhen(entry: UpcomingTimeOff, now: Date = new Date()): string {
  const today = getOrgLocalDateString(now)
  const startDate = getOrgLocalDateString(new Date(entry.startsAt))
  // ends_at is exclusive; an all-day block ends at the next midnight.
  const lastDate = getOrgLocalDateString(new Date(Date.parse(entry.endsAt) - 1))
  const startsBeforeToday =
    startDate < today || (startDate === today && toOrgWallClockMinutes(entry.startsAt) === 0)
  const endsMinutes = toOrgWallClockMinutes(entry.endsAt)
  const endsAtMidnight = endsMinutes === 0

  if (startsBeforeToday && lastDate === today) {
    return endsAtMidnight ? "Today" : `Today, until ${formatOrgClock(entry.endsAt)}`
  }

  const startLabel = startDate === today
    ? "Today"
    : startDate === addOrgDateDays(today, 1)
      ? "Tomorrow"
      : formatOrgShortDate(entry.startsAt)

  if (startDate === lastDate) {
    const startMinutes = toOrgWallClockMinutes(entry.startsAt)
    if (startMinutes === 0 && endsAtMidnight) return startLabel
    return `${startLabel}, ${formatOrgClock(entry.startsAt)} – ${formatOrgClock(entry.endsAt)}`
  }

  const endLabel = formatOrgShortDate(new Date(Date.parse(entry.endsAt) - 1).toISOString())
  return `${startsBeforeToday ? "Today" : startLabel} – ${endLabel}`
}

/**
 * Today's time off (including any that already ended, as the kiosk and
 * /display list it) followed by upcoming time off, each window once.
 */
export function mergeDashboardTimeOff(
  todayTimeOff: UpcomingTimeOff[],
  upcomingTimeOff: UpcomingTimeOff[],
): UpcomingTimeOff[] {
  const byWindow = new Map<string, UpcomingTimeOff>()
  for (const entry of [...todayTimeOff, ...upcomingTimeOff]) {
    const key = `${entry.studentAssistantId}|${entry.startsAt}|${entry.endsAt}`
    if (!byWindow.has(key)) byWindow.set(key, entry)
  }
  return [...byWindow.values()].sort(
    (a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.firstName.localeCompare(b.firstName),
  )
}

export function isTimeOffActive(entry: UpcomingTimeOff, now: Date = new Date()): boolean {
  const t = now.getTime()
  return Date.parse(entry.startsAt) <= t && t < Date.parse(entry.endsAt)
}

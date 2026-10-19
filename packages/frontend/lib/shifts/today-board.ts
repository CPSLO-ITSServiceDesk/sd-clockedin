import type { TodayTimeOffShift, UpcomingTimeOff } from "@/lib/api/today-shifts"
import { formatTime } from "@/lib/format-time"
import {
  getOrgLocalDateString,
  getOrgLocalMinutes,
  formatOrgClock,
  toOrgWallClockMinutes,
} from "@/lib/org-time"
import type { StudentAssistant } from "@/lib/api/student-assistants"
import {
  formatShiftName,
  getClockedInStudents,
  getClockInStudentOptions,
  getExpectedArrivalStudents,
  getPendingClockInStudents,
  getShiftInitials,
  type ClockInStudentOption,
  type TodayShift,
} from "@/lib/shifts/today-shifts"

export interface WorkingTile {
  studentAssistantId: number
  name: string
  initials: string
  role: string
  isRemote: boolean
  late: boolean
  /** "In 8:02 AM", "Remote", or "Walk-in". */
  inLabel: string
  /** Clock-in time ("8:02 AM"); null for remote staff working without a punch. */
  clockInLabel: string | null
  /** Scheduled end ("12:00 PM"); null for unscheduled walk-ins. */
  endLabel: string | null
  /** Share of the shift elapsed, 0–100; null when there's no scheduled end. */
  progress: number | null
}

export interface UpNextEntry {
  studentAssistantId: number
  name: string
  initials: string
  role: string
  start: string
  end: string
  isRemote: boolean
}

export interface OutTodayEntry {
  studentAssistantId: number
  name: string
  initials: string
  window: string
  reason: string | null
}

function byStartThenFirstName(
  a: { startMinutes: number; firstName: string },
  b: { startMinutes: number; firstName: string },
): number {
  return a.startMinutes - b.startMinutes || a.firstName.localeCompare(b.firstName)
}

function progressPercent(from: number, to: number, nowMinutes: number): number | null {
  if (Number.isNaN(from) || Number.isNaN(to) || to <= from) return null
  return Math.round(Math.min(100, Math.max(0, ((nowMinutes - from) / (to - from)) * 100)))
}

function isRemoteWorkingNow(shift: TodayShift, nowMinutes: number): boolean {
  if (!shift.isRemote || shift.clockInActual) return false
  const start = toOrgWallClockMinutes(shift.startTime)
  const end = toOrgWallClockMinutes(shift.endTime)
  return nowMinutes >= start && nowMinutes < end
}

/**
 * Everyone working right now: in-person staff who are clocked in, plus remote
 * staff inside their scheduled window (remote staff don't clock in).
 */
export function buildWorkingTiles(shifts: TodayShift[], now: Date = new Date()): WorkingTile[] {
  const nowMinutes = getOrgLocalMinutes(now)
  const clockedIn = getClockedInStudents(shifts)
  const clockedInIds = new Set(clockedIn.map((shift) => shift.studentAssistantId))

  const remote = new Map<number, TodayShift>()
  for (const shift of shifts) {
    if (clockedInIds.has(shift.studentAssistantId)) continue
    if (!isRemoteWorkingNow(shift, nowMinutes)) continue
    if (!remote.has(shift.studentAssistantId)) remote.set(shift.studentAssistantId, shift)
  }

  const tiles = [...clockedIn, ...remote.values()].map((shift) => {
    const scheduledStart = shift.startTime ? toOrgWallClockMinutes(shift.startTime) : Number.NaN
    const scheduledEnd = shift.endTime ? toOrgWallClockMinutes(shift.endTime) : Number.NaN
    const clockIn = shift.clockInActual ? toOrgWallClockMinutes(shift.clockInActual) : Number.NaN
    const workingRemotely = !shift.clockInActual && shift.isRemote

    let inLabel = "Walk-in"
    if (workingRemotely) inLabel = "Remote"
    else if (shift.clockInActual && shift.startTime) inLabel = `In ${formatOrgClock(shift.clockInActual)}`
    else if (shift.clockInActual) inLabel = `Walk-in ${formatOrgClock(shift.clockInActual)}`

    return {
      tile: {
        studentAssistantId: shift.studentAssistantId,
        name: formatShiftName(shift),
        initials: getShiftInitials(shift),
        role: shift.role,
        isRemote: shift.isRemote,
        late: !shift.isRemote && shift.status === "late",
        inLabel,
        clockInLabel: shift.clockInActual ? formatOrgClock(shift.clockInActual) : null,
        endLabel: shift.endTime ? formatTime(shift.endTime) : null,
        progress: progressPercent(
          workingRemotely ? scheduledStart : clockIn,
          scheduledEnd,
          nowMinutes,
        ),
      },
      startMinutes: Number.isNaN(scheduledStart) ? clockIn : scheduledStart,
      firstName: shift.firstName,
    }
  })

  return tiles.sort(byStartThenFirstName).map(({ tile }) => tile)
}

/** People starting in the next two hours who haven't started yet. */
export function buildUpNext(shifts: TodayShift[], now: Date = new Date()): UpNextEntry[] {
  return getExpectedArrivalStudents(shifts, now)
    .map((shift) => ({
      entry: {
        studentAssistantId: shift.studentAssistantId,
        name: formatShiftName(shift),
        initials: getShiftInitials(shift),
        role: shift.role,
        start: formatTime(shift.startTime),
        end: formatTime(shift.endTime),
        isRemote: shift.isRemote,
      },
      startMinutes: toOrgWallClockMinutes(shift.startTime),
      firstName: shift.firstName,
    }))
    .sort(byStartThenFirstName)
    .map(({ entry }) => entry)
}

/** "10:00 – 11:00 AM", or "11:00 AM – 1:00 PM" across noon. */
function formatOrgClockRange(startIso: string, endIso: string): string {
  const start = formatOrgClock(startIso)
  const end = formatOrgClock(endIso)
  const period = /\s?[AP]M$/i
  const samePeriod = start.match(period)?.[0].trim() === end.match(period)?.[0].trim()
  return `${samePeriod ? start.replace(period, "") : start} – ${end}`
}

/**
 * When someone is off today: "All day" only if the time off covers the whole
 * day; otherwise "10:00 – 11:00 AM", "Until 1:00 PM" or "From 2:00 PM".
 */
export function formatTimeOffToday(startsAt: string, endsAt: string, now: Date = new Date()): string {
  const today = getOrgLocalDateString(now)
  const startDate = getOrgLocalDateString(new Date(startsAt))
  const startsBeforeToday =
    startDate < today || (startDate === today && toOrgWallClockMinutes(startsAt) === 0)
  // ends_at is exclusive, so time off through the end of today ends at tomorrow's midnight.
  const runsPastToday = getOrgLocalDateString(new Date(endsAt)) > today

  if (startsBeforeToday && runsPastToday) return "All day"
  if (startsBeforeToday) return `Until ${formatOrgClock(endsAt)}`
  if (runsPastToday) return `From ${formatOrgClock(startsAt)}`
  return formatOrgClockRange(startsAt, endsAt)
}

/**
 * One entry per student off today, with when: "All day", "10:00 – 11:00 AM",
 * "Until 1:00 PM"... Lists time off that already ended today too, so short
 * time off stays visible all day. Falls back to `timeOffShifts` for responses
 * from before `todayTimeOff` existed.
 */
export function buildOutToday(
  todayTimeOff: UpcomingTimeOff[],
  timeOffShifts: TodayTimeOffShift[],
  now: Date = new Date(),
): OutTodayEntry[] {
  const windows: Pick<UpcomingTimeOff, "studentAssistantId" | "firstName" | "lastName" | "startsAt" | "endsAt" | "reason">[] =
    todayTimeOff.length > 0
      ? todayTimeOff
      : timeOffShifts.map((shift) => ({
          studentAssistantId: shift.studentAssistantId,
          firstName: shift.firstName,
          lastName: shift.lastName,
          startsAt: shift.timeOffStartsAt,
          endsAt: shift.timeOffEndsAt,
          reason: shift.timeOffReason,
        }))

  const byStudent = new Map<number, typeof windows>()
  for (const entry of windows) {
    byStudent.set(entry.studentAssistantId, [...(byStudent.get(entry.studentAssistantId) ?? []), entry])
  }

  return Array.from(byStudent.values())
    .map((entries) => {
      const sorted = [...entries].sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt))
      const [first] = sorted
      // List each distinct window once, earliest first.
      const labels = [
        ...new Map(
          sorted.map((entry) => [`${entry.startsAt}|${entry.endsAt}`, formatTimeOffToday(entry.startsAt, entry.endsAt, now)]),
        ).values(),
      ]
      return {
        entry: {
          studentAssistantId: first.studentAssistantId,
          name: formatShiftName(first),
          initials: getShiftInitials(first),
          window: labels.includes("All day") ? "All day" : labels.join(", "),
          reason: first.reason,
        },
        allDay: labels.includes("All day"),
        startsAt: Date.parse(first.startsAt),
        firstName: first.firstName,
      }
    })
    // All-day first, then by when the time off starts, then first name.
    .sort(
      (a, b) =>
        Number(b.allDay) - Number(a.allDay) ||
        a.startsAt - b.startsAt ||
        a.firstName.localeCompare(b.firstName),
    )
    .map(({ entry }) => entry)
}

export interface ClockInRosterEntry extends ClockInStudentOption {
  /** "Student Assistant · scheduled 11:00 AM" etc. */
  detail: string
}

/**
 * Everyone who can clock in: scheduled today first (by start, then first
 * name), then unscheduled, then people on Teams time off. Time off doesn't
 * hide anyone, so a cancelled absence never locks someone out.
 */
export function buildClockInRoster(
  students: StudentAssistant[],
  shifts: TodayShift[],
  timeOffShifts: TodayTimeOffShift[],
  now: Date = new Date(),
): ClockInRosterEntry[] {
  const pendingById = new Map(
    getPendingClockInStudents(shifts, now).map((shift) => [shift.studentAssistantId, shift]),
  )
  const timeOffIds = new Set(timeOffShifts.map((shift) => shift.studentAssistantId))

  const rank = (option: ClockInStudentOption) => {
    if (pendingById.has(option.studentAssistantId)) return 0
    if (timeOffIds.has(option.studentAssistantId)) return 2
    return 1
  }

  return getClockInStudentOptions(students, shifts)
    .map((option) => {
      const pending = pendingById.get(option.studentAssistantId)
      let detail = `${option.role} · not scheduled today`
      if (pending) detail = `${option.role} · scheduled ${formatTime(pending.startTime)}`
      else if (timeOffIds.has(option.studentAssistantId)) detail = `${option.role} · time off today`

      return {
        entry: { ...option, detail },
        group: rank(option),
        startMinutes: pending ? toOrgWallClockMinutes(pending.startTime) : 0,
        firstName: option.firstName,
      }
    })
    .sort((a, b) => a.group - b.group || byStartThenFirstName(a, b))
    .map(({ entry }) => entry)
}

import type { TodayTimeOffShift } from "@/lib/api/today-shifts"
import { formatTime, normalizeTimeKey, timeToMinutes } from "@/lib/format-time"
import { formatOrgClock, toOrgWallClockMinutes } from "@/lib/org-time"
import {
  formatShiftName,
  getShiftInitials,
  type TodayShift,
} from "@/lib/shifts/today-shifts"

export type BoardStatus = "on" | "late" | "absent" | "incoming" | "excused" | "remote" | "done"
export type LocationFilter = "all" | "in-person" | "remote"

export const BOARD_STATUS_ORDER: BoardStatus[] = [
  "on",
  "late",
  "absent",
  "incoming",
  "excused",
  "remote",
  "done",
]

export const BOARD_STATUS_LABELS: Record<BoardStatus, string> = {
  on: "On shift",
  late: "Late",
  absent: "Absent",
  incoming: "Incoming",
  excused: "Excused",
  remote: "Remote",
  done: "Completed",
}

export interface BoardRow {
  key: string
  studentAssistantId: number
  name: string
  firstName: string
  initials: string
  role: string
  isRemote: boolean
  startTime: string
  status: BoardStatus
  /** Minutes after scheduled start, for late arrivals. */
  minutesLate: number
  expected: string
  actual: string
  /** Remote shifts in their scheduled window count as on shift without a punch. */
  workingNow: boolean
}

function formatRange(start: string, end: string): string {
  return `${formatTime(start)} – ${formatTime(end)}`
}

function toBoardStatus(shift: TodayShift): BoardStatus {
  if (shift.clockOutActual) return "done"
  if (shift.clockInActual) return shift.status === "late" ? "late" : "on"
  if (shift.isRemote) return "remote"
  if (shift.status === "absent") return "absent"
  return "incoming"
}

export function buildBoardRows(
  shifts: TodayShift[],
  timeOffShifts: TodayTimeOffShift[],
  nowMinutes: number,
): BoardRow[] {
  const rows: BoardRow[] = shifts.map((shift) => {
    const status = toBoardStatus(shift)
    const start = timeToMinutes(shift.startTime)
    const end = timeToMinutes(shift.endTime)
    const clockIn = shift.clockInActual ? toOrgWallClockMinutes(shift.clockInActual) : Number.NaN

    let actual = "—"
    if (shift.clockInActual && shift.clockOutActual) {
      actual = `${formatOrgClock(shift.clockInActual)} – ${formatOrgClock(shift.clockOutActual)}`
    } else if (shift.clockInActual) {
      actual = `${formatOrgClock(shift.clockInActual)} – now`
    } else if (status === "remote") {
      actual = "Not required"
    } else if (status === "absent") {
      actual = "No clock-in"
    }

    return {
      key: `${shift.scheduleBlockId ?? "walk-in"}-${shift.studentAssistantId}`,
      studentAssistantId: shift.studentAssistantId,
      name: formatShiftName(shift),
      firstName: shift.firstName,
      initials: getShiftInitials(shift),
      role: shift.role,
      isRemote: shift.isRemote,
      startTime: shift.startTime ? normalizeTimeKey(shift.startTime) : "",
      status,
      minutesLate: status === "late" && !Number.isNaN(clockIn) ? Math.max(0, clockIn - start) : 0,
      expected: shift.startTime && shift.endTime ? formatRange(shift.startTime, shift.endTime) : "Unscheduled",
      actual,
      workingNow:
        status === "on" ||
        status === "late" ||
        (status === "remote" && start <= nowMinutes && nowMinutes < end),
    }
  })

  for (const shift of timeOffShifts) {
    rows.push({
      key: `time-off-${shift.scheduleBlockId}-${shift.studentAssistantId}`,
      studentAssistantId: shift.studentAssistantId,
      name: formatShiftName(shift),
      firstName: shift.firstName,
      initials: getShiftInitials(shift),
      role: shift.role,
      isRemote: shift.isRemote,
      startTime: normalizeTimeKey(shift.startTime),
      status: "excused",
      minutesLate: 0,
      expected: formatRange(shift.startTime, shift.endTime),
      actual: "Time off · Teams",
      workingNow: false,
    })
  }

  return rows
}

export function filterByLocation(rows: BoardRow[], location: LocationFilter): BoardRow[] {
  if (location === "all") return rows
  return rows.filter((row) => (location === "remote" ? row.isRemote : !row.isRemote))
}

export interface BoardGroup {
  startTime: string
  startMinutes: number
  rows: BoardRow[]
  started: boolean
  isNow: boolean
  onShift: number
}

/** Groups by scheduled start, earliest first; rows within a group by first name. */
export function groupByStartTime(rows: BoardRow[], nowMinutes: number): BoardGroup[] {
  const groups = new Map<string, BoardRow[]>()
  for (const row of rows) {
    const list = groups.get(row.startTime) ?? []
    list.push(row)
    groups.set(row.startTime, list)
  }

  return Array.from(groups.entries())
    .map(([startTime, groupRows]) => {
      // Walk-ins have no scheduled start and sort last.
      const startMinutes = startTime ? timeToMinutes(startTime) : Number.POSITIVE_INFINITY
      return {
        startTime,
        startMinutes,
        rows: groupRows.sort(
          (a, b) =>
            a.firstName.localeCompare(b.firstName, undefined, { sensitivity: "base" }) ||
            a.name.localeCompare(b.name),
        ),
        started: startMinutes <= nowMinutes,
        isNow: startMinutes <= nowMinutes && nowMinutes < startMinutes + 60,
        onShift: groupRows.filter((row) => row.workingNow).length,
      }
    })
    .sort((a, b) => a.startMinutes - b.startMinutes)
}

/** The group "Go to now" scrolls to: the latest one that has started, else the first. */
export function findNowGroup(groups: BoardGroup[]): BoardGroup | undefined {
  return groups.filter((group) => group.started).at(-1) ?? groups[0]
}

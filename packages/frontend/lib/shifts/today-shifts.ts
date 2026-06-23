import { todayShiftsApi } from "@/lib/api/today-shifts"
import { formatStudentRole, type StudentAssistant } from "@/lib/api/student-assistants"
import { timeToMinutes } from "@/lib/format-time"

export type TodayShiftStatus = "incoming" | "on-time" | "late" | "early" | "absent"

export interface TodayShift {
  scheduleBlockId: number | null
  studentAssistantId: number
  firstName: string
  lastName: string
  role: string
  startTime: string
  endTime: string
  clockInActual: string | null
  clockOutActual: string | null
  timeEntryId: number | null
  status: TodayShiftStatus
}

export interface ClockInStudentOption {
  studentAssistantId: number
  firstName: string
  lastName: string
  role: string
}

export function getTodayDay(): "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | null {
  const day = new Date().getDay()
  if (day === 0 || day === 6) return null

  const days = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
  ] as const
  return days[day - 1]
}

export async function fetchTodayShifts(): Promise<TodayShift[]> {
  return todayShiftsApi.listToday()
}

export function getClockedInShifts(shifts: TodayShift[]): TodayShift[] {
  return shifts
    .filter((shift) => shift.clockInActual && !shift.clockOutActual)
    .sort((a, b) =>
      (a.clockInActual ?? "").localeCompare(b.clockInActual ?? ""),
    )
}

export function getClockedInStudents(shifts: TodayShift[]): TodayShift[] {
  const byStudent = new Map<number, TodayShift>()

  for (const shift of getClockedInShifts(shifts)) {
    if (!byStudent.has(shift.studentAssistantId)) {
      byStudent.set(shift.studentAssistantId, shift)
    }
  }

  return Array.from(byStudent.values()).sort((a, b) =>
    (a.clockInActual ?? "").localeCompare(b.clockInActual ?? ""),
  )
}

export function getClockedInStudentIds(shifts: TodayShift[]): Set<number> {
  return new Set(getClockedInStudents(shifts).map((shift) => shift.studentAssistantId))
}

export function getClockInStudentOptions(
  students: StudentAssistant[],
  shifts: TodayShift[],
): ClockInStudentOption[] {
  const clockedInIds = getClockedInStudentIds(shifts)
  const roleOrder = (role: string) => (role === "Student Lead" ? 0 : 1)

  return students
    .filter((student) => student.is_active !== false && !clockedInIds.has(student.id))
    .map((student) => ({
      studentAssistantId: student.id,
      firstName: student.first_name ?? "",
      lastName: student.last_name ?? "",
      role: formatStudentRole(student.position),
    }))
    .sort((a, b) => {
      const roleDiff = roleOrder(a.role) - roleOrder(b.role)
      if (roleDiff !== 0) return roleDiff
      return formatShiftName(a).localeCompare(formatShiftName(b))
    })
}

export function getPendingClockInShifts(shifts: TodayShift[]): TodayShift[] {
  return shifts
    .filter((shift) => !shift.clockInActual)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
}

function pickNearestPendingShift(
  shifts: TodayShift[],
  now: Date = new Date(),
): TodayShift | null {
  if (shifts.length === 0) return null

  const nowMin = now.getHours() * 60 + now.getMinutes()
  const pending = shifts.filter((shift) => !shift.clockInActual)
  if (pending.length === 0) return null

  const inWindow = pending.filter((shift) => {
    const start = timeToMinutes(shift.startTime)
    const end = timeToMinutes(shift.endTime)
    if (Number.isNaN(start) || Number.isNaN(end)) return false
    return nowMin >= start && nowMin <= end
  })

  const pool = inWindow.length > 0 ? inWindow : pending
  const useStartTieBreak = inWindow.length > 0

  return pool.reduce<TodayShift | null>((best, shift) => {
    const start = timeToMinutes(shift.startTime)
    if (Number.isNaN(start)) return best

    const dist = useStartTieBreak ? start : Math.abs(nowMin - start)
    if (best === null) return shift

    const bestStart = timeToMinutes(best.startTime)
    const bestDist = useStartTieBreak ? bestStart : Math.abs(nowMin - bestStart)

    return dist < bestDist ? shift : best
  }, null)
}

export function getPendingClockInStudents(
  shifts: TodayShift[],
  now: Date = new Date(),
): TodayShift[] {
  const pending = getPendingClockInShifts(shifts)
  const byStudent = new Map<number, TodayShift[]>()

  for (const shift of pending) {
    const list = byStudent.get(shift.studentAssistantId) ?? []
    list.push(shift)
    byStudent.set(shift.studentAssistantId, list)
  }

  return Array.from(byStudent.values())
    .map((studentShifts) => pickNearestPendingShift(studentShifts, now))
    .filter((shift): shift is TodayShift => shift !== null)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
}

export const EXPECTED_ARRIVAL_WINDOW_MINUTES = 120

export function getExpectedArrivalShifts(
  shifts: TodayShift[],
  now: Date = new Date(),
): TodayShift[] {
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const windowEndMinutes = nowMinutes + EXPECTED_ARRIVAL_WINDOW_MINUTES

  return getPendingClockInShifts(shifts).filter((shift) => {
    const startMinutes = timeToMinutes(shift.startTime)
    if (Number.isNaN(startMinutes)) return false

    return startMinutes >= nowMinutes && startMinutes <= windowEndMinutes
  })
}

export function getExpectedArrivalStudents(
  shifts: TodayShift[],
  now: Date = new Date(),
): TodayShift[] {
  const expected = getExpectedArrivalShifts(shifts, now)
  const byStudent = new Map<number, TodayShift[]>()

  for (const shift of expected) {
    const list = byStudent.get(shift.studentAssistantId) ?? []
    list.push(shift)
    byStudent.set(shift.studentAssistantId, list)
  }

  return Array.from(byStudent.values())
    .map((studentShifts) => pickNearestPendingShift(studentShifts, now))
    .filter((shift): shift is TodayShift => shift !== null)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
}

export function formatShiftName(shift: Pick<TodayShift, "firstName" | "lastName">): string {
  return `${shift.firstName} ${shift.lastName}`.trim()
}

export function getShiftInitials(shift: Pick<TodayShift, "firstName" | "lastName">): string {
  return [shift.firstName, shift.lastName]
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

export function formatShiftStatusLabel(status: TodayShiftStatus): string {
  switch (status) {
    case "incoming":
      return "Incoming"
    case "on-time":
      return "On Time"
    case "late":
      return "Late"
    case "early":
      return "Early"
    case "absent":
      return "Absent"
  }
}

export function getShiftStatusBadgeClassName(status: TodayShiftStatus): string {
  switch (status) {
    case "incoming":
      return "border-border/80 bg-muted/40 text-muted-foreground shadow-none"
    case "on-time":
      return "border-transparent bg-accent/20 text-accent shadow-none"
    case "late":
      return "border-transparent bg-yellow-500/20 text-yellow-500 shadow-none"
    case "early":
      return "border-transparent bg-sky-500/20 text-sky-500 shadow-none"
    case "absent":
      return "border-transparent bg-destructive/20 text-destructive shadow-none"
  }
}

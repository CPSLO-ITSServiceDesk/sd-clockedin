import { todayShiftsApi } from "@/lib/api/today-shifts"
import { timeToMinutes } from "@/lib/format-time"

export type TodayShiftStatus = "incoming" | "on-time" | "late" | "early" | "absent"

export interface TodayShift {
  scheduleBlockId: number
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

export function getPendingClockInShifts(shifts: TodayShift[]): TodayShift[] {
  return shifts
    .filter((shift) => !shift.clockInActual)
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

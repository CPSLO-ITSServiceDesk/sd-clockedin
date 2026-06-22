import { GRID_START_HOUR } from "@/components/admin/schedules/schedule-types"
import { timeToMinutes } from "@/components/admin/schedules/schedule-utils"
import { formatStartTimeHeader } from "@/lib/format-time"
import type { TodayShift } from "@/lib/shifts/today-shifts"
import { getExpectedArrivalShifts } from "@/lib/shifts/today-shifts"

/** Last clock-in hour shown on the dashboard chart (4 PM). */
export const DASHBOARD_CHART_END_HOUR = 16

export const LAST_WORKING_HOUR_START = `${String(DASHBOARD_CHART_END_HOUR).padStart(2, "0")}:00`

export function isDuringLastWorkingHour(now: Date = new Date()): boolean {
  return now.getHours() === DASHBOARD_CHART_END_HOUR
}

export interface DashboardKpis {
  late: number
  absent: number
  onShift: number
  incomingNextTwoHours: number
}

export interface HourlyHeadcount {
  startTime: string
  label: string
  expected: number
  actual: number
}

function formatHourSlot(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`
}

function getHourWindow(hour: number): { start: number; end: number } {
  const start = hour * 60
  return { start, end: start + 60 }
}

/** Whether a shift is scheduled to overlap the given hour window. */
export function isScheduledDuringHour(shift: TodayShift, hour: number): boolean {
  const { start: hourStart, end: hourEnd } = getHourWindow(hour)
  const shiftStart = timeToMinutes(shift.startTime)
  const shiftEnd = timeToMinutes(shift.endTime)

  if (Number.isNaN(shiftStart) || Number.isNaN(shiftEnd)) return false

  return shiftStart < hourEnd && shiftEnd > hourStart
}

/** Whether a clock-in/out record shows the person working during the given hour. */
export function isWorkingDuringHour(
  shift: TodayShift,
  hour: number,
  now: Date = new Date(),
): boolean {
  const { start: hourStart, end: hourEnd } = getHourWindow(hour)
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  if (nowMinutes < hourStart) return false
  if (!shift.clockInActual) return false

  const clockIn = timeToMinutes(shift.clockInActual)
  if (Number.isNaN(clockIn) || clockIn >= hourEnd) return false

  if (!shift.clockOutActual) return true

  const clockOut = timeToMinutes(shift.clockOutActual)
  if (Number.isNaN(clockOut)) return true

  return clockOut > hourStart
}

export function countWorkingDuringHour(
  shifts: TodayShift[],
  hour: number,
  now: Date = new Date(),
): number {
  return shifts.filter((shift) => isWorkingDuringHour(shift, hour, now)).length
}

export function buildWorkingHourSlots(
  startHour: number = GRID_START_HOUR,
  endHour: number = DASHBOARD_CHART_END_HOUR,
): string[] {
  const slots: string[] = []
  for (let hour = startHour; hour <= endHour; hour++) {
    slots.push(formatHourSlot(hour))
  }
  return slots
}

export function computeDashboardKpis(
  shifts: TodayShift[],
  now: Date = new Date(),
): DashboardKpis {
  return {
    late: shifts.filter((shift) => shift.status === "late").length,
    absent: shifts.filter((shift) => shift.status === "absent").length,
    onShift: shifts.filter(
      (shift) => shift.clockInActual && !shift.clockOutActual,
    ).length,
    incomingNextTwoHours: getExpectedArrivalShifts(shifts, now).length,
  }
}

export function computeHourlyHeadcount(
  shifts: TodayShift[],
  now: Date = new Date(),
): HourlyHeadcount[] {
  return buildWorkingHourSlots().map((startTime) => {
    const hour = Number.parseInt(startTime.split(":")[0] ?? "", 10)
    let expected = 0
    let actual = 0

    for (const shift of shifts) {
      if (isScheduledDuringHour(shift, hour)) {
        expected += 1
      }
      if (isWorkingDuringHour(shift, hour, now)) {
        actual += 1
      }
    }

    return {
      startTime,
      label: formatStartTimeHeader(startTime),
      expected,
      actual,
    }
  })
}

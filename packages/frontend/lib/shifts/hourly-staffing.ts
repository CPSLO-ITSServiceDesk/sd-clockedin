import { GRID_START_HOUR } from "@/components/admin/schedules/schedule-types"
import { timeToMinutes } from "@/components/admin/schedules/schedule-utils"
import { formatStartTimeHeader } from "@/lib/format-time"
import { getOrgLocalMinutes } from "@/lib/org-time"
import {
  computeHourlyHeadcount,
  DASHBOARD_CHART_END_HOUR,
  isRemoteWorkingDuringHour,
  isWorkingDuringHour,
} from "@/lib/shifts/dashboard-stats"
import {
  formatOrgDateString,
  getStaffingReferenceNow,
  isOrgToday,
  isOrgWeekendDate,
} from "@/lib/shifts/hourly-staffing-dates"
import type { TodayShift } from "@/lib/shifts/today-shifts"

export type NameFormat = "first-last" | "first-initial" | "first"
export type SlackPrefix = "" | "- " | "• "

export interface StaffingKpis {
  scheduled: number
  workingNow: number
  peakHourLabel: string
  peakCount: number
}

export interface TimelineBlock {
  leftPct: number
  widthPct: number
  filled: boolean
  title: string
}

export interface TimelineRow {
  key: string
  name: string
  isRemote: boolean
  earliest: number
  blocks: TimelineBlock[]
}

export interface NowMarker {
  visible: boolean
  fraction: number
  label: string
}

export interface HourlyStaffingView {
  kpis: StaffingKpis
  timelineRows: TimelineRow[]
  axisTicks: string[]
  nowMarker: NowMarker
  slackText: string
  slackCount: number
  isWeekend: boolean
}

export interface BuildHourlyStaffingOptions {
  nameFormat?: NameFormat
  slackPrefix?: SlackPrefix
  now?: Date
}

const AXIS_START_MIN = GRID_START_HOUR * 60
const AXIS_END_MIN = DASHBOARD_CHART_END_HOUR * 60
const AXIS_SPAN_MIN = AXIS_END_MIN - AXIS_START_MIN

function pad(n: number): string {
  return String(n).padStart(2, "0")
}

function minutesToHourLabel(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  const hh = ((h + 11) % 12) + 1
  const period = h < 12 ? "AM" : "PM"
  if (m === 0) return `${hh} ${period}`
  return `${hh}:${pad(m)} ${period}`
}

function minutesToCompactHour(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  const hh = ((h + 11) % 12) + 1
  if (m === 0) return String(hh)
  return `${hh}:${pad(m)}`
}

export function formatStaffingName(
  firstName: string,
  lastName: string,
  format: NameFormat = "first-initial",
): string {
  if (format === "first-last") return `${firstName} ${lastName}`.trim()
  if (format === "first") return firstName
  const initial = lastName ? `${lastName[0]}.` : ""
  return `${firstName} ${initial}`.trim()
}

/** Currently on shift: open clock-in within window, or remote coverage in window. */
function isShiftWorkingNow(shift: TodayShift, now: Date): boolean {
  const start = timeToMinutes(shift.startTime)
  const end = timeToMinutes(shift.endTime)
  if (Number.isNaN(start) || Number.isNaN(end)) return false

  const nowMin = getOrgLocalMinutes(now)
  if (nowMin < start || nowMin >= end) return false

  if (shift.isRemote) {
    const hour = Math.floor(nowMin / 60)
    return (
      isRemoteWorkingDuringHour(shift, hour, now) ||
      isWorkingDuringHour(shift, hour, now)
    )
  }

  return Boolean(shift.clockInActual) && !shift.clockOutActual
}

/**
 * Solid timeline bar = attended / covering.
 * - Live today: currently working (open clock-in or remote in window)
 * - Historical: remote scheduled, or any clock-in recorded
 */
function isBlockFilled(
  shift: TodayShift,
  now: Date,
  isHistorical: boolean,
): boolean {
  if (!isHistorical) return isShiftWorkingNow(shift, now)
  if (shift.isRemote) return true
  return Boolean(shift.clockInActual)
}

function studentKey(shift: TodayShift): string {
  return `${shift.studentAssistantId}`
}

export function buildTimelineRows(
  shifts: TodayShift[],
  now: Date,
  nameFormat: NameFormat = "first-initial",
  isHistorical: boolean = false,
): TimelineRow[] {
  const byStudent = new Map<string, TimelineRow>()

  for (const shift of shifts) {
    const start = timeToMinutes(shift.startTime)
    const end = timeToMinutes(shift.endTime)
    if (Number.isNaN(start) || Number.isNaN(end) || !shift.startTime) continue

    const key = studentKey(shift)
    const name = formatStaffingName(shift.firstName, shift.lastName, nameFormat)
    let row = byStudent.get(key)
    if (!row) {
      row = {
        key,
        name,
        isRemote: shift.isRemote,
        earliest: start,
        blocks: [],
      }
      byStudent.set(key, row)
    }

    row.earliest = Math.min(row.earliest, start)
    row.isRemote = row.isRemote || shift.isRemote

    const leftPct = Math.max(0, ((start - AXIS_START_MIN) / AXIS_SPAN_MIN) * 100)
    const widthPct = Math.min(
      100 - leftPct,
      ((end - start) / AXIS_SPAN_MIN) * 100,
    )

    row.blocks.push({
      leftPct,
      widthPct: Math.max(widthPct, 0),
      filled: isBlockFilled(shift, now, isHistorical),
      title: `${minutesToHourLabel(start)} – ${minutesToHourLabel(end)}`,
    })
  }

  return Array.from(byStudent.values()).sort(
    (a, b) => a.earliest - b.earliest || a.name.localeCompare(b.name),
  )
}

export function buildSlackScheduleText(
  shifts: TodayShift[],
  options: { nameFormat?: NameFormat; slackPrefix?: SlackPrefix } = {},
): string {
  const nameFormat = options.nameFormat ?? "first-initial"
  const prefix = options.slackPrefix ?? ""

  const lines = shifts
    .filter((shift) => shift.startTime && shift.endTime)
    .map((shift) => {
      const start = timeToMinutes(shift.startTime)
      const end = timeToMinutes(shift.endTime)
      return { shift, start, end }
    })
    .filter(({ start, end }) => !Number.isNaN(start) && !Number.isNaN(end))
    .sort(
      (a, b) =>
        a.start - b.start ||
        a.shift.firstName.localeCompare(b.shift.firstName),
    )
    .map(({ shift, start, end }) => {
      const name = formatStaffingName(
        shift.firstName,
        shift.lastName,
        nameFormat,
      )
      const remote = shift.isRemote ? " (Remote)" : ""
      return `${prefix}${name} ${minutesToCompactHour(start)}-${minutesToCompactHour(end)}${remote}`
    })

  return lines.join("\n")
}

export function buildStaffingKpis(
  shifts: TodayShift[],
  now: Date,
): StaffingKpis {
  const scheduled = new Set(
    shifts
      .filter((shift) => shift.startTime)
      .map((shift) => studentKey(shift)),
  ).size

  const headcount = computeHourlyHeadcount(shifts, now)
  const nowMin = getOrgLocalMinutes(now)
  const currentSlot = headcount.find((slot) => {
    const hour = Number.parseInt(slot.startTime.split(":")[0] ?? "", 10)
    return hour * 60 <= nowMin && nowMin < hour * 60 + 60
  })

  const peak = headcount.reduce(
    (best, slot) => (slot.expected > best.expected ? slot : best),
    headcount[0] ?? {
      startTime: formatHourSlot(GRID_START_HOUR),
      label: formatStartTimeHeader(formatHourSlot(GRID_START_HOUR)),
      expected: 0,
      actual: 0,
      expectedInPerson: 0,
      expectedRemote: 0,
      actualInPerson: 0,
      actualRemote: 0,
    },
  )

  return {
    scheduled,
    workingNow: currentSlot?.actual ?? 0,
    peakHourLabel: peak.label,
    peakCount: peak.expected,
  }
}

function formatHourSlot(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`
}

export function buildAxisTicks(): string[] {
  const ticks: string[] = []
  for (let hour = GRID_START_HOUR; hour <= DASHBOARD_CHART_END_HOUR; hour++) {
    ticks.push(minutesToCompactHour(hour * 60))
  }
  return ticks
}

export function buildNowMarker(now: Date): NowMarker {
  const nowMin = getOrgLocalMinutes(now)
  const visible = nowMin >= AXIS_START_MIN && nowMin <= AXIS_END_MIN
  const fraction = Math.max(
    0,
    Math.min(1, (nowMin - AXIS_START_MIN) / AXIS_SPAN_MIN),
  )

  return {
    visible,
    fraction,
    label: minutesToHourLabel(nowMin),
  }
}

export function buildHourlyStaffingView(
  shifts: TodayShift[],
  viewDateStr: string,
  options: BuildHourlyStaffingOptions = {},
): HourlyStaffingView {
  const nameFormat = options.nameFormat ?? "first-initial"
  const slackPrefix = options.slackPrefix ?? ""
  const clock = options.now ?? new Date()
  const referenceNow = getStaffingReferenceNow(viewDateStr, clock)
  const viewingToday = isOrgToday(viewDateStr, clock)
  const isHistorical = viewDateStr < formatOrgDateString(clock)

  const scheduledShifts = shifts.filter((shift) => Boolean(shift.startTime))
  const slackText = buildSlackScheduleText(scheduledShifts, {
    nameFormat,
    slackPrefix,
  })

  return {
    kpis: buildStaffingKpis(scheduledShifts, referenceNow),
    timelineRows: buildTimelineRows(
      scheduledShifts,
      referenceNow,
      nameFormat,
      isHistorical,
    ),
    axisTicks: buildAxisTicks(),
    nowMarker: viewingToday
      ? buildNowMarker(referenceNow)
      : { visible: false, fraction: 0, label: "" },
    slackText,
    slackCount: slackText ? slackText.split("\n").length : 0,
    isWeekend: isOrgWeekendDate(viewDateStr),
  }
}

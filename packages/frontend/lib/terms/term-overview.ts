import type { TermOffDays, Weekday } from "@/components/admin/terms/term-types"

const DAY_MS = 86_400_000
const SHORT_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function toUtc(date: string): number {
  const [y, m, d] = date.split("-").map(Number)
  return Date.UTC(y, m - 1, d)
}

function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10)
}

export function addDays(date: string, days: number): string {
  return fromUtc(toUtc(date) + days * DAY_MS)
}

function weekdayIndex(date: string): number {
  return new Date(toUtc(date)).getUTCDay()
}

function isWeekday(date: string): boolean {
  const day = weekdayIndex(date)
  return day > 0 && day < 6
}

function mondayOf(date: string): string {
  return addDays(date, -((weekdayIndex(date) + 6) % 7))
}

/** "Sep 8" */
export function formatShortDate(date: string): string {
  return new Date(toUtc(date)).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" })
}

/** "Sep 8, 2026" */
export function formatLongDate(date: string): string {
  return new Date(toUtc(date)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function countTermWeeks(start: string, end: string): number {
  return Math.round((toUtc(mondayOf(end)) - toUtc(mondayOf(start))) / (7 * DAY_MS)) + 1
}

export type TermStatus = "active" | "upcoming" | "ended" | "inactive"

export function termStatus(
  term: { is_active: boolean | null; start_date: string | null; end_date: string | null },
  today: string,
): TermStatus {
  if (term.is_active) return "active"
  if (term.start_date && term.start_date > today) return "upcoming"
  if (term.end_date && term.end_date < today) return "ended"
  return "inactive"
}

export interface TermCounts {
  workingDays: number
  daysOff: number
  swaps: number
}

/** Weekdays in the term, minus days off; only exceptions inside the term are counted. */
export function countTermDays(start: string, end: string, offDays: TermOffDays): TermCounts {
  const inTerm = (date: string) => date >= start && date <= end && isWeekday(date)
  const offDates = new Set(offDays.vacations.map((vacation) => vacation.date).filter(inTerm))

  let workingDays = 0
  for (let date = start; date <= end; date = addDays(date, 1)) {
    if (isWeekday(date) && !offDates.has(date)) workingDays += 1
  }

  return {
    workingDays,
    daysOff: offDates.size,
    swaps: offDays.special_schedules.filter((swap) => inTerm(swap.date)).length,
  }
}

export function summarizeCounts(counts: TermCounts): string {
  const parts = [
    counts.daysOff ? `${counts.daysOff} ${counts.daysOff === 1 ? "day off" : "days off"}` : "",
    counts.swaps ? `${counts.swaps} ${counts.swaps === 1 ? "swap" : "swaps"}` : "",
  ].filter(Boolean)
  return parts.length > 0 ? parts.join(" · ") : "None"
}

export interface TermWeek {
  index: number
  monday: string
  state: "past" | "current" | "future"
  daysOff: number
  swaps: number
}

export function buildTermWeeks(start: string, end: string, offDays: TermOffDays, today: string): TermWeek[] {
  const firstMonday = mondayOf(start)
  const currentMonday = mondayOf(today)
  const offDates = new Set(offDays.vacations.map((vacation) => vacation.date))
  const swapDates = new Set(offDays.special_schedules.map((swap) => swap.date))

  return Array.from({ length: countTermWeeks(start, end) }, (_, index) => {
    const monday = addDays(firstMonday, index * 7)
    let daysOff = 0
    let swaps = 0
    for (let offset = 0; offset < 5; offset += 1) {
      const date = addDays(monday, offset)
      if (date < start || date > end) continue
      if (offDates.has(date)) daysOff += 1
      else if (swapDates.has(date)) swaps += 1
    }
    return {
      index,
      monday,
      state: monday < currentMonday ? "past" : monday === currentMonday ? "current" : "future",
      daysOff,
      swaps,
    }
  })
}

/** 1-based week of `today` within the term, clamped to the term. */
export function currentWeekNumber(start: string, end: string, today: string): number {
  const total = countTermWeeks(start, end)
  const week = Math.floor((toUtc(mondayOf(today)) - toUtc(mondayOf(start))) / (7 * DAY_MS)) + 1
  return Math.min(Math.max(week, 1), total)
}

export type TermException =
  | { kind: "off"; start: string; end: string; dates: string[]; label: string | null }
  | { kind: "swap"; start: string; end: string; dates: string[]; label: string | null; swapTo: Weekday }

/**
 * Days off and swaps in date order. Consecutive weekday days off with the same
 * label (e.g. a Thanksgiving break) are grouped into one range.
 */
export function groupTermExceptions(offDays: TermOffDays): TermException[] {
  const entries: TermException[] = [
    ...offDays.vacations.map((vacation) => ({
      kind: "off" as const,
      start: vacation.date,
      end: vacation.date,
      dates: [vacation.date],
      label: vacation.label?.trim() || null,
    })),
    ...offDays.special_schedules.map((swap) => ({
      kind: "swap" as const,
      start: swap.date,
      end: swap.date,
      dates: [swap.date],
      label: swap.label?.trim() || null,
      swapTo: swap.swap_to_day,
    })),
  ].sort((a, b) => a.start.localeCompare(b.start))

  const grouped: TermException[] = []
  for (const entry of entries) {
    const last = grouped.at(-1)
    const nextWorkday = last ? addDays(last.end, weekdayIndex(last.end) === 5 ? 3 : 1) : null
    if (
      last &&
      entry.kind === "off" &&
      last.kind === "off" &&
      last.label === entry.label &&
      nextWorkday === entry.start
    ) {
      last.end = entry.start
      last.dates.push(entry.start)
      continue
    }
    grouped.push({ ...entry, dates: [...entry.dates] })
  }
  return grouped
}

export function formatExceptionWhen(exception: TermException): string {
  if (exception.dates.length === 1) {
    return `${SHORT_DAYS[weekdayIndex(exception.start)]}, ${formatShortDate(exception.start)}`
  }
  const sameMonth = exception.start.slice(0, 7) === exception.end.slice(0, 7)
  return `${formatShortDate(exception.start)} – ${sameMonth ? Number(exception.end.slice(8)) : formatShortDate(exception.end)}`
}

/** All weekdays from start to end, inclusive. */
export function weekdaysBetween(start: string, end: string): string[] {
  const dates: string[] = []
  for (let date = start; date <= end; date = addDays(date, 1)) {
    if (isWeekday(date)) dates.push(date)
  }
  return dates
}

export function isWeekdayDate(date: string): boolean {
  return isWeekday(date)
}

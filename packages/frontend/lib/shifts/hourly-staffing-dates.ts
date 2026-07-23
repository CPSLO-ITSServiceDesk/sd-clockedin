import {
  getOrgDayOfWeek,
  getOrgLocalDateString,
  getOrgLocalInstant,
  getOrgLocalMinutes,
  ORG_TIMEZONE,
} from "@/lib/org-time"
import { DASHBOARD_CHART_END_HOUR } from "@/lib/shifts/dashboard-stats"

/** Format a Date as YYYY-MM-DD in the organization timezone. */
export function formatOrgDateString(date: Date = new Date()): string {
  return getOrgLocalDateString(date)
}

/** Alias kept for existing call sites. */
export const formatLocalDateString = formatOrgDateString

/** Shift a YYYY-MM-DD calendar date by a number of days (calendar arithmetic). */
export function addOrgDateDays(dateStr: string, delta: number): string {
  const [year, month, day] = dateStr.split("-").map(Number)
  const utc = new Date(Date.UTC(year, month - 1, day))
  utc.setUTCDate(utc.getUTCDate() + delta)
  const y = utc.getUTCFullYear()
  const m = String(utc.getUTCMonth() + 1).padStart(2, "0")
  const d = String(utc.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

/** Alias kept for existing call sites. */
export const addLocalDateDays = addOrgDateDays

/**
 * Reference instant for staffing KPIs / timeline on a view date.
 * Mirrors backend resolveShiftsReferenceNow:
 * - today → live clock
 * - past → 4 PM org-local (all daytime hours elapsed)
 * - future → midnight org-local (no hours started)
 */
export function getStaffingReferenceNow(
  viewDateStr: string,
  now: Date = new Date(),
): Date {
  const today = getOrgLocalDateString(now)
  if (viewDateStr === today) return now
  if (viewDateStr < today) {
    return getOrgLocalInstant(viewDateStr, DASHBOARD_CHART_END_HOUR, 0)
  }
  return getOrgLocalInstant(viewDateStr, 0, 0)
}

export function isOrgToday(
  viewDateStr: string,
  now: Date = new Date(),
): boolean {
  return viewDateStr === getOrgLocalDateString(now)
}

export function isOrgWeekendDate(dateStr: string): boolean {
  const noon = getOrgLocalInstant(dateStr, 12, 0)
  const day = getOrgDayOfWeek(noon)
  return day === 0 || day === 6
}

export function formatWeekdayLabel(dateStr: string): string {
  return getOrgLocalInstant(dateStr, 12, 0).toLocaleDateString("en-US", {
    timeZone: ORG_TIMEZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
  })
}

export function formatShortDateLabel(dateStr: string): string {
  return getOrgLocalInstant(dateStr, 12, 0).toLocaleDateString("en-US", {
    timeZone: ORG_TIMEZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
  })
}

export { getOrgLocalMinutes }

import type {
  StudentMonthSummary,
  TimesheetDay,
} from "@/lib/api/timesheet"
import { formatTime } from "@/lib/format-time"
import { getOrgLocalInstant, ORG_TIMEZONE } from "@/lib/org-time"

/** "2026-09" */
export function toMonthKey(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`
}

export function shiftMonthKey(month: string, delta: number): string {
  const [year, monthNumber] = month.split("-").map(Number)
  const date = new Date(Date.UTC(year, monthNumber - 1 + delta, 1))
  return toMonthKey(date.getUTCFullYear(), date.getUTCMonth())
}

export function formatMonthLabel(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number)
  return new Date(Date.UTC(year, monthNumber - 1, 1)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  })
}

export function formatHours(hours: number): string {
  return hours.toFixed(1)
}

export function formatSignedHours(hours: number): string {
  const rounded = Math.round(hours * 10) / 10
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(1)}`
}

/** Sun-first weeks of YYYY-MM-DD dates; null pads days outside the month. */
export function buildMonthWeeks(month: string): (string | null)[][] {
  const [year, monthNumber] = month.split("-").map(Number)
  const firstWeekday = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay()
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate()

  const cells: (string | null)[] = Array.from({ length: firstWeekday }, () => null)
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(`${month}-${String(day).padStart(2, "0")}`)
  }
  while (cells.length % 7 !== 0) cells.push(null)

  const weeks: (string | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

export function formatDayTitle(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
  })
}

export function formatCellDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  })
}

export const ISSUE_STATUSES = new Set<TimesheetDay["status"]>(["off", "absent", "open", "unscheduled"])

/** Statuses that are shown with a review marker and count as days to review. */
export function isIssueDay(day: TimesheetDay): boolean {
  return ISSUE_STATUSES.has(day.status)
}

/** First day needing review, else the most recent judged day, else the first day. */
export function pickDefaultDay(days: TimesheetDay[]): string | null {
  const issue = days.find(isIssueDay)
  if (issue) return issue.date
  const judged = days.filter((day) => day.status !== "upcoming")
  return judged.at(-1)?.date ?? days[0]?.date ?? null
}

export type StudentTag = { label: string; tone: "verified" | "issues" | "ready" | "empty" }

export function studentTag(summary: StudentMonthSummary | undefined): StudentTag {
  if (summary?.verification) return { label: "Verified", tone: "verified" }
  if (!summary || (summary.workedHours === 0 && summary.scheduledHours === 0 && summary.issueCount === 0)) {
    return { label: "No hours", tone: "empty" }
  }
  if (summary.issueCount > 0) {
    return { label: `${summary.issueCount} ${summary.issueCount === 1 ? "issue" : "issues"}`, tone: "issues" }
  }
  return { label: "Ready", tone: "ready" }
}

/** Org-local "HH:mm" for an ISO timestamp, for time inputs. */
export function toOrgTimeInput(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ORG_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso))
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00"
  return `${get("hour")}:${get("minute")}`
}

/** ISO instant for an org-local "HH:mm" on `date`. */
export function fromOrgTimeInput(date: string, time: string): string {
  const [hour, minute] = time.split(":").map(Number)
  return getOrgLocalInstant(date, hour, minute).toISOString()
}

export function formatBlockRange(start: string, end: string): string {
  return `${formatTime(start)} – ${formatTime(end)}`
}

export function formatDuration(hours: number | null): string {
  if (hours == null) return "—"
  const totalMinutes = Math.round(hours * 60)
  return `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`
}

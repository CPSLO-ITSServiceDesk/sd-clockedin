import type {
  LateHeatmapCell,
  StudentBreakdownEntry,
  TermAnalytics,
} from "@/lib/api/analytics"
import type { Term } from "@/lib/api/terms"

const DAY_LABELS: Record<string, { short: string; plural: string }> = {
  monday: { short: "Mon", plural: "Mondays" },
  tuesday: { short: "Tue", plural: "Tuesdays" },
  wednesday: { short: "Wed", plural: "Wednesdays" },
  thursday: { short: "Thu", plural: "Thursdays" },
  friday: { short: "Fri", plural: "Fridays" },
}

export const HEATMAP_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday"] as const

/** A hotspot needs enough shifts that one late arrival doesn't dominate. */
const HOTSPOT_MIN_SHIFTS = 5
const HOTSPOT_MIN_LATE = 2

export function formatDayShort(day: string): string {
  return DAY_LABELS[day]?.short ?? day
}

export function formatHourLabel(hour: number, style: "short" | "long" = "short"): string {
  const h = hour % 12 || 12
  if (style === "long") return `${h} ${hour >= 12 ? "PM" : "AM"}`
  return `${h}${hour >= 12 ? "p" : "a"}`
}

function daysBetween(start: string, end: string): number {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000)
}

/** "Fall 2026 · week 6 of 15", or the date range once the term is over. */
export function formatTermProgress(term: Term, today: string): string {
  const name = term.name ?? "Term"
  if (!term.start_date || !term.end_date) return name

  const totalWeeks = Math.max(1, Math.ceil((daysBetween(term.start_date, term.end_date) + 1) / 7))
  if (today < term.start_date) return `${name} · starts ${formatShortDate(term.start_date)}`
  if (today > term.end_date) return `${name} · ended ${formatShortDate(term.end_date)}`

  const week = Math.floor(daysBetween(term.start_date, today) / 7) + 1
  return `${name} · week ${week} of ${totalWeeks}`
}

export function formatShortDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  })
}

/** The term that started most recently before `term`. */
export function findPreviousTerm(terms: Term[], term: Term | undefined): Term | undefined {
  if (!term?.start_date) return undefined
  return terms
    .filter((candidate) => candidate.start_date && candidate.start_date < term.start_date!)
    .sort((a, b) => (b.start_date ?? "").localeCompare(a.start_date ?? ""))[0]
}

export function findLatenessHotspot(cells: LateHeatmapCell[]): LateHeatmapCell | null {
  return cells
    .filter((cell) => cell.total >= HOTSPOT_MIN_SHIFTS && cell.late >= HOTSPOT_MIN_LATE)
    .sort((a, b) => b.late / b.total - a.late / a.total || b.late - a.late)[0] ?? null
}

export interface SummarySentence {
  punctuality: number | null
  comparison: string | null
  hotspot: string | null
  excused: number
}

export function buildSummarySentence(
  analytics: TermAnalytics,
  previous: { term: Term; analytics: TermAnalytics } | null,
): SummarySentence {
  const { summary } = analytics
  const punctuality =
    summary.totalEvaluated > 0 ? Math.round(summary.punctualityRate * 100) : null

  let comparison: string | null = null
  if (punctuality !== null && previous && previous.analytics.summary.totalEvaluated > 0) {
    const delta = punctuality - Math.round(previous.analytics.summary.punctualityRate * 100)
    const name = previous.term.name ?? "last term"
    if (delta === 0) comparison = `level with ${name}`
    else comparison = `${delta > 0 ? "up" : "down"} ${Math.abs(delta)} point${Math.abs(delta) === 1 ? "" : "s"} from ${name}`
  }

  const hotspotCell = findLatenessHotspot(analytics.lateHeatmap)
  const hotspot = hotspotCell
    ? `${formatHourLabel(hotspotCell.hour, "long")} on ${DAY_LABELS[hotspotCell.day]?.plural ?? hotspotCell.day}`
    : null

  return { punctuality, comparison, hotspot, excused: summary.excused }
}

export type StripCode = "o" | "l" | "a" | "e"

export function parseStrip(strip: string): StripCode[] {
  return strip.split("").filter((code): code is StripCode => "olae".includes(code))
}

function csvCell(value: string | number): string {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function buildStudentBreakdownCsv(
  entries: StudentBreakdownEntry[],
  names: ReadonlyMap<number, string>,
): string {
  const header = [
    "Student",
    "Shifts evaluated",
    "Late",
    "Absent",
    "Excused (time off)",
    "Avg minutes late",
    "Punctuality %",
  ]
  const rows = entries.map((entry) => [
    names.get(entry.studentAssistantId) ?? `Student #${entry.studentAssistantId}`,
    entry.total,
    entry.late,
    entry.absent,
    entry.excused,
    entry.avgMinutesLate,
    entry.total > 0 ? Math.round(((entry.total - entry.late - entry.absent) / entry.total) * 100) : "",
  ])
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n")
}

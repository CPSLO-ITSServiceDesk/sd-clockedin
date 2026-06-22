import type { ScheduleBlock } from "@/lib/api/scheduleBlocks"
import type { Term } from "@/lib/api/terms"
import type { TimeEntry } from "@/lib/api/time-entries"
import { formatTime, normalizeTimeKey } from "@/lib/format-time"

export function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""

  const pad = (value: number) => value.toString().padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function fromDatetimeLocalValue(value: string): string {
  const date = new Date(value)
  return date.toISOString()
}

export function getEntryDateLabel(clockIn: string | null): string {
  if (!clockIn) return "—"
  const date = new Date(clockIn)
  if (Number.isNaN(date.getTime())) return "—"

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date)
}

export function getEntryDurationMinutes(entry: TimeEntry): number | null {
  if (!entry.clock_in) return null

  const start = new Date(entry.clock_in)
  const end = entry.clock_out ? new Date(entry.clock_out) : null

  if (Number.isNaN(start.getTime())) return null
  if (!end || Number.isNaN(end.getTime())) return null

  const minutes = Math.round((end.getTime() - start.getTime()) / 60_000)
  return minutes >= 0 ? minutes : null
}

export function formatDuration(minutes: number | null): string {
  if (minutes === null) return "—"
  if (minutes < 60) return `${minutes}m`

  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`
}

export function formatBlockLabel(block: ScheduleBlock): string {
  const day = block.days
    ? block.days.charAt(0).toUpperCase() + block.days.slice(1)
    : "Unknown day"
  const start = block.start_time ? formatTime(block.start_time) : "—"
  const end = block.end_time ? formatTime(block.end_time) : "—"
  return `${day} · ${start} – ${end}`
}

export function entryMatchesTerm(
  entry: TimeEntry,
  term: Term | undefined,
  termBlockIds: Set<number>,
): boolean {
  if (entry.schedule_block_id && termBlockIds.has(entry.schedule_block_id)) {
    return true
  }

  if (!term?.start_date || !term.end_date || !entry.clock_in) {
    return !term
  }

  const clockInDate = entry.clock_in.slice(0, 10)
  return clockInDate >= term.start_date && clockInDate <= term.end_date
}

export function getStudentTermBlockIds(
  studentId: number,
  termId: number,
  schedules: { id: number; student_assistant_id: number | null; academic_term_id: number | null }[],
  blocks: ScheduleBlock[],
): Set<number> {
  const schedule = schedules.find(
    (entry) =>
      entry.student_assistant_id === studentId &&
      entry.academic_term_id === termId,
  )

  if (!schedule) return new Set()

  return new Set(
    blocks
      .filter((block) => block.schedule_id === schedule.id)
      .map((block) => block.id),
  )
}

export function sortTimeEntries(entries: TimeEntry[]): TimeEntry[] {
  return [...entries].sort((a, b) => {
    const aTime = a.clock_in ? new Date(a.clock_in).getTime() : 0
    const bTime = b.clock_in ? new Date(b.clock_in).getTime() : 0
    return bTime - aTime
  })
}

export function normalizeBlockTime(value: string | null): string | null {
  if (!value) return null
  return normalizeTimeKey(value)
}

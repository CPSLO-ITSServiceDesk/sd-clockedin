import {
  GRID_END_HOUR,
  GRID_START_HOUR,
  type DraftScheduleBlock,
  type Weekday,
} from "@/components/admin/schedules/schedule-types"
import { minutesToTime, timeToMinutes } from "@/components/admin/schedules/schedule-utils"
import { WEEKDAY_OPTIONS } from "@/components/admin/terms/term-types"

/** Hours with fewer in-person people than this are flagged as thin. */
export const THIN_COVERAGE_THRESHOLD = 3

/** Coverage bars scale to at least this many people so a quiet week isn't all full bars. */
const COVERAGE_MIN_SCALE = 6

export const COVERAGE_HOURS = Array.from(
  { length: GRID_END_HOUR - GRID_START_HOUR },
  (_, i) => GRID_START_HOUR + i,
)

const GRID_START_MINUTES = GRID_START_HOUR * 60
const GRID_SPAN_MINUTES = (GRID_END_HOUR - GRID_START_HOUR) * 60

/** "8a", "12p" */
export function formatHourShort(hour: number): string {
  return `${hour % 12 || 12}${hour < 12 ? "a" : "p"}`
}

export interface CoverageHour {
  hour: number
  count: number
  thin: boolean
  /** Bar height as a percent of the tallest possible bar. */
  height: number
}

export interface CoverageDay {
  day: Weekday
  hours: CoverageHour[]
  thinCount: number
}

/** In-person headcount per weekday hour; a block counts toward any hour it overlaps. */
export function buildCoverage(schedules: DraftScheduleBlock[][]): CoverageDay[] {
  const counts = WEEKDAY_OPTIONS.map(({ value }) => ({
    day: value,
    counts: COVERAGE_HOURS.map((hour) => {
      const slotStart = hour * 60
      const slotEnd = slotStart + 60
      return schedules.filter((blocks) =>
        blocks.some(
          (block) =>
            !block.is_remote &&
            block.day === value &&
            timeToMinutes(block.start_time) < slotEnd &&
            timeToMinutes(block.end_time) > slotStart,
        ),
      ).length
    }),
  }))

  const scale = Math.max(COVERAGE_MIN_SCALE, ...counts.flatMap((entry) => entry.counts))

  return counts.map(({ day, counts: dayCounts }) => {
    const hours = dayCounts.map((count, i) => ({
      hour: COVERAGE_HOURS[i],
      count,
      thin: count < THIN_COVERAGE_THRESHOLD,
      height: (count / scale) * 100,
    }))
    return { day, hours, thinCount: hours.filter((hour) => hour.thin).length }
  })
}

export interface TrackBar {
  left: number
  width: number
  isRemote: boolean
  label: string
}

/** Position each block on a weekday track spanning the grid hours, clamped to its edges. */
export function buildTrackBars(
  blocks: DraftScheduleBlock[],
  day: Weekday,
  formatRange: (_start: string, _end: string) => string,
): TrackBar[] {
  return blocks
    .filter((block) => block.day === day)
    .flatMap((block) => {
      const start = Math.max(timeToMinutes(block.start_time), GRID_START_MINUTES)
      const end = Math.min(timeToMinutes(block.end_time), GRID_START_MINUTES + GRID_SPAN_MINUTES)
      if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return []
      return [
        {
          left: ((start - GRID_START_MINUTES) / GRID_SPAN_MINUTES) * 100,
          width: ((end - start) / GRID_SPAN_MINUTES) * 100,
          isRemote: block.is_remote,
          label: `${formatRange(block.start_time, block.end_time)}${block.is_remote ? " (remote)" : ""}`,
        },
      ]
    })
}

/** A new block for `day`: 9–12, or the three hours after the day's last block if that fits. */
export function nextBlockForDay(blocks: DraftScheduleBlock[], day: Weekday): DraftScheduleBlock {
  const lastEnd = Math.max(
    -1,
    ...blocks.filter((block) => block.day === day).map((block) => timeToMinutes(block.end_time)),
  )
  const start = lastEnd >= 0 && lastEnd + 60 <= GRID_END_HOUR * 60 ? lastEnd : 9 * 60
  const end = Math.min(start + 180, GRID_END_HOUR * 60)
  return { day, start_time: minutesToTime(start), end_time: minutesToTime(end), is_remote: false }
}

export function blocksEqual(a: DraftScheduleBlock[], b: DraftScheduleBlock[]): boolean {
  const key = (blocks: DraftScheduleBlock[]) =>
    blocks
      .map((block) => `${block.day}|${block.start_time}|${block.end_time}|${block.is_remote}`)
      .sort()
      .join(",")
  return key(a) === key(b)
}

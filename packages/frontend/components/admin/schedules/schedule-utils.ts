import { formatTime, normalizeTimeKey } from "@/lib/format-time"
import {
  GRID_END_HOUR,
  GRID_START_HOUR,
  SLOT_MINUTES,
  type DraftScheduleBlock,
  type ScheduleBlock,
  type Weekday,
  parseSlotKey,
  slotKey,
} from "@/components/admin/schedules/schedule-types"
import { WEEKDAY_OPTIONS } from "@/components/admin/terms/term-types"

export function minutesToTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`
}

export function timeToMinutes(value: string): number {
  const normalized = normalizeTimeKey(value)
  const [hours, minutes] = normalized.split(":").map(Number)
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return Number.NaN
  }
  return hours * 60 + minutes
}

export function generateTimeSlots(): string[] {
  const slots: string[] = []
  for (
    let minutes = GRID_START_HOUR * 60;
    minutes < GRID_END_HOUR * 60;
    minutes += SLOT_MINUTES
  ) {
    slots.push(minutesToTime(minutes))
  }
  return slots
}

export function blocksToSelectedSlots(
  blocks: Pick<ScheduleBlock, "day" | "start_time" | "end_time">[],
): Set<string> {
  const selected = new Set<string>()
  const timeSlots = generateTimeSlots()

  for (const block of blocks) {
    const start = timeToMinutes(block.start_time)
    const end = timeToMinutes(block.end_time)

    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
      continue
    }

    for (const slot of timeSlots) {
      const slotStart = timeToMinutes(slot)
      const slotEnd = slotStart + SLOT_MINUTES

      if (slotStart < end && slotEnd > start) {
        selected.add(slotKey(block.day, slot))
      }
    }
  }

  return selected
}

export function selectedSlotsToDraftBlocks(
  selected: Set<string>,
): DraftScheduleBlock[] {
  const byDay = new Map<Weekday, number[]>()

  for (const key of selected) {
    const { day, time } = parseSlotKey(key)
    const minutes = timeToMinutes(time)
    if (Number.isNaN(minutes)) continue
    const list = byDay.get(day) ?? []
    list.push(minutes)
    byDay.set(day, list)
  }

  const blocks: DraftScheduleBlock[] = []

  for (const { value: day } of WEEKDAY_OPTIONS) {
    const minutesList = byDay.get(day)
    if (!minutesList?.length) continue

    const sorted = [...minutesList].sort((a, b) => a - b)
    let rangeStart = sorted[0]
    let rangeEnd = sorted[0] + SLOT_MINUTES

    for (let index = 1; index < sorted.length; index += 1) {
      const current = sorted[index]
      if (current === rangeEnd) {
        rangeEnd += SLOT_MINUTES
        continue
      }

      blocks.push({
        day,
        start_time: minutesToTime(rangeStart),
        end_time: minutesToTime(rangeEnd),
        is_remote: false,
      })
      rangeStart = current
      rangeEnd = current + SLOT_MINUTES
    }

    blocks.push({
      day,
      start_time: minutesToTime(rangeStart),
      end_time: minutesToTime(rangeEnd),
      is_remote: false,
    })
  }

  return blocks.sort((a, b) => {
    const dayOrder =
      WEEKDAY_OPTIONS.findIndex((option) => option.value === a.day) -
      WEEKDAY_OPTIONS.findIndex((option) => option.value === b.day)
    if (dayOrder !== 0) return dayOrder
    return timeToMinutes(a.start_time) - timeToMinutes(b.start_time)
  })
}

export function mergeBlockWorkModes(
  nextBlocks: DraftScheduleBlock[],
  previousBlocks: DraftScheduleBlock[],
  defaultIsRemote = false,
): DraftScheduleBlock[] {
  return nextBlocks.map((block) => {
    const match = previousBlocks.find(
      (previous) =>
        previous.day === block.day &&
        previous.start_time === block.start_time &&
        previous.end_time === block.end_time,
    )

    return {
      ...block,
      is_remote: match?.is_remote ?? defaultIsRemote,
    }
  })
}

export function normalizeDraftBlock(
  block: DraftScheduleBlock,
): DraftScheduleBlock {
  return {
    day: block.day,
    start_time: normalizeTimeKey(block.start_time),
    end_time: normalizeTimeKey(block.end_time),
    is_remote: block.is_remote ?? false,
  }
}

export function normalizeDraftBlocks(
  blocks: DraftScheduleBlock[],
  options?: { forceInPerson?: boolean },
): DraftScheduleBlock[] {
  const normalized = blocks.map(normalizeDraftBlock)

  if (options?.forceInPerson) {
    return normalized.map((block) => ({ ...block, is_remote: false }))
  }

  return normalized
}

export function validateDraftBlocks(blocks: DraftScheduleBlock[]): string | null {
  const normalizedBlocks = normalizeDraftBlocks(blocks)

  for (const block of normalizedBlocks) {
    const start = timeToMinutes(block.start_time)
    const end = timeToMinutes(block.end_time)

    if (!block.start_time || !block.end_time) {
      return "Each block needs a start and end time."
    }

    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
      return "End time must be after start time."
    }
  }

  const byDay = new Map<Weekday, DraftScheduleBlock[]>()
  for (const block of normalizedBlocks) {
    const list = byDay.get(block.day) ?? []
    list.push(block)
    byDay.set(block.day, list)
  }

  for (const [, dayBlocks] of byDay) {
    const sorted = [...dayBlocks].sort(
      (a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time),
    )

    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1]
      const current = sorted[index]
      if (timeToMinutes(current.start_time) < timeToMinutes(previous.end_time)) {
        return "Blocks on the same day cannot overlap."
      }
    }
  }

  return null
}

export function blockDurationHours(block: Pick<ScheduleBlock, "start_time" | "end_time">): number {
  return (timeToMinutes(block.end_time) - timeToMinutes(block.start_time)) / 60
}

export function totalWeeklyHours(
  blocks: Pick<ScheduleBlock, "start_time" | "end_time">[],
): number {
  return blocks.reduce((sum, block) => sum + blockDurationHours(block), 0)
}

export function formatDayShort(day: Weekday): string {
  return day.slice(0, 3).replace(/^./, (char) => char.toUpperCase())
}

export function summarizeScheduleBlocks(
  blocks: Pick<ScheduleBlock, "day" | "start_time" | "end_time">[],
): string {
  if (blocks.length === 0) return "No schedule"

  const sorted = [...blocks].sort((a, b) => {
    const dayOrder =
      WEEKDAY_OPTIONS.findIndex((option) => option.value === a.day) -
      WEEKDAY_OPTIONS.findIndex((option) => option.value === b.day)
    if (dayOrder !== 0) return dayOrder
    return timeToMinutes(a.start_time) - timeToMinutes(b.start_time)
  })

  return sorted
    .map((block) => {
      const label = `${formatDayShort(block.day)} ${formatTime(block.start_time)}–${formatTime(block.end_time)}`
      return "is_remote" in block && block.is_remote ? `${label} (remote)` : label
    })
    .join(", ")
}

export function formatWeeklyHours(hours: number): string {
  if (Number.isInteger(hours)) return `${hours}h`
  return `${hours.toFixed(1)}h`
}

import type { Weekday } from "@/components/admin/terms/term-types"
import { WEEKDAY_OPTIONS } from "@/components/admin/terms/term-types"

export type { Weekday }

export interface Schedule {
  id: number
  student_assistant_id: number
  academic_term_id: number
}

export interface ScheduleBlock {
  id: number
  schedule_id: number
  day: Weekday
  start_time: string
  end_time: string
}

export type DraftScheduleBlock = Omit<ScheduleBlock, "id" | "schedule_id">

export interface MockAcademicTerm {
  id: number
  name: string
  is_active: boolean
}

export const GRID_START_HOUR = 8
export const GRID_END_HOUR = 17
export const SLOT_MINUTES = 60

export const SCHEDULE_WEEKDAYS = WEEKDAY_OPTIONS

export function slotKey(day: Weekday, time: string): string {
  return `${day}|${time}`
}

export function parseSlotKey(key: string): { day: Weekday; time: string } {
  const separatorIndex = key.indexOf("|")
  if (separatorIndex === -1) {
    // Backward compatibility for legacy "day:HH:mm" keys.
    const legacySeparatorIndex = key.indexOf(":")
    return {
      day: key.slice(0, legacySeparatorIndex) as Weekday,
      time: key.slice(legacySeparatorIndex + 1),
    }
  }

  return {
    day: key.slice(0, separatorIndex) as Weekday,
    time: key.slice(separatorIndex + 1),
  }
}

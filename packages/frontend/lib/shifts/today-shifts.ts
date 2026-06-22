import type { ScheduleBlock, ScheduleBlockDay } from "@/lib/api/scheduleBlocks"
import { scheduleBlocksApi } from "@/lib/api/scheduleBlocks"
import type { Schedule } from "@/lib/api/schedules"
import { schedulesApi } from "@/lib/api/schedules"
import type { StudentAssistant } from "@/lib/api/student-assistants"
import { formatStudentRole, studentAssistantsApi } from "@/lib/api/student-assistants"
import type { TimeEntry } from "@/lib/api/time-entries"
import { timeEntriesApi } from "@/lib/api/time-entries"
import { timeToMinutes } from "@/lib/format-time"

export type TodayShiftStatus = "scheduled" | "clocked-in" | "late" | "absent"

export interface TodayShift {
  scheduleBlockId: number
  studentAssistantId: number
  firstName: string
  lastName: string
  role: string
  startTime: string
  endTime: string
  clockInActual: string | null
  clockOutActual: string | null
  timeEntryId: number | null
  status: TodayShiftStatus
}

export function getTodayDay(): ScheduleBlockDay | null {
  const day = new Date().getDay()
  if (day === 0 || day === 6) return null

  const days: ScheduleBlockDay[] = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
  ]
  return days[day - 1]
}

export function getTodayDateString(): string {
  return new Date().toISOString().split("T")[0]
}

export function buildTodayShifts(
  schedules: Schedule[],
  scheduleBlocks: ScheduleBlock[],
  studentAssistants: StudentAssistant[],
  timeEntries: TimeEntry[],
  todayDay: ScheduleBlockDay | null,
  todayDate: string,
): TodayShift[] {
  if (!todayDay) return []

  const todaysBlocks = scheduleBlocks.filter((block) => block.days === todayDay)
  const todaysTimeEntries = timeEntries.filter((entry) =>
    entry.created_at?.startsWith(todayDate),
  )

  const scheduleMap = new Map(schedules.map((schedule) => [schedule.id, schedule]))
  const studentAssistantMap = new Map(
    studentAssistants.map((assistant) => [assistant.id, assistant]),
  )

  const timeEntryMap = new Map<string, TimeEntry>()
  for (const entry of todaysTimeEntries) {
    const key = `${entry.schedule_block_id}-${entry.student_assistant_id}`
    timeEntryMap.set(key, entry)
  }

  return todaysBlocks
    .map((block) => {
      const schedule =
        block.schedule_id != null ? scheduleMap.get(block.schedule_id) : undefined
      if (!schedule?.student_assistant_id) return null

      const studentAssistant = studentAssistantMap.get(schedule.student_assistant_id)
      if (!studentAssistant || studentAssistant.is_active === false) return null

      const timeEntryKey = `${block.id}-${schedule.student_assistant_id}`
      const timeEntry = timeEntryMap.get(timeEntryKey) ?? null

      let status: TodayShiftStatus = "scheduled"
      if (timeEntry?.clock_in && !timeEntry.clock_out) {
        status = "clocked-in"
      }

      return {
        scheduleBlockId: block.id,
        studentAssistantId: schedule.student_assistant_id,
        firstName: studentAssistant.first_name ?? "",
        lastName: studentAssistant.last_name ?? "",
        role: formatStudentRole(studentAssistant.position),
        startTime: block.start_time ?? "00:00",
        endTime: block.end_time ?? "00:00",
        clockInActual: timeEntry?.clock_in ?? null,
        clockOutActual: timeEntry?.clock_out ?? null,
        timeEntryId: timeEntry?.id ?? null,
        status,
      }
    })
    .filter((shift): shift is TodayShift => shift !== null)
}

export async function fetchTodayShifts(): Promise<TodayShift[]> {
  const todayDay = getTodayDay()
  const todayDate = getTodayDateString()

  const [schedules, scheduleBlocks, studentAssistants, timeEntries] =
    await Promise.all([
      schedulesApi.list(),
      scheduleBlocksApi.list(),
      studentAssistantsApi.list(),
      timeEntriesApi.list(),
    ])

  return buildTodayShifts(
    schedules,
    scheduleBlocks,
    studentAssistants,
    timeEntries,
    todayDay,
    todayDate,
  )
}

export function getClockedInShifts(shifts: TodayShift[]): TodayShift[] {
  return shifts
    .filter((shift) => shift.status === "clocked-in")
    .sort((a, b) =>
      (a.clockInActual ?? "").localeCompare(b.clockInActual ?? ""),
    )
}

export function getPendingClockInShifts(shifts: TodayShift[]): TodayShift[] {
  return shifts
    .filter((shift) => shift.status === "scheduled" && !shift.clockInActual)
    .sort((a, b) => a.startTime.localeCompare(b.startTime))
}

export const EXPECTED_ARRIVAL_WINDOW_MINUTES = 120

export function getExpectedArrivalShifts(
  shifts: TodayShift[],
  now: Date = new Date(),
): TodayShift[] {
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const windowEndMinutes = nowMinutes + EXPECTED_ARRIVAL_WINDOW_MINUTES

  return getPendingClockInShifts(shifts).filter((shift) => {
    const startMinutes = timeToMinutes(shift.startTime)
    if (Number.isNaN(startMinutes)) return false

    return startMinutes >= nowMinutes && startMinutes <= windowEndMinutes
  })
}

export function formatShiftName(shift: Pick<TodayShift, "firstName" | "lastName">): string {
  return `${shift.firstName} ${shift.lastName}`.trim()
}

export function getShiftInitials(shift: Pick<TodayShift, "firstName" | "lastName">): string {
  return [shift.firstName, shift.lastName]
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}

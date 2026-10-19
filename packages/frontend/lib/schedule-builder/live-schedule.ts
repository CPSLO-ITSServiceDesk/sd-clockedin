import { addDays, format, parseISO, startOfWeek } from "date-fns"

import { parseTermOffDays, type Weekday } from "@/components/admin/terms/term-types"
import type { ScheduleBlock } from "@/lib/api/scheduleBlocks"
import type { Schedule } from "@/lib/api/schedules"
import type { StudentAssistant } from "@/lib/api/student-assistants"
import type { Term } from "@/lib/api/terms"
import { timeToMinutes } from "@/lib/format-time"
import { getEffectiveScheduleDateRange } from "@/lib/schedules/date-range"
import { WEEKDAYS } from "@/lib/schedule-builder/model"

/** Live roles: leads come from the student's position; everyone else is Main desk. */
export type LiveRole = "L" | "m"

export interface LiveShift {
  studentId: number
  role: LiveRole
  /** Minutes since midnight, end exclusive. */
  start: number
  end: number
  remote: boolean
}

export interface LiveDay {
  date: string
  weekday: Weekday
  /** Set when the desk is closed (term vacation day). */
  closedLabel: string | null
  /** Set when this date runs another weekday's schedule. */
  runsAs: Weekday | null
  shifts: LiveShift[]
}

export interface TermWeek {
  index: number
  /** Monday of the week, YYYY-MM-DD. */
  monday: string
  dates: string[]
}

const iso = (date: Date) => format(date, "yyyy-MM-dd")

/** Mon–Fri weeks covering the term, starting with the week of its first day. */
export function termWeeks(term: Pick<Term, "start_date" | "end_date">): TermWeek[] {
  if (!term.start_date || !term.end_date) return []
  const weeks: TermWeek[] = []
  let monday = startOfWeek(parseISO(term.start_date), { weekStartsOn: 1 })
  const last = parseISO(term.end_date)
  while (monday <= last) {
    weeks.push({
      index: weeks.length,
      monday: iso(monday),
      dates: WEEKDAYS.map((_, offset) => iso(addDays(monday, offset))),
    })
    monday = addDays(monday, 7)
  }
  return weeks
}

/** Index of the week containing `today`, clamped to the term. */
export function currentWeekIndex(weeks: TermWeek[], today: string): number {
  if (weeks.length === 0) return 0
  if (today < weeks[0].monday) return 0
  const index = weeks.findIndex((week) => today >= week.monday && today <= week.dates[4])
  return index === -1 ? weeks.length - 1 : index
}

export function buildLiveWeek(
  week: TermWeek,
  term: Term,
  schedules: Schedule[],
  blocks: ScheduleBlock[],
  students: Map<number, StudentAssistant>,
): LiveDay[] {
  const offDays = parseTermOffDays(term.off_days)
  const termSchedules = schedules.filter(
    (schedule) =>
      schedule.academic_term_id === term.id &&
      schedule.student_assistant_id != null &&
      students.get(schedule.student_assistant_id)?.is_active,
  )

  return week.dates.map((date, offset) => {
    const weekday = WEEKDAYS[offset]
    const vacation = offDays.vacations.find((entry) => entry.date === date)
    const special = offDays.special_schedules.find((entry) => entry.date === date)
    const outsideTerm = !term.start_date || !term.end_date || date < term.start_date || date > term.end_date
    const runs = special?.swap_to_day ?? weekday

    if (vacation || outsideTerm) {
      return {
        date,
        weekday,
        closedLabel: vacation ? (vacation.label ?? "Desk closed") : "Outside the term",
        runsAs: null,
        shifts: [],
      }
    }

    const shifts: LiveShift[] = []
    for (const schedule of termSchedules) {
      const range = getEffectiveScheduleDateRange(schedule, term)
      if (!range || date < range.startDate || date > range.endDate) continue
      const studentId = schedule.student_assistant_id!
      const role: LiveRole = students.get(studentId)?.position === "student_lead" ? "L" : "m"
      for (const block of blocks) {
        if (block.schedule_id !== schedule.id || block.days !== runs) continue
        if (!block.start_time || !block.end_time) continue
        shifts.push({
          studentId,
          role,
          start: timeToMinutes(block.start_time),
          end: timeToMinutes(block.end_time),
          remote: block.is_remote,
        })
      }
    }

    return { date, weekday, closedLabel: null, runsAs: special ? runs : null, shifts }
  })
}

/** In-person shifts overlapping [start, end). Remote shifts don't staff the desk. */
export function onDeskDuring(day: LiveDay, start: number, end: number): LiveShift[] {
  return day.shifts.filter((shift) => !shift.remote && shift.start < end && shift.end > start)
}

/** "9", "9:30" (12-hour, no suffix) */
export function shortClock(minutes: number): string {
  const h = Math.floor(minutes / 60) % 12 || 12
  const m = minutes % 60
  return m ? `${h}:${String(m).padStart(2, "0")}` : String(h)
}

/** "9–11:30a", "11–1p" */
export function compactRange(start: number, end: number): string {
  return `${shortClock(start)}–${shortClock(end)}${end < 12 * 60 ? "a" : "p"}`
}

import { format, isValid, parseISO } from "date-fns"

export type Weekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"

export type TermVacationDay = {
  date: string
  label?: string
}

export type TermSpecialSchedule = {
  date: string
  swap_to_day: Weekday
  label?: string
}

export type TermOffDays = {
  vacations: TermVacationDay[]
  special_schedules: TermSpecialSchedule[]
}

export interface AcademicTerm {
  id: number
  name: string
  start_date: string
  end_date: string
  is_active: boolean
  off_days: TermOffDays | null
}

export const WEEKDAY_OPTIONS: { value: Weekday; label: string }[] = [
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
]

export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export const ACADEMIC_CALENDAR_URL = "https://registrar.calpoly.edu/acad_cal"

export function sortTermsByActiveStatus<
  T extends { is_active: boolean | null; start_date: string | null },
>(terms: T[]): T[] {
  return [...terms].sort((a, b) => {
    const activeDiff = Number(Boolean(b.is_active)) - Number(Boolean(a.is_active))
    if (activeDiff !== 0) return activeDiff

    const aStart = a.start_date ?? ""
    const bStart = b.start_date ?? ""
    return bStart.localeCompare(aStart)
  })
}

export function createClientId(): string {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
}

export function parseDateString(value: string): Date | undefined {
  if (!ISO_DATE_PATTERN.test(value)) return undefined

  const parsed = parseISO(value)
  return isValid(parsed) ? parsed : undefined
}

export function formatTermDate(value: string): string {
  const parsed = parseDateString(value)
  if (!parsed) return value

  return format(parsed, "MMM d, yyyy")
}

export function weekdayLabel(value: Weekday): string {
  return WEEKDAY_OPTIONS.find((option) => option.value === value)?.label ?? value
}

export function parseTermOffDays(value: unknown): TermOffDays {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { vacations: [], special_schedules: [] }
  }

  const record = value as Record<string, unknown>

  return {
    vacations: Array.isArray(record.vacations)
      ? record.vacations.flatMap((entry) => {
          if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
            return []
          }

          const vacation = entry as Record<string, unknown>
          if (typeof vacation.date !== "string") return []

          return [
            {
              date: vacation.date,
              label:
                typeof vacation.label === "string" ? vacation.label : undefined,
            },
          ]
        })
      : [],
    special_schedules: Array.isArray(record.special_schedules)
      ? record.special_schedules.flatMap((entry) => {
          if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
            return []
          }

          const schedule = entry as Record<string, unknown>
          if (
            typeof schedule.date !== "string" ||
            typeof schedule.swap_to_day !== "string" ||
            !WEEKDAY_OPTIONS.some(
              (option) => option.value === schedule.swap_to_day,
            )
          ) {
            return []
          }

          return [
            {
              date: schedule.date,
              swap_to_day: schedule.swap_to_day as Weekday,
              label:
                typeof schedule.label === "string" ? schedule.label : undefined,
            },
          ]
        })
      : [],
  }
}

export function countOffDays(offDays: TermOffDays | null): number {
  if (!offDays) return 0

  return offDays.vacations.length + offDays.special_schedules.length
}

export function summarizeOffDays(offDays: TermOffDays | null): string {
  if (!offDays) return "None"

  const vacationCount = offDays.vacations.length
  const specialCount = offDays.special_schedules.length

  if (vacationCount === 0 && specialCount === 0) return "None"

  const parts: string[] = []

  if (vacationCount > 0) {
    parts.push(
      `${vacationCount} vacation ${vacationCount === 1 ? "day" : "days"}`,
    )
  }

  if (specialCount > 0) {
    parts.push(
      `${specialCount} special ${specialCount === 1 ? "schedule" : "schedules"}`,
    )
  }

  return parts.join(" · ")
}

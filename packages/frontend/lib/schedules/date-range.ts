export interface ScheduleDateFields {
  start_date: string | null
  end_date: string | null
}

export interface TermDateFields {
  start_date: string | null
  end_date: string | null
}

export interface EffectiveScheduleDateRange {
  startDate: string
  endDate: string
}

export function getEffectiveScheduleDateRange(
  schedule: ScheduleDateFields,
  term: TermDateFields,
): EffectiveScheduleDateRange | null {
  if (!term.start_date || !term.end_date) {
    return null
  }

  const startDate = schedule.start_date ?? term.start_date
  const endDate = schedule.end_date ?? term.end_date

  const clampedStart = startDate < term.start_date ? term.start_date : startDate
  const clampedEnd = endDate > term.end_date ? term.end_date : endDate

  if (clampedStart > clampedEnd) {
    return null
  }

  return { startDate: clampedStart, endDate: clampedEnd }
}

export function isDateInEffectiveScheduleRange(
  date: string,
  schedule: ScheduleDateFields,
  term: TermDateFields,
): boolean {
  const range = getEffectiveScheduleDateRange(schedule, term)
  if (!range) return false
  return date >= range.startDate && date <= range.endDate
}

export function validateScheduleDateOverrides(
  startDate: string | null,
  endDate: string | null,
  term: TermDateFields,
): string | null {
  if (!startDate && !endDate) return null

  if (!term.start_date || !term.end_date) {
    return "Term must have start and end dates before setting schedule overrides."
  }

  if (startDate && (startDate < term.start_date || startDate > term.end_date)) {
    return "Schedule start date must fall within the term."
  }

  if (endDate && (endDate < term.start_date || endDate > term.end_date)) {
    return "Schedule end date must fall within the term."
  }

  const effectiveStart = startDate ?? term.start_date
  const effectiveEnd = endDate ?? term.end_date

  if (effectiveStart > effectiveEnd) {
    return "Schedule start date must be on or before the end date."
  }

  return null
}

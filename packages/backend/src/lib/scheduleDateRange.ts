export interface ScheduleDateFields {
  start_date: string | null;
  end_date: string | null;
}

export interface TermDateFields {
  start_date: string | null;
  end_date: string | null;
}

export interface EffectiveScheduleDateRange {
  startDate: string;
  endDate: string;
}

export function getEffectiveScheduleDateRange(
  schedule: ScheduleDateFields,
  term: TermDateFields,
): EffectiveScheduleDateRange | null {
  if (!term.start_date || !term.end_date) {
    return null;
  }

  const startDate = schedule.start_date ?? term.start_date;
  const endDate = schedule.end_date ?? term.end_date;

  const clampedStart = startDate < term.start_date ? term.start_date : startDate;
  const clampedEnd = endDate > term.end_date ? term.end_date : endDate;

  if (clampedStart > clampedEnd) {
    return null;
  }

  return { startDate: clampedStart, endDate: clampedEnd };
}

export function isDateInEffectiveScheduleRange(
  date: string,
  schedule: ScheduleDateFields,
  term: TermDateFields,
): boolean {
  const range = getEffectiveScheduleDateRange(schedule, term);
  if (!range) return false;
  return date >= range.startDate && date <= range.endDate;
}

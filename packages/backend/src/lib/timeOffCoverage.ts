import { getOrgLocalInstant } from './orgTime';
import type { Database } from '../types/database.types';

type Term = Database['public']['Tables']['academic_term']['Row'];

export type TermOffDays = {
  vacations?: { date: string }[];
  special_schedules?: { date: string; swap_to_day: string }[];
};

export type TimeOffInterval = {
  student_assistant_id: number;
  starts_at: string;
  ends_at: string;
};

export function parseOffDays(term: Term | null | undefined): TermOffDays | null {
  if (!term?.off_days || typeof term.off_days !== 'object' || Array.isArray(term.off_days)) {
    return null;
  }
  return term.off_days as TermOffDays;
}

export function isVacationDay(date: string, offDays: TermOffDays | null): boolean {
  return offDays?.vacations?.some((vacation) => vacation.date === date) ?? false;
}

export function isCampusVacationOnDate(
  term: Term | null | undefined,
  date: string,
): boolean {
  return isVacationDay(date, parseOffDays(term));
}

/** Exclusive-end interval: `starts_at <= instant < ends_at`. */
export function isTimeOffCoveringInstant(
  rows: TimeOffInterval[],
  studentAssistantId: number,
  instant: Date,
): boolean {
  const t = instant.getTime();
  if (Number.isNaN(t)) return false;

  return rows.some((row) => {
    if (row.student_assistant_id !== studentAssistantId) return false;
    const start = Date.parse(row.starts_at);
    const end = Date.parse(row.ends_at);
    if (Number.isNaN(start) || Number.isNaN(end)) return false;
    return t >= start && t < end;
  });
}

/**
 * True when `[starts_at, ends_at)` overlaps the org-local calendar day
 * `[date 00:00, next day 00:00)`.
 */
export function isTimeOffCoveringOrgLocalDate(
  rows: TimeOffInterval[],
  studentAssistantId: number,
  dateStr: string,
): boolean {
  const dayStart = getOrgLocalInstant(dateStr, 0, 0).getTime();
  const dayEnd = getOrgLocalInstant(addCalendarDays(dateStr, 1), 0, 0).getTime();

  return rows.some((row) => {
    if (row.student_assistant_id !== studentAssistantId) return false;
    const start = Date.parse(row.starts_at);
    const end = Date.parse(row.ends_at);
    if (Number.isNaN(start) || Number.isNaN(end)) return false;
    return start < dayEnd && end > dayStart;
  });
}

function addCalendarDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const utc = new Date(Date.UTC(year, month - 1, day + days));
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, '0');
  const d = String(utc.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

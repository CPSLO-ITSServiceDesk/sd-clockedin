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

export interface ShiftTimeOff<T extends TimeOffInterval> {
  /** First time off that overlaps the shift, or null when none does. */
  timeOff: T | null;
  /**
   * Part of the shift still worked, in org-local minutes since midnight
   * (end exclusive), or null when time off covers the whole shift. When time
   * off splits the shift, the longer remaining piece is returned.
   */
  remaining: [number, number] | null;
}

/** Match a student's time off against one shift on an org-local date. */
export function timeOffForShift<T extends TimeOffInterval>(
  rows: T[],
  studentAssistantId: number,
  dateStr: string,
  startMinutes: number,
  endMinutes: number,
): ShiftTimeOff<T> {
  const shiftStart = getOrgLocalInstant(dateStr, Math.floor(startMinutes / 60), startMinutes % 60).getTime();
  const shiftEnd = getOrgLocalInstant(dateStr, Math.floor(endMinutes / 60), endMinutes % 60).getTime();

  const overlapping = rows
    .filter((row) => row.student_assistant_id === studentAssistantId)
    .map((row) => ({ row, start: Date.parse(row.starts_at), end: Date.parse(row.ends_at) }))
    .filter(({ start, end }) => !Number.isNaN(start) && !Number.isNaN(end) && start < shiftEnd && end > shiftStart)
    .sort((a, b) => a.start - b.start);

  if (overlapping.length === 0) return { timeOff: null, remaining: [startMinutes, endMinutes] };

  let pieces: [number, number][] = [[shiftStart, shiftEnd]];
  for (const { start, end } of overlapping) {
    pieces = pieces.flatMap(([a, b]): [number, number][] => {
      if (end <= a || start >= b) return [[a, b]];
      return [
        ...(start > a ? [[a, start] as [number, number]] : []),
        ...(end < b ? [[end, b] as [number, number]] : []),
      ];
    });
  }

  const minuteMs = 60_000;
  const longest = pieces
    .filter(([a, b]) => b - a >= minuteMs)
    .sort((x, y) => y[1] - y[0] - (x[1] - x[0]) || x[0] - y[0])[0];

  return {
    timeOff: overlapping[0].row,
    remaining: longest
      ? [
          startMinutes + Math.round((longest[0] - shiftStart) / minuteMs),
          startMinutes + Math.round((longest[1] - shiftStart) / minuteMs),
        ]
      : null,
  };
}

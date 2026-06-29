import { getOrgLocalDateString, getOrgLocalMinutes } from './orgTime';
import { timeToMinutes } from './time';

export type ShiftStatus =
  | 'incoming'
  | 'on-time'
  | 'late'
  | 'early'
  | 'absent'
  | 'expected';

/** Minutes before/after scheduled start that still count as on-time. */
export const ARRIVAL_WINDOW_MINUTES = 10;

/** @deprecated Use ARRIVAL_WINDOW_MINUTES */
export const ON_TIME_GRACE_MINUTES = ARRIVAL_WINDOW_MINUTES;

export function computeRemoteShiftStatus(
  scheduledStartTime: string,
  now: Date = new Date(),
): ShiftStatus {
  const startMinutes = timeToMinutes(scheduledStartTime);
  if (Number.isNaN(startMinutes)) {
    return 'expected';
  }

  const nowMinutes = getOrgLocalMinutes(now);
  if (nowMinutes < startMinutes) {
    return 'incoming';
  }

  return 'expected';
}

export function computeShiftStatus(
  scheduledStartTime: string,
  clockIn: string | null,
  now: Date = new Date(),
): ShiftStatus {
  const startMinutes = timeToMinutes(scheduledStartTime);
  if (Number.isNaN(startMinutes)) {
    return 'incoming';
  }

  const nowMinutes = getOrgLocalMinutes(now);

  if (!clockIn) {
    return isWithinArrivalWindow(startMinutes, nowMinutes) ? 'incoming' : 'absent';
  }

  const clockInMinutes = timeToMinutes(clockIn);
  if (Number.isNaN(clockInMinutes)) {
    return isWithinArrivalWindow(startMinutes, nowMinutes) ? 'incoming' : 'absent';
  }

  return evaluateClockedInStatus(startMinutes, clockInMinutes);
}

function evaluateClockedInStatus(
  startMinutes: number,
  clockInMinutes: number,
): EvaluatableShiftStatus {
  if (clockInMinutes < startMinutes - ARRIVAL_WINDOW_MINUTES) {
    return 'early';
  }

  if (clockInMinutes <= startMinutes + ARRIVAL_WINDOW_MINUTES) {
    return 'on-time';
  }

  return 'late';
}

function isWithinArrivalWindow(startMinutes: number, nowMinutes: number): boolean {
  return nowMinutes <= startMinutes + ARRIVAL_WINDOW_MINUTES;
}

export type EvaluatableShiftStatus = 'early' | 'on-time' | 'late' | 'absent';

export interface HistoricalShiftResult {
  status: ShiftStatus | 'skipped';
  minutesLate: number;
}

/** Format a Date as YYYY-MM-DD in the organization timezone. */
export function toLocalDateString(date: Date): string {
  return getOrgLocalDateString(date);
}

/** Shift a YYYY-MM-DD local date by a number of days. */
export function addLocalDays(dateStr: string, delta: number): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + delta);
  return toLocalDateString(date);
}

/** True when dateKey falls in [startDate, endDateExclusive). */
export function isLocalDateInRange(
  dateKey: string,
  startDate: string,
  endDateExclusive: string,
): boolean {
  return dateKey >= startDate && dateKey < endDateExclusive;
}

/** Extract the local calendar date from a clock-in timestamp. */
export function getClockInDate(clockIn: string | null): string | null {
  if (!clockIn) return null;

  if (clockIn.includes('T')) {
    const date = new Date(clockIn);
    if (Number.isNaN(date.getTime())) return null;
    return toLocalDateString(date);
  }

  return null;
}

export function computeMinutesLate(
  scheduledStartTime: string,
  clockIn: string,
): number {
  const startMinutes = timeToMinutes(scheduledStartTime);
  const clockInMinutes = timeToMinutes(clockIn);
  if (Number.isNaN(startMinutes) || Number.isNaN(clockInMinutes)) {
    return 0;
  }

  const lateBy = clockInMinutes - startMinutes - ARRIVAL_WINDOW_MINUTES;
  return lateBy > 0 ? lateBy : 0;
}

/**
 * Evaluate punctuality for a scheduled in-person shift on a specific date.
 * Returns `skipped` for future dates; `incoming` for today before start with no clock-in.
 */
export function computeHistoricalShiftStatus(
  scheduledStartTime: string,
  clockIn: string | null,
  shiftDate: string,
  now: Date = new Date(),
): HistoricalShiftResult {
  const today = getOrgLocalDateString(now);

  if (shiftDate > today) {
    return { status: 'skipped', minutesLate: 0 };
  }

  const startMinutes = timeToMinutes(scheduledStartTime);
  if (Number.isNaN(startMinutes)) {
    return { status: 'skipped', minutesLate: 0 };
  }

  if (!clockIn) {
    if (shiftDate < today) {
      return { status: 'absent', minutesLate: 0 };
    }

    const nowMinutes = getOrgLocalMinutes(now);
    if (isWithinArrivalWindow(startMinutes, nowMinutes)) {
      return { status: 'incoming', minutesLate: 0 };
    }

    return { status: 'absent', minutesLate: 0 };
  }

  const clockInMinutes = timeToMinutes(clockIn);
  if (Number.isNaN(clockInMinutes)) {
    if (shiftDate < today) {
      return { status: 'absent', minutesLate: 0 };
    }

    const nowMinutes = getOrgLocalMinutes(now);
    if (isWithinArrivalWindow(startMinutes, nowMinutes)) {
      return { status: 'incoming', minutesLate: 0 };
    }

    return { status: 'absent', minutesLate: 0 };
  }

  const status = evaluateClockedInStatus(startMinutes, clockInMinutes);
  return {
    status,
    minutesLate: status === 'late'
      ? computeMinutesLate(scheduledStartTime, clockIn)
      : 0,
  };
}

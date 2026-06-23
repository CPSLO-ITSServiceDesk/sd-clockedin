import { timeToMinutes } from './time';

export type ShiftStatus =
  | 'incoming'
  | 'on-time'
  | 'late'
  | 'early'
  | 'absent'
  | 'expected';

/** Minutes after scheduled start that still count as on-time. */
export const ON_TIME_GRACE_MINUTES = 5;

export function computeRemoteShiftStatus(
  scheduledStartTime: string,
  now: Date = new Date(),
): ShiftStatus {
  const startMinutes = timeToMinutes(scheduledStartTime);
  if (Number.isNaN(startMinutes)) {
    return 'expected';
  }

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
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

  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  if (!clockIn) {
    return nowMinutes < startMinutes ? 'incoming' : 'absent';
  }

  const clockInMinutes = timeToMinutes(clockIn);
  if (Number.isNaN(clockInMinutes)) {
    return nowMinutes < startMinutes ? 'incoming' : 'absent';
  }

  if (clockInMinutes < startMinutes) {
    return 'early';
  }

  if (clockInMinutes <= startMinutes + ON_TIME_GRACE_MINUTES) {
    return 'on-time';
  }

  return 'late';
}

export type EvaluatableShiftStatus = 'early' | 'on-time' | 'late' | 'absent';

export interface HistoricalShiftResult {
  status: ShiftStatus | 'skipped';
  minutesLate: number;
}

/** Format a Date as YYYY-MM-DD in local time. */
export function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

  const lateBy = clockInMinutes - startMinutes - ON_TIME_GRACE_MINUTES;
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
  const today = toLocalDateString(now);

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

    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    if (nowMinutes < startMinutes) {
      return { status: 'incoming', minutesLate: 0 };
    }

    return { status: 'absent', minutesLate: 0 };
  }

  const clockInMinutes = timeToMinutes(clockIn);
  if (Number.isNaN(clockInMinutes)) {
    if (shiftDate < today) {
      return { status: 'absent', minutesLate: 0 };
    }

    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    if (nowMinutes < startMinutes) {
      return { status: 'incoming', minutesLate: 0 };
    }

    return { status: 'absent', minutesLate: 0 };
  }

  if (clockInMinutes < startMinutes) {
    return { status: 'early', minutesLate: 0 };
  }

  if (clockInMinutes <= startMinutes + ON_TIME_GRACE_MINUTES) {
    return { status: 'on-time', minutesLate: 0 };
  }

  return {
    status: 'late',
    minutesLate: computeMinutesLate(scheduledStartTime, clockIn),
  };
}

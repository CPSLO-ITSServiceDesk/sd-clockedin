import { timeToMinutes } from './time';

export type ShiftStatus = 'incoming' | 'on-time' | 'late' | 'early' | 'absent';

/** Minutes after scheduled start that still count as on-time. */
export const ON_TIME_GRACE_MINUTES = 5;

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

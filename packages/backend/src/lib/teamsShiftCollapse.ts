import { getOrgLocalDateString } from './orgTime';
import type { TeamsShiftDto } from './teamsShiftsAdapter';
import type { DraftScheduleBlock } from './scheduleImportTransform';
import type { Database } from '../types/database.types';

type Weekday = Database['public']['Enums']['days'];

export const WEEKDAYS: Weekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
];

export interface CollapseShiftsOptions {
  now?: Date;
  remoteShiftsAllowed?: boolean;
}

interface ShiftOccurrence {
  weekday: Weekday;
  startTime: string;
  endTime: string;
  isRemote: boolean;
  localStartDate: string;
}

export function isoDateToWeekday(isoDate: string): Weekday | null {
  const [year, month, day] = isoDate.split('-').map(Number);
  if (!year || !month || !day) return null;
  const dayIndex = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  if (dayIndex < 1 || dayIndex > 5) return null;
  return WEEKDAYS[dayIndex - 1];
}

function timeKey(startTime: string, endTime: string): string {
  return `${startTime}|${endTime}`;
}

/**
 * Among items that share the highest key frequency, prefer the one whose
 * date is the soonest on or after `today`. If none are upcoming, prefer the
 * latest date (last week of the term).
 */
export function pickModePreferUpcoming<T>(
  items: T[],
  keyFn: (item: T) => string,
  dateFn: (item: T) => string,
  today: string,
): T {
  if (items.length === 0) {
    throw new Error('pickModePreferUpcoming requires at least one item');
  }

  const counts = new Map<string, number>();
  for (const item of items) {
    const key = keyFn(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  let maxCount = 0;
  for (const count of counts.values()) {
    maxCount = Math.max(maxCount, count);
  }

  const tiedKeys = new Set(
    [...counts.entries()]
      .filter(([, count]) => count === maxCount)
      .map(([key]) => key),
  );
  const candidates = items.filter((item) => tiedKeys.has(keyFn(item)));

  const upcoming = candidates
    .filter((item) => dateFn(item) >= today)
    .sort((a, b) => {
      const byDate = dateFn(a).localeCompare(dateFn(b));
      if (byDate !== 0) return byDate;
      return keyFn(a).localeCompare(keyFn(b));
    });
  if (upcoming.length > 0) return upcoming[0];

  return [...candidates].sort((a, b) => {
    const byDate = dateFn(b).localeCompare(dateFn(a));
    if (byDate !== 0) return byDate;
    return keyFn(a).localeCompare(keyFn(b));
  })[0];
}

function toOccurrence(
  shift: TeamsShiftDto,
  remoteShiftsAllowed: boolean,
): ShiftOccurrence | null {
  const weekday = isoDateToWeekday(shift.localStartDate);
  if (!weekday) return null;

  const isRemote = shift.isRemote === true;
  if (isRemote && !remoteShiftsAllowed) return null;

  return {
    weekday,
    startTime: shift.localStartTime,
    endTime: shift.localEndTime,
    isRemote,
    localStartDate: shift.localStartDate,
  };
}

function collapseOccurrences(
  occurrences: ShiftOccurrence[],
  today: string,
): DraftScheduleBlock[] {
  const byWeekday = new Map<Weekday, ShiftOccurrence[]>();
  for (const occurrence of occurrences) {
    const list = byWeekday.get(occurrence.weekday) ?? [];
    list.push(occurrence);
    byWeekday.set(occurrence.weekday, list);
  }

  const blocks: DraftScheduleBlock[] = [];
  for (const weekday of WEEKDAYS) {
    const dayOccurrences = byWeekday.get(weekday);
    if (!dayOccurrences?.length) continue;

    const timeWinner = pickModePreferUpcoming(
      dayOccurrences,
      (item) => timeKey(item.startTime, item.endTime),
      (item) => item.localStartDate,
      today,
    );
    const sameTimes = dayOccurrences.filter(
      (item) =>
        item.startTime === timeWinner.startTime &&
        item.endTime === timeWinner.endTime,
    );
    const remoteWinner = pickModePreferUpcoming(
      sameTimes,
      (item) => (item.isRemote ? '1' : '0'),
      (item) => item.localStartDate,
      today,
    );

    blocks.push({
      day: weekday,
      start_time: timeWinner.startTime,
      end_time: timeWinner.endTime,
      is_remote: remoteWinner.isRemote,
    });
  }

  return blocks;
}

/** One Mon–Fri template per student: mode start/end per weekday, not interval-merge. */
export function collapseShiftsToWeekdayTemplates(
  shifts: TeamsShiftDto[],
  options: CollapseShiftsOptions = {},
): DraftScheduleBlock[] {
  const today = getOrgLocalDateString(options.now ?? new Date());
  const remoteShiftsAllowed = options.remoteShiftsAllowed ?? false;
  const occurrences = shifts
    .map((shift) => toOccurrence(shift, remoteShiftsAllowed))
    .filter((occurrence): occurrence is ShiftOccurrence => occurrence !== null);

  return collapseOccurrences(occurrences, today);
}

export function collapseShiftsByEntraUserId(
  shifts: TeamsShiftDto[],
  options: CollapseShiftsOptions = {},
): Map<string, DraftScheduleBlock[]> {
  const byUser = new Map<string, TeamsShiftDto[]>();
  for (const shift of shifts) {
    const list = byUser.get(shift.entraUserId) ?? [];
    list.push(shift);
    byUser.set(shift.entraUserId, list);
  }

  const templates = new Map<string, DraftScheduleBlock[]>();
  for (const [entraUserId, userShifts] of byUser) {
    templates.set(entraUserId, collapseShiftsToWeekdayTemplates(userShifts, options));
  }
  return templates;
}

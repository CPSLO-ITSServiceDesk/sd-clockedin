import { invalidateCache, withCache } from './cache';
import { toLocalDateString } from './shiftStatus';

// Short enough that the 30s frontend poll never serves data older than one
// cycle, but long enough to absorb bursts from multiple concurrent viewers.
const TODAY_SHIFTS_CACHE_TTL_SECONDS = 15;

function todayShiftsCacheKey(date: string, includeRemote: boolean): string {
  return `today-shifts:${date}:${includeRemote ? '1' : '0'}`;
}

/** Call after any mutation that can change the shift board for `date`. */
export async function invalidateTodayShiftsCache(date: string): Promise<void> {
  await invalidateCache(
    todayShiftsCacheKey(date, false),
    todayShiftsCacheKey(date, true),
  );
}

/** Invalidate today's board (org-local date). */
export async function invalidateTodayShiftsCacheForNow(
  now: Date = new Date(),
): Promise<void> {
  await invalidateTodayShiftsCache(toLocalDateString(now));
}

export async function withTodayShiftsCache<T>(
  date: string,
  includeRemote: boolean,
  fn: () => Promise<T>,
): Promise<T> {
  return withCache(
    todayShiftsCacheKey(date, includeRemote),
    TODAY_SHIFTS_CACHE_TTL_SECONDS,
    fn,
  );
}

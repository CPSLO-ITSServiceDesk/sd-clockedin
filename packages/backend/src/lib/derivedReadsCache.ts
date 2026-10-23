import { bumpCacheGeneration, withVersionedCache } from './cache';
import { getOrgLocalDateString } from './orgTime';
import { isRedisEnabled } from './redis';
import {
  invalidateTodayShiftsCache,
  invalidateTodayShiftsCacheForNow,
} from './todayShiftsCache';

/** Terms still in progress, and the current timesheet month. `now` changes the result through the day. */
export const DERIVED_READ_TTL_SECONDS = 5 * 60;

/** Ended terms and closed months. A generation bump drops these when the underlying rows change. */
export const STABLE_READ_TTL_SECONDS = 24 * 60 * 60;

const ANALYTICS_GENERATION_KEY = 'analytics:gen';
const TIMESHEET_GENERATION_KEY = 'timesheet:gen';

export function analyticsTtlSeconds(endDate: string | null, today: string): number {
  // end_date is inclusive, so a term ending today is still live.
  return endDate != null && endDate < today ? STABLE_READ_TTL_SECONDS : DERIVED_READ_TTL_SECONDS;
}

export function timesheetTtlSeconds(month: string, today: string): number {
  const currentMonth = today.slice(0, 7);
  return month < currentMonth ? STABLE_READ_TTL_SECONDS : DERIVED_READ_TTL_SECONDS;
}

export function termAnalyticsCacheKey(termId: number, generation: number): string {
  return `analytics:term:${termId}:v${generation}`;
}

export function studentAnalyticsCacheKey(
  termId: number,
  studentAssistantId: number,
  generation: number,
): string {
  return `analytics:student:${termId}:${studentAssistantId}:v${generation}`;
}

export function timesheetMonthCacheKey(month: string, generation: number): string {
  return `timesheet:month:${month}:v${generation}`;
}

export async function withTermAnalyticsCache<T>(
  termId: number,
  endDate: string | null,
  fn: () => Promise<T>,
): Promise<T> {
  const today = getOrgLocalDateString();
  return withVersionedCache(
    ANALYTICS_GENERATION_KEY,
    (generation) => termAnalyticsCacheKey(termId, generation),
    analyticsTtlSeconds(endDate, today),
    fn,
  );
}

export async function withStudentAnalyticsCache<T>(
  termId: number,
  studentAssistantId: number,
  endDate: string | null,
  fn: () => Promise<T>,
): Promise<T> {
  const today = getOrgLocalDateString();
  return withVersionedCache(
    ANALYTICS_GENERATION_KEY,
    (generation) => studentAnalyticsCacheKey(termId, studentAssistantId, generation),
    analyticsTtlSeconds(endDate, today),
    fn,
  );
}

/**
 * Caches the hour comparison for every student in the month. Verification is
 * read separately, so signing a timesheet off does not recompute it.
 */
export async function withTimesheetMonthCache<T>(
  month: string,
  fn: () => Promise<T>,
): Promise<T> {
  const today = getOrgLocalDateString();
  return withVersionedCache(
    TIMESHEET_GENERATION_KEY,
    (generation) => timesheetMonthCacheKey(month, generation),
    timesheetTtlSeconds(month, today),
    fn,
  );
}

let derivedInvalidation: Promise<void> | null = null;

/**
 * Orphans cached analytics and timesheet months. Overlapping calls share one
 * bump so a bulk block replace does not increment Redis once per row.
 */
export function invalidateDerivedReads(): Promise<void> {
  if (!isRedisEnabled) return Promise.resolve();
  if (derivedInvalidation) return derivedInvalidation;

  derivedInvalidation = Promise.all([
    bumpCacheGeneration(ANALYTICS_GENERATION_KEY),
    bumpCacheGeneration(TIMESHEET_GENERATION_KEY),
  ])
    .then(() => undefined)
    .finally(() => {
      derivedInvalidation = null;
    });

  return derivedInvalidation;
}

/** Drop the shift board for `date` (today when omitted) plus analytics and timesheet rollups. */
export async function invalidateLiveReads(date?: string): Promise<void> {
  await Promise.all([
    date === undefined ? invalidateTodayShiftsCacheForNow() : invalidateTodayShiftsCache(date),
    invalidateDerivedReads(),
  ]);
}

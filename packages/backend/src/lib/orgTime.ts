/** IANA timezone for campus wall-clock times (schedule blocks, shift windows). */
export const ORG_TIMEZONE = process.env.ORG_TIMEZONE ?? 'America/Los_Angeles';

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** One formatter for the process. Constructing Intl.DateTimeFormat is the expensive part. */
const orgFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: ORG_TIMEZONE,
  weekday: 'short',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

type OrgParts = {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
  weekday: string;
};

function readOrgParts(instant: Date): OrgParts {
  const parts: OrgParts = {
    year: '',
    month: '',
    day: '',
    hour: '',
    minute: '',
    second: '',
    weekday: '',
  };
  for (const part of orgFormatter.formatToParts(instant)) {
    if (
      part.type === 'year' ||
      part.type === 'month' ||
      part.type === 'day' ||
      part.type === 'hour' ||
      part.type === 'minute' ||
      part.type === 'second' ||
      part.type === 'weekday'
    ) {
      parts[part.type] = part.value;
    }
  }
  return parts;
}

/** Milliseconds to add to a UTC instant to reach the org wall clock, expressed as UTC. */
function orgOffsetMs(instantMs: number): number {
  const parts = readOrgParts(new Date(instantMs));
  const wallAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return wallAsUtc - (instantMs - (instantMs % 1000));
}

/** Minutes since midnight in the organization timezone. */
export function getOrgLocalMinutes(now: Date = new Date()): number {
  const parts = readOrgParts(now);
  return Number(parts.hour) * 60 + Number(parts.minute);
}

/** YYYY-MM-DD calendar date in the organization timezone. */
export function getOrgLocalDateString(now: Date = new Date()): string {
  const parts = readOrgParts(now);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** JS day index (0=Sunday … 6=Saturday) in the organization timezone. */
export function getOrgDayOfWeek(now: Date = new Date()): number {
  return WEEKDAY_INDEX[readOrgParts(now).weekday] ?? 0;
}

const instantCache = new Map<string, number>();
const INSTANT_CACHE_LIMIT = 4096;

/**
 * UTC instant for a wall-clock time on an org-local calendar day (YYYY-MM-DD).
 * The offset is read twice so a daylight-saving transition still lands on the
 * earlier instant. A wall time that does not exist (the spring-forward gap)
 * throws. Results are cached: the shift board and term analytics ask for the
 * same handful of times over and over.
 */
export function getOrgLocalInstant(
  dateStr: string,
  hour: number = 0,
  minute: number = 0,
): Date {
  const key = `${dateStr}|${hour}|${minute}`;
  const cached = instantCache.get(key);
  if (cached !== undefined) return new Date(cached);

  const [year, month, day] = dateStr.split('-').map(Number);
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  const firstOffset = orgOffsetMs(guess);
  let instantMs = guess - firstOffset;
  const secondOffset = orgOffsetMs(instantMs);
  if (secondOffset !== firstOffset) instantMs = guess - secondOffset;

  const result = new Date(instantMs);
  const parts = readOrgParts(result);
  const resolvedMinutes = Number(parts.hour) * 60 + Number(parts.minute);
  if (`${parts.year}-${parts.month}-${parts.day}` !== dateStr || resolvedMinutes !== hour * 60 + minute) {
    throw new Error(
      `Could not resolve cutoff instant for ${dateStr} ${hour}:${String(minute).padStart(2, '0')} in ${ORG_TIMEZONE}`,
    );
  }

  if (instantCache.size >= INSTANT_CACHE_LIMIT) instantCache.clear();
  instantCache.set(key, instantMs);
  return result;
}

/** True when org-local wall time is at or after hour:minute. */
export function isAtOrAfterOrgLocalTime(now: Date, hour: number, minute: number): boolean {
  return getOrgLocalMinutes(now) >= hour * 60 + minute;
}

/**
 * UTC instant for a wall-clock time on the org-local calendar day of `now`.
 */
export function getOrgLocalCutoffInstant(
  now: Date = new Date(),
  hour: number = 17,
  minute: number = 0,
): Date {
  return getOrgLocalInstant(getOrgLocalDateString(now), hour, minute);
}

const LOCAL_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** True when value is a real calendar YYYY-MM-DD. */
export function isValidOrgLocalDateString(value: string): boolean {
  if (!LOCAL_DATE_RE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const probe = new Date(Date.UTC(year, month - 1, day));
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === day
  );
}

/**
 * Resolve the `now` instant used for shift lookups.
 * - omitted / today → live clock
 * - past date → 4 PM org-local (all daytime hours elapsed)
 * - future date → midnight org-local (no hours started)
 */
export function resolveShiftsReferenceNow(
  dateParam: string | undefined,
  now: Date = new Date(),
): Date {
  if (!dateParam) return now;

  const today = getOrgLocalDateString(now);
  if (dateParam === today) return now;
  if (dateParam < today) return getOrgLocalInstant(dateParam, 16, 0);
  return getOrgLocalInstant(dateParam, 0, 0);
}

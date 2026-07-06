/** IANA timezone for campus wall-clock times (schedule blocks, shift windows). */
export const ORG_TIMEZONE = process.env.ORG_TIMEZONE ?? 'America/Los_Angeles';

function getPart(parts: Intl.DateTimeFormatPart[], type: string): string {
  return parts.find((part) => part.type === type)?.value ?? '';
}

/** Minutes since midnight in the organization timezone. */
export function getOrgLocalMinutes(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ORG_TIMEZONE,
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(now);

  const hour = Number(getPart(parts, 'hour'));
  const minute = Number(getPart(parts, 'minute'));
  return hour * 60 + minute;
}

/** YYYY-MM-DD calendar date in the organization timezone. */
export function getOrgLocalDateString(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ORG_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);

  return `${getPart(parts, 'year')}-${getPart(parts, 'month')}-${getPart(parts, 'day')}`;
}

/** JS day index (0=Sunday … 6=Saturday) in the organization timezone. */
export function getOrgDayOfWeek(now: Date = new Date()): number {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: ORG_TIMEZONE,
    weekday: 'short',
  }).format(now);

  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  return map[weekday] ?? 0;
}

/**
 * UTC instant for a wall-clock time on the org-local calendar day of `now`.
 * Uses binary search over Intl-derived org-local date/minutes (no extra deps).
 */
export function getOrgLocalCutoffInstant(
  now: Date = new Date(),
  hour: number = 17,
  minute: number = 0,
): Date {
  const dateStr = getOrgLocalDateString(now);
  const targetMinutes = hour * 60 + minute;

  const [y, m, d] = dateStr.split('-').map(Number);
  // LA is UTC-7/UTC-8, so local midnight can fall on the prior UTC calendar day.
  let low = Date.UTC(y, m - 1, d - 1, 0, 0, 0);
  let high = Date.UTC(y, m - 1, d + 1, 23, 59, 59);

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = new Date(mid);
    const candidateDate = getOrgLocalDateString(candidate);
    const candidateMinutes = getOrgLocalMinutes(candidate);

    const isBefore =
      candidateDate < dateStr ||
      (candidateDate === dateStr && candidateMinutes < targetMinutes);

    if (isBefore) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  const result = new Date(low);
  if (
    getOrgLocalDateString(result) !== dateStr ||
    getOrgLocalMinutes(result) !== targetMinutes
  ) {
    throw new Error(
      `Could not resolve cutoff instant for ${dateStr} ${hour}:${String(minute).padStart(2, '0')} in ${ORG_TIMEZONE}`,
    );
  }

  return result;
}

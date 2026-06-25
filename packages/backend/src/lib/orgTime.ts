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

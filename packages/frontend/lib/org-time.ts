/**
 * Organization timezone for campus wall-clock times (schedules, staffing).
 * Keep in sync with backend ORG_TIMEZONE (default America/Los_Angeles).
 */
export const ORG_TIMEZONE =
  process.env.NEXT_PUBLIC_ORG_TIMEZONE ?? "America/Los_Angeles"

function getPart(parts: Intl.DateTimeFormatPart[], type: string): string {
  return parts.find((part) => part.type === type)?.value ?? ""
}

/** Minutes since midnight in the organization timezone. */
export function getOrgLocalMinutes(now: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ORG_TIMEZONE,
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(now)

  const hour = Number(getPart(parts, "hour"))
  const minute = Number(getPart(parts, "minute"))
  return hour * 60 + minute
}

/** YYYY-MM-DD calendar date in the organization timezone. */
export function getOrgLocalDateString(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ORG_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)

  return `${getPart(parts, "year")}-${getPart(parts, "month")}-${getPart(parts, "day")}`
}

/** JS day index (0=Sunday … 6=Saturday) in the organization timezone. */
export function getOrgDayOfWeek(now: Date = new Date()): number {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: ORG_TIMEZONE,
    weekday: "short",
  }).format(now)

  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }

  return map[weekday] ?? 0
}

/**
 * UTC instant for a wall-clock time on an org-local calendar day (YYYY-MM-DD).
 */
export function getOrgLocalInstant(
  dateStr: string,
  hour: number = 0,
  minute: number = 0,
): Date {
  const targetMinutes = hour * 60 + minute
  const [y, m, d] = dateStr.split("-").map(Number)
  let low = Date.UTC(y, m - 1, d - 1, 0, 0, 0)
  let high = Date.UTC(y, m - 1, d + 1, 23, 59, 59)

  while (low < high) {
    const mid = Math.floor((low + high) / 2)
    const candidate = new Date(mid)
    const candidateDate = getOrgLocalDateString(candidate)
    const candidateMinutes = getOrgLocalMinutes(candidate)

    const isBefore =
      candidateDate < dateStr ||
      (candidateDate === dateStr && candidateMinutes < targetMinutes)

    if (isBefore) {
      low = mid + 1
    } else {
      high = mid
    }
  }

  const result = new Date(low)
  if (
    getOrgLocalDateString(result) !== dateStr ||
    getOrgLocalMinutes(result) !== targetMinutes
  ) {
    throw new Error(
      `Could not resolve org-local instant for ${dateStr} ${hour}:${String(minute).padStart(2, "0")} in ${ORG_TIMEZONE}`,
    )
  }

  return result
}

/**
 * Minutes since org midnight for a wall-clock `HH:mm` or an ISO timestamp.
 * Schedule times are wall-clock; clock-in/out timestamps are converted via org TZ.
 */
export function toOrgWallClockMinutes(value: string): number {
  if (value.includes("T") || /[zZ]|[+-]\d{2}:?\d{2}$/.test(value)) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return Number.NaN
    return getOrgLocalMinutes(date)
  }

  const match = /^(\d{1,2}):(\d{2})/.exec(value.trim())
  if (!match) return Number.NaN

  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return Number.NaN
  return hours * 60 + minutes
}

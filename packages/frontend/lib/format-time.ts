const TIME_FORMAT: Intl.DateTimeFormatOptions = {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
}

const TIME_HEADER_FORMAT: Intl.DateTimeFormatOptions = {
  hour: "numeric",
  hour12: true,
}

function parseTimeValue(value: string): Date | null {
  if (value.includes("T")) {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date
  }

  const timePattern = /^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(?:Z|[+-]\d{2}(?::?\d{2})?)?$/
  const match = timePattern.exec(value.trim())
  if (!match) {
    return null
  }

  const hours = Number(match[1])
  const minutes = Number(match[2])

  if (hours > 23 || minutes > 59) {
    return null
  }

  return new Date(2000, 0, 1, hours, minutes)
}

/** Normalize time strings to HH:mm for sorting and grouping. */
export function normalizeTimeKey(value: string): string {
  const date = parseTimeValue(value)
  if (!date) {
    return value
  }

  const hours = date.getHours().toString().padStart(2, "0")
  const minutes = date.getMinutes().toString().padStart(2, "0")
  return `${hours}:${minutes}`
}

/** Format a time-of-day or ISO timestamp as "8:00 AM". */
export function formatTime(value: string): string {
  const date = parseTimeValue(value)
  if (!date) {
    return value
  }

  return new Intl.DateTimeFormat("en-US", TIME_FORMAT).format(date)
}

/** Format divider labels; omits minutes when on the hour ("8 AM"). */
export function formatStartTimeHeader(value: string): string {
  const date = parseTimeValue(value)
  if (!date) {
    return value
  }

  if (date.getMinutes() === 0) {
    return new Intl.DateTimeFormat("en-US", TIME_HEADER_FORMAT).format(date)
  }

  return formatTime(value)
}

/** Format a scheduled range as "8:00 AM - 4:00 PM". */
export function formatTimeRange(start: string, end: string): string {
  return `${formatTime(start)} - ${formatTime(end)}`
}

const EMPTY_SHIFT = "--"

/** Format actual clock-in/out; supports time strings or ISO timestamps. */
export function formatActualShift(
  clockIn: string | null,
  clockOut: string | null,
): string {
  const inLabel = clockIn ? formatTime(clockIn) : EMPTY_SHIFT
  const outLabel = clockOut ? formatTime(clockOut) : EMPTY_SHIFT

  if (!clockIn && !clockOut) {
    return `${EMPTY_SHIFT} - ${EMPTY_SHIFT}`
  }

  return `${inLabel} - ${outLabel}`
}

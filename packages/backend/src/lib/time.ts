function parseTimeValue(value: string): Date | null {
  if (value.includes('T')) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const timePattern = /^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(?:Z|[+-]\d{2}(?::?\d{2})?)?$/;
  const match = timePattern.exec(value.trim());
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours > 23 || minutes > 59) {
    return null;
  }

  return new Date(2000, 0, 1, hours, minutes);
}

/** Normalize time strings to HH:mm for sorting and comparison. */
export function normalizeTimeKey(value: string): string {
  const date = parseTimeValue(value);
  if (!date) {
    return value;
  }

  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

/** Convert a time-of-day or ISO timestamp to minutes since midnight (local). */
export function timeToMinutes(value: string): number {
  const normalized = normalizeTimeKey(value);
  const [hours, minutes] = normalized.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return Number.NaN;
  }
  return hours * 60 + minutes;
}

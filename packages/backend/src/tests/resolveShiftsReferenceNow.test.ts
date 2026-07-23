import { describe, it, expect } from 'vitest';
import {
  getOrgLocalDateString,
  getOrgLocalMinutes,
  isValidOrgLocalDateString,
  resolveShiftsReferenceNow,
} from '../lib/orgTime';

describe('isValidOrgLocalDateString', () => {
  it('accepts real calendar dates', () => {
    expect(isValidOrgLocalDateString('2026-06-25')).toBe(true);
    expect(isValidOrgLocalDateString('2024-02-29')).toBe(true);
  });

  it('rejects invalid formats and non-dates', () => {
    expect(isValidOrgLocalDateString('06-25-2026')).toBe(false);
    expect(isValidOrgLocalDateString('2026-6-25')).toBe(false);
    expect(isValidOrgLocalDateString('2026-02-30')).toBe(false);
    expect(isValidOrgLocalDateString('not-a-date')).toBe(false);
  });
});

describe('resolveShiftsReferenceNow', () => {
  // 8:20 AM PDT on Thu Jun 25, 2026
  const now = new Date('2026-06-25T15:20:20.061Z');

  it('returns live clock when date is omitted', () => {
    expect(resolveShiftsReferenceNow(undefined, now)).toBe(now);
  });

  it('returns live clock when date is today', () => {
    expect(resolveShiftsReferenceNow('2026-06-25', now)).toBe(now);
  });

  it('returns 4 PM org-local for a past date', () => {
    const resolved = resolveShiftsReferenceNow('2026-06-24', now);
    expect(getOrgLocalDateString(resolved)).toBe('2026-06-24');
    expect(getOrgLocalMinutes(resolved)).toBe(16 * 60);
  });

  it('returns midnight org-local for a future date', () => {
    const resolved = resolveShiftsReferenceNow('2026-06-26', now);
    expect(getOrgLocalDateString(resolved)).toBe('2026-06-26');
    expect(getOrgLocalMinutes(resolved)).toBe(0);
  });
});

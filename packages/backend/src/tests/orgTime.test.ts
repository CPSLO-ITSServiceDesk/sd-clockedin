import { describe, it, expect } from 'vitest';
import {
  getOrgDayOfWeek,
  getOrgLocalCutoffInstant,
  getOrgLocalDateString,
  getOrgLocalInstant,
  getOrgLocalMinutes,
  isAtOrAfterOrgLocalTime,
} from '../lib/orgTime';

describe('orgTime', () => {
  // 8:20 AM PDT on Thu Jun 25, 2026
  const pacificMorning = new Date('2026-06-25T15:20:20.061Z');

  it('uses organization timezone for minutes, not server timezone', () => {
    expect(getOrgLocalMinutes(pacificMorning)).toBe(8 * 60 + 20);
  });

  it('uses organization timezone for calendar date', () => {
    expect(getOrgLocalDateString(pacificMorning)).toBe('2026-06-25');
  });

  it('uses organization timezone for weekday', () => {
    expect(getOrgDayOfWeek(pacificMorning)).toBe(4);
  });
});

describe('isAtOrAfterOrgLocalTime', () => {
  it('is due at 5 PM PDT and not an hour earlier', () => {
    expect(isAtOrAfterOrgLocalTime(new Date('2026-06-26T00:00:00.000Z'), 17, 0)).toBe(true);
    expect(isAtOrAfterOrgLocalTime(new Date('2026-06-25T23:00:00.000Z'), 17, 0)).toBe(false);
  });

  it('is due at 5 PM PST and not an hour earlier', () => {
    expect(isAtOrAfterOrgLocalTime(new Date('2026-01-16T01:00:00.000Z'), 17, 0)).toBe(true);
    expect(isAtOrAfterOrgLocalTime(new Date('2026-01-16T00:00:00.000Z'), 17, 0)).toBe(false);
  });
});

describe('getOrgLocalInstant', () => {
  it('returns 8:00 AM PDT', () => {
    expect(getOrgLocalInstant('2026-06-25', 8, 0).toISOString()).toBe('2026-06-25T15:00:00.000Z');
  });

  it('returns the earlier instant when a fall-back hour happens twice', () => {
    expect(getOrgLocalInstant('2026-11-01', 1, 30).toISOString()).toBe('2026-11-01T08:30:00.000Z');
  });

  it('throws for a wall time skipped by the spring-forward gap', () => {
    expect(() => getOrgLocalInstant('2026-03-08', 2, 30)).toThrow(/Could not resolve/);
  });
});

describe('getOrgLocalCutoffInstant', () => {
  it('returns 5 PM PDT as UTC midnight next calendar day', () => {
    const duringDay = new Date('2026-06-25T15:20:20.061Z');
    const cutoff = getOrgLocalCutoffInstant(duringDay, 17, 0);
    expect(cutoff.toISOString()).toBe('2026-06-26T00:00:00.000Z');
  });

  it('returns 5 PM PST as UTC 1 AM next calendar day', () => {
    const duringDay = new Date('2026-01-15T20:00:00.000Z');
    const cutoff = getOrgLocalCutoffInstant(duringDay, 17, 0);
    expect(cutoff.toISOString()).toBe('2026-01-16T01:00:00.000Z');
  });
});

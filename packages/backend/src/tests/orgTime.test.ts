import { describe, it, expect } from 'vitest';
import {
  getOrgDayOfWeek,
  getOrgLocalCutoffInstant,
  getOrgLocalDateString,
  getOrgLocalMinutes,
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

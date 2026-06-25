import { describe, it, expect } from 'vitest';
import {
  getOrgDayOfWeek,
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

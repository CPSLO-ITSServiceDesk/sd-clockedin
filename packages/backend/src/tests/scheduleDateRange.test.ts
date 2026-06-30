import { describe, expect, it } from 'vitest';
import {
  getEffectiveScheduleDateRange,
  isDateInEffectiveScheduleRange,
} from '../lib/scheduleDateRange';

const term = {
  start_date: '2026-06-14',
  end_date: '2026-08-24',
};

describe('getEffectiveScheduleDateRange', () => {
  it('falls back to term dates when overrides are null', () => {
    expect(
      getEffectiveScheduleDateRange(
        { start_date: null, end_date: null },
        term,
      ),
    ).toEqual({
      startDate: '2026-06-14',
      endDate: '2026-08-24',
    });
  });

  it('uses schedule overrides within the term', () => {
    expect(
      getEffectiveScheduleDateRange(
        { start_date: '2026-06-18', end_date: '2026-07-24' },
        term,
      ),
    ).toEqual({
      startDate: '2026-06-18',
      endDate: '2026-07-24',
    });
  });

  it('clamps overrides that exceed the term bounds', () => {
    expect(
      getEffectiveScheduleDateRange(
        { start_date: '2026-06-01', end_date: '2026-09-01' },
        term,
      ),
    ).toEqual({
      startDate: '2026-06-14',
      endDate: '2026-08-24',
    });
  });
});

describe('isDateInEffectiveScheduleRange', () => {
  it('returns false for dates outside the effective range', () => {
    const schedule = { start_date: '2026-06-18', end_date: '2026-07-24' };

    expect(isDateInEffectiveScheduleRange('2026-06-16', schedule, term)).toBe(false);
    expect(isDateInEffectiveScheduleRange('2026-06-18', schedule, term)).toBe(true);
    expect(isDateInEffectiveScheduleRange('2026-07-24', schedule, term)).toBe(true);
    expect(isDateInEffectiveScheduleRange('2026-07-28', schedule, term)).toBe(false);
  });
});

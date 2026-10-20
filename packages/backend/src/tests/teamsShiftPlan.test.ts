import { describe, expect, it } from 'vitest';
import { getOrgLocalInstant } from '../lib/orgTime';
import {
  TEAMS_THEME,
  expandWeeklyShifts,
  mondayOf,
  planShiftChanges,
  type ExistingTeamsShift,
} from '../lib/teamsShiftPlan';

const term = {
  start_date: '2026-10-14', // a Wednesday
  end_date: '2026-10-30',
  off_days: {
    vacations: [{ date: '2026-10-21' }],
    special_schedules: [{ date: '2026-10-22', swap_to_day: 'monday' }],
  },
};

const at = (date: string, hour: number, minute = 0) => getOrgLocalInstant(date, hour, minute).toISOString();

const weekly = [
  { day: 'monday' as const, startMinutes: 8 * 60, endMinutes: 12 * 60, theme: TEAMS_THEME.inPerson },
  { day: 'wednesday' as const, startMinutes: 13 * 60, endMinutes: 15 * 60 + 30, theme: TEAMS_THEME.training },
];

describe('expandWeeklyShifts', () => {
  it('lays a weekly pattern over the chosen weeks, inside the term', () => {
    const shifts = expandWeeklyShifts('u1', weekly, '2026-10-12', '2026-10-30', term);

    expect(shifts.map((shift) => `${shift.date} ${shift.theme}`)).toEqual([
      '2026-10-14 purple', // term starts Wednesday, so the first Monday is skipped
      '2026-10-19 green',
      // 10/21 is a vacation day
      '2026-10-22 green', // Thursday runs the Monday schedule
      '2026-10-26 green',
      '2026-10-28 purple',
    ]);
    expect(shifts[0]).toMatchObject({ userId: 'u1', start: at('2026-10-14', 13), end: at('2026-10-14', 15, 30) });
  });

  it('honors a narrower date range', () => {
    const shifts = expandWeeklyShifts('u1', weekly, '2026-10-26', '2026-10-27', term);
    expect(shifts.map((shift) => shift.date)).toEqual(['2026-10-26']);
  });
});

describe('planShiftChanges', () => {
  const existing = (id: string, start: string, end: string, extra: Partial<ExistingTeamsShift> = {}): ExistingTeamsShift => ({
    id, userId: 'u1', start, end, draftOnly: false, isStagedForDeletion: false, ...extra,
  });

  it('keeps matches, creates what is missing and stages what is no longer wanted', () => {
    const desired = expandWeeklyShifts('u1', weekly, '2026-10-19', '2026-10-23', term);
    const plan = planShiftChanges(desired, [
      existing('keep', at('2026-10-19', 8), at('2026-10-19', 12)),
      existing('old-shared', at('2026-10-20', 9), at('2026-10-20', 11)),
      existing('old-draft', at('2026-10-23', 9), at('2026-10-23', 11), { draftOnly: true }),
      existing('restore', at('2026-10-22', 8), at('2026-10-22', 12), { isStagedForDeletion: true }),
      existing('already-gone', at('2026-10-23', 13), at('2026-10-23', 14), { isStagedForDeletion: true }),
    ]);

    expect(plan.keep).toEqual(['keep']);
    expect(plan.unstage).toEqual(['restore']);
    expect(plan.create).toEqual([]);
    expect(plan.stage).toEqual(['old-shared']);
    expect(plan.deleteDrafts).toEqual(['old-draft']);
  });

  it('creates shifts that are not in Teams yet', () => {
    const desired = expandWeeklyShifts('u1', weekly, '2026-10-26', '2026-10-30', term);
    const plan = planShiftChanges(desired, []);
    expect(plan.create.map((shift) => shift.date)).toEqual(['2026-10-26', '2026-10-28']);
  });
});

describe('mondayOf', () => {
  it('returns the Monday of the week', () => {
    expect(mondayOf('2026-10-14')).toBe('2026-10-12');
    expect(mondayOf('2026-10-18')).toBe('2026-10-12');
    expect(mondayOf('2026-10-19')).toBe('2026-10-19');
  });
});

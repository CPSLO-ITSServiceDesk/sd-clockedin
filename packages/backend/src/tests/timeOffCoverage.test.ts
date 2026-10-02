import { describe, expect, it } from 'vitest';
import {
  isCampusVacationOnDate,
  isTimeOffCoveringInstant,
  isTimeOffCoveringOrgLocalDate,
  isVacationDay,
  parseOffDays,
} from '../lib/timeOffCoverage';
import type { Database } from '../types/database.types';

type Term = Database['public']['Tables']['academic_term']['Row'];

const term: Term = {
  id: 1,
  name: 'Summer 2026',
  start_date: '2026-06-22',
  end_date: '2026-06-26',
  is_active: true,
  remote_shifts_allowed: false,
  off_days: {
    vacations: [{ date: '2026-06-24' }],
    special_schedules: [],
  },
  created_at: '2026-06-01T00:00:00Z',
};

/** All-day org-local June 22 PDT (midnight to next midnight, exclusive end). */
const allDayJune22 = {
  student_assistant_id: 100,
  starts_at: '2026-06-22T07:00:00.000Z',
  ends_at: '2026-06-23T07:00:00.000Z',
};

/** Afternoon-only June 22 1:00–5:00 PM PDT. */
const afternoonJune22 = {
  student_assistant_id: 100,
  starts_at: '2026-06-22T20:00:00.000Z',
  ends_at: '2026-06-23T00:00:00.000Z',
};

describe('parseOffDays / isVacationDay', () => {
  it('reads vacations from term.off_days', () => {
    expect(isVacationDay('2026-06-24', parseOffDays(term))).toBe(true);
    expect(isVacationDay('2026-06-22', parseOffDays(term))).toBe(false);
    expect(isCampusVacationOnDate(term, '2026-06-24')).toBe(true);
  });

  it('treats missing or non-object off_days as no vacations', () => {
    expect(isCampusVacationOnDate({ ...term, off_days: null }, '2026-06-24')).toBe(false);
    expect(isCampusVacationOnDate(undefined, '2026-06-24')).toBe(false);
  });
});

describe('isTimeOffCoveringInstant', () => {
  it('covers instants inside [starts_at, ends_at)', () => {
    const morning = new Date('2026-06-22T16:30:00.000Z');
    const nextMidnight = new Date('2026-06-23T07:00:00.000Z');

    expect(isTimeOffCoveringInstant([allDayJune22], 100, morning)).toBe(true);
    expect(isTimeOffCoveringInstant([allDayJune22], 100, nextMidnight)).toBe(false);
    expect(isTimeOffCoveringInstant([allDayJune22], 999, morning)).toBe(false);
  });

  it('does not cover the morning for afternoon-only time off', () => {
    const morning = new Date('2026-06-22T16:30:00.000Z');
    const afternoon = new Date('2026-06-22T21:00:00.000Z');

    expect(isTimeOffCoveringInstant([afternoonJune22], 100, morning)).toBe(false);
    expect(isTimeOffCoveringInstant([afternoonJune22], 100, afternoon)).toBe(true);
  });
});

describe('isTimeOffCoveringOrgLocalDate', () => {
  it('covers the org-local day for all-day exclusive-end time off, not the next day', () => {
    expect(isTimeOffCoveringOrgLocalDate([allDayJune22], 100, '2026-06-22')).toBe(true);
    expect(isTimeOffCoveringOrgLocalDate([allDayJune22], 100, '2026-06-23')).toBe(false);
  });

  it('covers the calendar day when any part of the interval overlaps it', () => {
    expect(isTimeOffCoveringOrgLocalDate([afternoonJune22], 100, '2026-06-22')).toBe(true);
    expect(isTimeOffCoveringOrgLocalDate([afternoonJune22], 100, '2026-06-23')).toBe(false);
  });
});

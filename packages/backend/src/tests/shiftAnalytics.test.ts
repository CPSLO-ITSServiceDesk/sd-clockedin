import { describe, it, expect } from 'vitest';
import {
  buildStudentAnalytics,
  buildTermAnalytics,
  expandEvaluatedShifts,
} from '../lib/shiftAnalytics';
import type { Database } from '../types/database.types';

type Term = Database['public']['Tables']['academic_term']['Row'];
type Schedule = Database['public']['Tables']['schedules']['Row'];
type ScheduleBlock = Database['public']['Tables']['schedule_blocks']['Row'];
type TimeEntry = Database['public']['Tables']['time_entry']['Row'];

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

const schedules: Schedule[] = [
  {
    id: 10,
    academic_term_id: 1,
    student_assistant_id: 100,
    created_at: '2026-06-01T00:00:00Z',
  },
];

const scheduleBlocks: ScheduleBlock[] = [
  {
    id: 20,
    schedule_id: 10,
    days: 'monday',
    start_time: '09:00',
    end_time: '12:00',
    is_remote: false,
    created_at: '2026-06-01T00:00:00Z',
  },
  {
    id: 21,
    schedule_id: 10,
    days: 'monday',
    start_time: '13:00',
    end_time: '16:00',
    is_remote: true,
    created_at: '2026-06-01T00:00:00Z',
  },
];

const now = new Date('2026-06-23T19:00:00.000Z');

describe('expandEvaluatedShifts', () => {
  it('expands in-person blocks and excludes remote and vacation days', () => {
    const shifts = expandEvaluatedShifts(term, schedules, scheduleBlocks, [], { now });

    expect(shifts.map((shift) => shift.date)).toEqual(['2026-06-22']);
    expect(shifts.every((shift) => !shift.startTime.includes('13:00'))).toBe(true);
  });

  it('matches time entries by block, student, and clock-in date', () => {
    const timeEntries: TimeEntry[] = [
      {
        id: 1,
        schedule_block_id: 20,
        student_assistant_id: 100,
        clock_in: '2026-06-22T16:10:00.000Z',
        clock_out: '2026-06-22T19:00:00.000Z',
        created_at: '2026-06-22T09:10:00Z',
      },
    ];

    const shifts = expandEvaluatedShifts(term, schedules, scheduleBlocks, timeEntries, { now });

    expect(shifts).toHaveLength(1);
    expect(shifts[0].status).toBe('late');
    expect(shifts[0].minutesLate).toBe(5);
  });

  it('marks past shifts without clock-in as absent', () => {
    const shifts = expandEvaluatedShifts(term, schedules, scheduleBlocks, [], { now });

    expect(shifts[0].status).toBe('absent');
  });
});

describe('buildTermAnalytics', () => {
  it('aggregates summary and late-by-slot metrics', () => {
    const timeEntries: TimeEntry[] = [
      {
        id: 1,
        schedule_block_id: 20,
        student_assistant_id: 100,
        clock_in: '2026-06-22T16:00:00.000Z',
        clock_out: '2026-06-22T19:00:00.000Z',
        created_at: '2026-06-22T09:00:00Z',
      },
    ];

    const result = buildTermAnalytics(term, schedules, scheduleBlocks, timeEntries, now);

    expect(result.summary.totalEvaluated).toBe(1);
    expect(result.summary.onTime).toBe(1);
    expect(result.dailyTrend).toHaveLength(1);
    expect(result.lateByTimeSlot[0]).toMatchObject({
      startTime: '09:00',
      lateCount: 0,
      totalShifts: 1,
    });
  });
});

describe('buildStudentAnalytics', () => {
  it('returns student-specific recent issues', () => {
    const timeEntries: TimeEntry[] = [
      {
        id: 1,
        schedule_block_id: 20,
        student_assistant_id: 100,
        clock_in: '2026-06-22T16:15:00.000Z',
        clock_out: '2026-06-22T19:00:00.000Z',
        created_at: '2026-06-22T09:15:00Z',
      },
    ];

    const result = buildStudentAnalytics(
      term,
      100,
      schedules,
      scheduleBlocks,
      timeEntries,
      now,
    );

    expect(result.summary.late).toBe(1);
    expect(result.recentIssues).toHaveLength(1);
    expect(result.recentIssues[0].status).toBe('late');
    expect(result.recentIssues[0].minutesLate).toBe(10);
  });
});

import { describe, it, expect } from 'vitest';
import {
  buildNormalizationPreview,
  validateNormalizationMatch,
} from '../lib/shiftNormalization';
import type { Database } from '../types/database.types';

type Term = Database['public']['Tables']['academic_term']['Row'];
type Schedule = Database['public']['Tables']['schedules']['Row'];
type ScheduleBlock = Database['public']['Tables']['schedule_blocks']['Row'];
type TimeEntry = Database['public']['Tables']['time_entry']['Row'];
type StudentAssistant = Database['public']['Tables']['student_assistant']['Row'];

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
    start_date: null,
    end_date: null,
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
    is_remote: false,
    created_at: '2026-06-01T00:00:00Z',
  },
];

const students: StudentAssistant[] = [
  {
    id: 100,
    first_name: 'Alex',
    last_name: 'Student',
    is_active: true,
    polycard_id: null,
    position: 'student_assistant',
    work_email: 'alex@example.com',
    created_at: '2026-06-01T00:00:00Z',
  },
];

/** Monday 2026-06-22, 9:10 AM Pacific (PDT) */
const mondayMorningClockIn = '2026-06-22T16:10:00.000Z';
/** Monday 2026-06-22, 8:20 AM Pacific — within 60-min early window for 9:00 block */
const mondayEarlyClockIn = '2026-06-22T15:20:00.000Z';
/** Monday 2026-06-22, 7:00 AM Pacific — too early for 9:00 block */
const mondayTooEarlyClockIn = '2026-06-22T14:00:00.000Z';
/** Monday 2026-06-22, 1:30 PM Pacific */
const mondayAfternoonClockIn = '2026-06-22T20:30:00.000Z';

const now = new Date('2026-06-23T19:00:00.000Z');

describe('buildNormalizationPreview', () => {
  it('proposes a match when clock-in is within the early-arrival window', () => {
    const timeEntries: TimeEntry[] = [
      {
        id: 1,
        schedule_block_id: null,
        student_assistant_id: 100,
        clock_in: mondayMorningClockIn,
        clock_out: '2026-06-22T19:00:00.000Z',
        created_at: '2026-06-22T09:10:00Z',
      },
    ];

    const preview = buildNormalizationPreview(
      term,
      schedules,
      scheduleBlocks,
      timeEntries,
      students,
      now,
    );

    expect(preview.summary).toEqual({
      totalUnscheduled: 1,
      proposedMatches: 1,
      noMatch: 0,
    });
    expect(preview.proposals[0]).toMatchObject({
      timeEntryId: 1,
      proposedBlockId: 20,
      blockDay: 'monday',
    });
  });

  it('proposes a match for early arrival within 60 minutes of block start', () => {
    const timeEntries: TimeEntry[] = [
      {
        id: 2,
        schedule_block_id: null,
        student_assistant_id: 100,
        clock_in: mondayEarlyClockIn,
        clock_out: null,
        created_at: '2026-06-22T08:20:00Z',
      },
    ];

    const preview = buildNormalizationPreview(
      term,
      schedules,
      scheduleBlocks,
      timeEntries,
      students,
      now,
    );

    expect(preview.proposals).toHaveLength(1);
    expect(preview.proposals[0].proposedBlockId).toBe(20);
  });

  it('returns no match when clock-in is too early', () => {
    const timeEntries: TimeEntry[] = [
      {
        id: 3,
        schedule_block_id: null,
        student_assistant_id: 100,
        clock_in: mondayTooEarlyClockIn,
        clock_out: null,
        created_at: '2026-06-22T07:00:00Z',
      },
    ];

    const preview = buildNormalizationPreview(
      term,
      schedules,
      scheduleBlocks,
      timeEntries,
      students,
      now,
    );

    expect(preview.proposals).toHaveLength(0);
    expect(preview.unmatched[0].reason).toBe('outside_window');
  });

  it('skips when block is already claimed by another entry', () => {
    const singleBlock = scheduleBlocks.filter((b) => b.id === 20);
    const timeEntries: TimeEntry[] = [
      {
        id: 10,
        schedule_block_id: 20,
        student_assistant_id: 100,
        clock_in: mondayMorningClockIn,
        clock_out: '2026-06-22T19:00:00.000Z',
        created_at: '2026-06-22T09:10:00Z',
      },
      {
        id: 11,
        schedule_block_id: null,
        student_assistant_id: 100,
        clock_in: mondayMorningClockIn,
        clock_out: null,
        created_at: '2026-06-22T09:15:00Z',
      },
    ];

    const preview = buildNormalizationPreview(
      term,
      schedules,
      singleBlock,
      timeEntries,
      students,
      now,
    );

    expect(preview.proposals).toHaveLength(0);
    expect(preview.unmatched[0].reason).toBe('block_already_claimed');
  });

  it('assigns two unscheduled entries on the same day to different blocks', () => {
    const timeEntries: TimeEntry[] = [
      {
        id: 20,
        schedule_block_id: null,
        student_assistant_id: 100,
        clock_in: mondayMorningClockIn,
        clock_out: '2026-06-22T19:00:00.000Z',
        created_at: '2026-06-22T09:10:00Z',
      },
      {
        id: 21,
        schedule_block_id: null,
        student_assistant_id: 100,
        clock_in: mondayAfternoonClockIn,
        clock_out: '2026-06-22T23:00:00.000Z',
        created_at: '2026-06-22T13:30:00Z',
      },
    ];

    const preview = buildNormalizationPreview(
      term,
      schedules,
      scheduleBlocks,
      timeEntries,
      students,
      now,
    );

    expect(preview.proposals).toHaveLength(2);
    expect(preview.proposals.map((p) => p.proposedBlockId).sort()).toEqual([20, 21]);
  });

  it('excludes vacation days', () => {
    const timeEntries: TimeEntry[] = [
      {
        id: 30,
        schedule_block_id: null,
        student_assistant_id: 100,
        clock_in: '2026-06-24T16:10:00.000Z',
        clock_out: null,
        created_at: '2026-06-24T09:10:00Z',
      },
    ];

    const afterTerm = new Date('2026-06-26T19:00:00.000Z');
    const preview = buildNormalizationPreview(
      term,
      schedules,
      scheduleBlocks,
      timeEntries,
      students,
      afterTerm,
    );

    expect(preview.proposals).toHaveLength(0);
    expect(preview.unmatched[0].reason).toBe('no_blocks_that_day');
  });

  it('reports no_schedule when student has no term schedule', () => {
    const timeEntries: TimeEntry[] = [
      {
        id: 40,
        schedule_block_id: null,
        student_assistant_id: 999,
        clock_in: mondayMorningClockIn,
        clock_out: null,
        created_at: '2026-06-22T09:10:00Z',
      },
    ];

    const preview = buildNormalizationPreview(
      term,
      schedules,
      scheduleBlocks,
      timeEntries,
      students,
      now,
    );

    expect(preview.unmatched[0].reason).toBe('no_schedule');
  });
});

describe('validateNormalizationMatch', () => {
  const context = {
    term,
    schedules,
    scheduleBlocks,
    timeEntries: [
      {
        id: 1,
        schedule_block_id: null,
        student_assistant_id: 100,
        clock_in: mondayMorningClockIn,
        clock_out: null,
        created_at: '2026-06-22T09:10:00Z',
      },
    ] as TimeEntry[],
    students,
  };

  it('accepts a valid proposed match', () => {
    const result = validateNormalizationMatch(
      { timeEntryId: 1, scheduleBlockId: 20 },
      context,
      now,
    );
    expect(result).toEqual({ valid: true });
  });

  it('rejects when entry is already linked', () => {
    const linkedContext = {
      ...context,
      timeEntries: [
        {
          ...context.timeEntries[0],
          schedule_block_id: 20,
        },
      ],
    };

    const result = validateNormalizationMatch(
      { timeEntryId: 1, scheduleBlockId: 20 },
      linkedContext,
      now,
    );
    expect(result).toEqual({
      valid: false,
      reason: 'Time entry already linked to a block',
    });
  });

  it('rejects when block is already claimed', () => {
    const claimedContext = {
      ...context,
      timeEntries: [
        ...context.timeEntries,
        {
          id: 2,
          schedule_block_id: 20,
          student_assistant_id: 100,
          clock_in: mondayMorningClockIn,
          clock_out: '2026-06-22T19:00:00.000Z',
          created_at: '2026-06-22T09:10:00Z',
        },
      ],
    };

    const result = validateNormalizationMatch(
      { timeEntryId: 1, scheduleBlockId: 20 },
      claimedContext,
      now,
    );
    expect(result).toEqual({
      valid: false,
      reason: 'Block already claimed for this student and date',
    });
  });
});

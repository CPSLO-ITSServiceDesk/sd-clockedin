import { describe, expect, it } from 'vitest';
import { assembleTodayShifts } from '../services/todayShiftsService';
import type { Database } from '../types/database.types';

type Term = Database['public']['Tables']['academic_term']['Row'];
type Schedule = Database['public']['Tables']['schedules']['Row'];
type ScheduleBlock = Database['public']['Tables']['schedule_blocks']['Row'];
type TimeEntry = Database['public']['Tables']['time_entry']['Row'];
type StudentAssistant = Database['public']['Tables']['student_assistant']['Row'];
type StudentTimeOff = Database['public']['Tables']['student_time_off']['Row'];

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
  {
    id: 11,
    academic_term_id: 1,
    student_assistant_id: 200,
    start_date: null,
    end_date: null,
    created_at: '2026-06-01T00:00:00Z',
  },
];

const mondayBlocks: ScheduleBlock[] = [
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
    schedule_id: 11,
    days: 'monday',
    start_time: '09:00',
    end_time: '12:00',
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
    entra_user_id: null,
    created_at: '2026-06-01T00:00:00Z',
  },
  {
    id: 200,
    first_name: 'Blair',
    last_name: 'Peer',
    is_active: true,
    polycard_id: null,
    position: 'student_assistant',
    work_email: 'blair@example.com',
    entra_user_id: null,
    created_at: '2026-06-01T00:00:00Z',
  },
];

/** Monday 2026-06-22, 9:30 AM PDT */
const mondayMorning = new Date('2026-06-22T16:30:00.000Z');
/** Wednesday 2026-06-24, 9:30 AM PDT — campus vacation */
const wednesdayMorning = new Date('2026-06-24T16:30:00.000Z');

const allDayMondayTimeOff: StudentTimeOff = {
  id: 1,
  academic_term_id: 1,
  student_assistant_id: 100,
  starts_at: '2026-06-22T07:00:00.000Z',
  ends_at: '2026-06-23T07:00:00.000Z',
  teams_time_off_id: 'TOFF_1',
  time_off_reason: 'Vacation',
  created_at: '2026-06-01T00:00:00Z',
};

function assemble(overrides: Partial<Parameters<typeof assembleTodayShifts>[0]> = {}) {
  return assembleTodayShifts({
    now: mondayMorning,
    todayDate: '2026-06-22',
    includeRemote: false,
    schedules,
    scheduleBlocks: mondayBlocks,
    studentAssistants: students,
    timeEntries: [],
    terms: [term],
    studentTimeOff: [],
    ...overrides,
  });
}

describe('assembleTodayShifts', () => {
  it('shows scheduled blocks on a regular weekday', () => {
    const result = assemble();

    expect(result.shifts.map((shift) => shift.studentAssistantId).sort()).toEqual([100, 200]);
    expect(result.shifts.every((shift) => shift.scheduleBlockId != null)).toBe(true);
  });

  it('omits all scheduled blocks on a campus vacation date', () => {
    const result = assemble({
      now: wednesdayMorning,
      todayDate: '2026-06-24',
      scheduleBlocks: mondayBlocks.map((block) => ({ ...block, days: 'wednesday' })),
    });

    expect(result.shifts).toEqual([]);
  });

  it('still shows an open unscheduled punch on a campus vacation date', () => {
    const timeEntries: TimeEntry[] = [
      {
        id: 50,
        schedule_block_id: null,
        student_assistant_id: 100,
        clock_in: '2026-06-24T16:05:00.000Z',
        clock_out: null,
        created_at: '2026-06-24T09:05:00Z',
      },
    ];

    const result = assemble({
      now: wednesdayMorning,
      todayDate: '2026-06-24',
      scheduleBlocks: mondayBlocks.map((block) => ({ ...block, days: 'wednesday' })),
      timeEntries,
    });

    expect(result.shifts).toHaveLength(1);
    expect(result.shifts[0]).toMatchObject({
      scheduleBlockId: null,
      studentAssistantId: 100,
      timeEntryId: 50,
      clockInActual: timeEntries[0].clock_in,
      clockOutActual: null,
    });
  });

  it('omits a student whose time off covers now, but keeps other students', () => {
    const result = assemble({
      studentTimeOff: [allDayMondayTimeOff],
    });

    expect(result.shifts.map((shift) => shift.studentAssistantId)).toEqual([200]);
  });

  it('still shows an open unscheduled punch for a student on time off', () => {
    const timeEntries: TimeEntry[] = [
      {
        id: 51,
        schedule_block_id: null,
        student_assistant_id: 100,
        clock_in: '2026-06-22T16:05:00.000Z',
        clock_out: null,
        created_at: '2026-06-22T09:05:00Z',
      },
    ];

    const result = assemble({
      studentTimeOff: [allDayMondayTimeOff],
      timeEntries,
    });

    expect(result.shifts).toHaveLength(2);
    expect(result.shifts.find((shift) => shift.studentAssistantId === 100)).toMatchObject({
      scheduleBlockId: null,
      timeEntryId: 51,
    });
    expect(result.shifts.find((shift) => shift.studentAssistantId === 200)?.scheduleBlockId).toBe(
      21,
    );
  });

  it('keeps morning scheduled blocks when time off starts later the same day', () => {
    const afternoonOnly: StudentTimeOff = {
      ...allDayMondayTimeOff,
      starts_at: '2026-06-22T20:00:00.000Z',
      ends_at: '2026-06-23T00:00:00.000Z',
    };

    const result = assemble({
      studentTimeOff: [afternoonOnly],
    });

    expect(result.shifts.map((shift) => shift.studentAssistantId).sort()).toEqual([100, 200]);
  });
});

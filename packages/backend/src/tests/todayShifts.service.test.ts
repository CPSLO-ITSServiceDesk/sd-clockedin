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

  /** Alex's time off on Monday, in PDT (UTC-7). */
  const mondayOff = (startHour: number, endHour: number): StudentTimeOff => ({
    ...allDayMondayTimeOff,
    starts_at: `2026-06-22T${String(startHour + 7).padStart(2, '0')}:00:00.000Z`,
    ends_at: `2026-06-22T${String(endHour + 7).padStart(2, '0')}:00:00.000Z`,
  });
  const alex = (result: ReturnType<typeof assemble>) =>
    result.shifts.find((shift) => shift.studentAssistantId === 100);

  it('reports a shift fully covered by time off before the time off starts', () => {
    const result = assemble({
      now: new Date('2026-06-22T15:00:00.000Z'), // 8:00 AM
      studentTimeOff: [mondayOff(9, 12)],
    });

    expect(alex(result)).toBeUndefined();
    expect(result.timeOffShifts.map((shift) => shift.scheduleBlockId)).toEqual([20]);
  });

  it('reports full-shift time off when viewing another day, whatever the reference time', () => {
    const result = assemble({
      now: new Date('2026-06-22T07:00:00.000Z'), // midnight, as for a future ?date=
      studentTimeOff: [mondayOff(9, 12)],
    });

    expect(result.timeOffShifts.map((shift) => shift.studentAssistantId)).toEqual([100]);
  });

  it('trims a shift whose end is covered by time off', () => {
    const result = assemble({ studentTimeOff: [mondayOff(11, 12)] });

    expect(alex(result)).toMatchObject({ startTime: '09:00', endTime: '11:00' });
    expect(result.timeOffShifts).toEqual([]);
  });

  it('reports the time-off hours of a trimmed shift in partialTimeOff, to the whole minute', () => {
    const result = assemble({
      // Teams stamps time off a few seconds past the minute.
      studentTimeOff: [{ ...mondayOff(11, 12), starts_at: '2026-06-22T18:00:58.000Z' }],
    });

    expect(alex(result)).toMatchObject({ startTime: '09:00', endTime: '11:00' });
    expect(result.partialTimeOff).toEqual([
      expect.objectContaining({ studentAssistantId: 100, startTime: '11:00', endTime: '12:00' }),
    ]);
  });

  it('starts the shift when time off at its start ends, and shows time off during it', () => {
    const during = assemble({ studentTimeOff: [mondayOff(9, 10)] }); // 9:30 AM
    expect(alex(during)).toBeUndefined();
    expect(during.timeOffShifts.map((shift) => shift.studentAssistantId)).toEqual([100]);

    const after = assemble({
      now: new Date('2026-06-22T17:30:00.000Z'), // 10:30 AM
      studentTimeOff: [mondayOff(9, 10)],
    });
    expect(alex(after)).toMatchObject({ startTime: '10:00', endTime: '12:00' });
  });

  it('lists every time off overlapping today in todayTimeOff, even after it ended', () => {
    const result = assemble({
      now: new Date('2026-06-22T22:00:00.000Z'), // 3:00 PM, after both
      studentTimeOff: [
        mondayOff(9, 10),
        { ...mondayOff(12, 13), id: 2, student_assistant_id: 200 },
        { ...allDayMondayTimeOff, id: 3, starts_at: '2026-06-23T16:00:00.000Z', ends_at: '2026-06-23T17:00:00.000Z' },
      ],
    });

    expect(result.todayTimeOff.map((entry) => [entry.firstName, entry.startsAt])).toEqual([
      ['Alex', '2026-06-22T16:00:00.000Z'],
      ['Blair', '2026-06-22T19:00:00.000Z'],
    ]);
    expect(result.upcomingTimeOff.map((entry) => entry.startsAt)).toEqual(['2026-06-23T16:00:00.000Z']);
  });

  it('includes remote staff time off for the wall display', () => {
    const remoteBlocks = mondayBlocks.map((block) => (block.id === 20 ? { ...block, is_remote: true } : block));
    const result = assemble({
      includeRemote: true,
      scheduleBlocks: remoteBlocks,
      studentTimeOff: [allDayMondayTimeOff],
    });

    expect(result.todayTimeOff.map((entry) => entry.studentAssistantId)).toEqual([100]);
    expect(result.timeOffShifts).toEqual([
      expect.objectContaining({ studentAssistantId: 100, isRemote: true }),
    ]);
    // Without remote shifts requested, their time off is still listed for the day.
    expect(assemble({ scheduleBlocks: remoteBlocks, studentTimeOff: [allDayMondayTimeOff] }).todayTimeOff)
      .toHaveLength(1);
  });

  it('reports blocks omitted for time off in timeOffShifts', () => {
    const result = assemble({
      studentTimeOff: [allDayMondayTimeOff],
    });

    expect(result.timeOffShifts).toEqual([
      expect.objectContaining({
        scheduleBlockId: 20,
        studentAssistantId: 100,
        firstName: 'Alex',
        startTime: '09:00',
        endTime: '12:00',
        timeOffEndsAt: allDayMondayTimeOff.ends_at,
        timeOffReason: 'Vacation',
      }),
    ]);
  });

  it('does not report campus vacation blocks as time off', () => {
    const result = assemble({
      now: wednesdayMorning,
      todayDate: '2026-06-24',
      scheduleBlocks: mondayBlocks.map((block) => ({ ...block, days: 'wednesday' })),
      studentTimeOff: [
        {
          ...allDayMondayTimeOff,
          starts_at: '2026-06-24T07:00:00.000Z',
          ends_at: '2026-06-25T07:00:00.000Z',
        },
      ],
    });

    expect(result.timeOffShifts).toEqual([]);
  });

  it('lists current and upcoming time off within the window, soonest first', () => {
    const later: StudentTimeOff = {
      ...allDayMondayTimeOff,
      id: 2,
      student_assistant_id: 200,
      teams_time_off_id: 'TOFF_2',
      starts_at: '2026-06-25T07:00:00.000Z',
      ends_at: '2026-06-26T07:00:00.000Z',
      time_off_reason: null,
    };
    const past: StudentTimeOff = {
      ...allDayMondayTimeOff,
      id: 3,
      teams_time_off_id: 'TOFF_3',
      starts_at: '2026-06-15T07:00:00.000Z',
      ends_at: '2026-06-16T07:00:00.000Z',
    };
    const farFuture: StudentTimeOff = {
      ...allDayMondayTimeOff,
      id: 4,
      teams_time_off_id: 'TOFF_4',
      starts_at: '2026-08-01T07:00:00.000Z',
      ends_at: '2026-08-02T07:00:00.000Z',
    };

    const result = assemble({
      studentTimeOff: [later, past, farFuture, allDayMondayTimeOff],
    });

    expect(result.upcomingTimeOff).toEqual([
      expect.objectContaining({ studentAssistantId: 100, reason: 'Vacation' }),
      expect.objectContaining({ studentAssistantId: 200, firstName: 'Blair', reason: null }),
    ]);
  });
});

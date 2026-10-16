import { describe, expect, it } from 'vitest';
import { buildMonthTimesheets, isValidMonth, monthBounds } from '../lib/timesheetMonth';
import type { Database } from '../types/database.types';

type Term = Database['public']['Tables']['academic_term']['Row'];
type Schedule = Database['public']['Tables']['schedules']['Row'];
type ScheduleBlock = Database['public']['Tables']['schedule_blocks']['Row'];
type TimeEntry = Database['public']['Tables']['time_entry']['Row'];

// September 2026: the 1st is a Tuesday; org timezone is America/Los_Angeles (UTC-7).
const term: Term = {
  id: 1,
  name: 'Fall 2026',
  start_date: '2026-09-01',
  end_date: '2026-12-11',
  is_active: true,
  remote_shifts_allowed: true,
  off_days: { vacations: [{ date: '2026-09-07' }], special_schedules: [] },
  created_at: '2026-08-01T00:00:00Z',
};

const schedules: Schedule[] = [
  {
    id: 10,
    academic_term_id: 1,
    student_assistant_id: 100,
    start_date: null,
    end_date: null,
    created_at: '2026-08-01T00:00:00Z',
  },
];

const block = (id: number, days: ScheduleBlock['days'], start: string, end: string, isRemote = false): ScheduleBlock => ({
  id,
  schedule_id: 10,
  days,
  start_time: start,
  end_time: end,
  is_remote: isRemote,
  created_at: '2026-08-01T00:00:00Z',
});

const scheduleBlocks = [
  block(20, 'monday', '08:00', '12:00'),
  block(21, 'wednesday', '09:00', '11:00', true),
  block(22, 'tuesday', '08:00', '10:00'),
];

const entry = (id: number, clockIn: string, clockOut: string | null, scheduleBlockId: number | null): TimeEntry => ({
  id,
  schedule_block_id: scheduleBlockId,
  student_assistant_id: 100,
  clock_in: clockIn,
  clock_out: clockOut,
  created_at: clockIn,
});

const timeEntries = [
  entry(1, '2026-09-14T15:00:00Z', '2026-09-14T19:00:00Z', 20), // Mon, matches 4h
  entry(2, '2026-09-01T15:00:00Z', '2026-09-01T16:30:00Z', 22), // Tue, 1.5h of 2h
  entry(3, '2026-09-10T16:00:00Z', '2026-09-10T17:00:00Z', null), // Thu, nothing scheduled
  entry(4, '2026-09-11T15:00:00Z', null, null), // Fri, never clocked out
  entry(5, '2026-10-01T15:00:00Z', '2026-10-01T16:00:00Z', null), // next month
];

const timeOff = [
  { student_assistant_id: 100, starts_at: '2026-09-08T07:00:00Z', ends_at: '2026-09-09T07:00:00Z' },
];

const now = new Date('2026-09-16T19:00:00Z'); // Wed Sep 16, noon

function build() {
  const result = buildMonthTimesheets(
    '2026-09',
    { terms: [term], schedules, scheduleBlocks, timeEntries, timeOff },
    { now },
  );
  const sheet = result.get(100)!;
  const status = (date: string) => sheet.days.find((day) => day.date === date)?.status;
  return { sheet, status };
}

describe('buildMonthTimesheets', () => {
  it('judges each past day against the schedule', () => {
    const { status } = build();

    expect(status('2026-09-14')).toBe('ok');
    expect(status('2026-09-01')).toBe('off');
    expect(status('2026-09-08')).toBe('excused');
    expect(status('2026-09-15')).toBe('absent');
    expect(status('2026-09-10')).toBe('unscheduled');
    expect(status('2026-09-11')).toBe('open');
    expect(status('2026-09-02')).toBe('remote');
    expect(status('2026-09-21')).toBe('upcoming');
  });

  it('skips campus vacation days and entries from other months', () => {
    const { sheet } = build();

    expect(sheet.days.some((day) => day.date === '2026-09-07')).toBe(false);
    expect(sheet.days.every((day) => day.date.startsWith('2026-09'))).toBe(true);
  });

  it('totals worked hours, and scheduled hours only for days already judged', () => {
    const { sheet } = build();

    expect(sheet.workedHours).toBe(6.5);
    // Sep 1, 14, 15 in person; Sep 8 excused; Sep 21+ not judged yet.
    expect(sheet.scheduledHours).toBe(8);
    expect(sheet.excusedHours).toBe(2);
    expect(sheet.excusedDays).toBe(1);
    expect(sheet.remoteHours).toBe(6);
    expect(sheet.issues).toEqual({ absent: 1, open: 1, off: 1, unscheduled: 1 });
    expect(sheet.issueCount).toBe(4);
  });

  it('keeps blocks and entries on each day', () => {
    const { sheet } = build();
    const monday = sheet.days.find((day) => day.date === '2026-09-14')!;

    expect(monday.blocks).toEqual([
      { scheduleBlockId: 20, startTime: '08:00', endTime: '12:00', isRemote: false, excused: false, hours: 4 },
    ]);
    expect(monday.entries).toEqual([
      { id: 1, scheduleBlockId: 20, clockIn: '2026-09-14T15:00:00Z', clockOut: '2026-09-14T19:00:00Z', hours: 4 },
    ]);
  });

  it('only builds the requested student when filtered', () => {
    const result = buildMonthTimesheets(
      '2026-09',
      { terms: [term], schedules, scheduleBlocks, timeEntries, timeOff },
      { now, studentAssistantId: 999 },
    );

    expect(result.size).toBe(0);
  });
});

describe('month helpers', () => {
  it('validates and bounds months', () => {
    expect(isValidMonth('2026-09')).toBe(true);
    expect(isValidMonth('2026-13')).toBe(false);
    expect(isValidMonth('2026-9')).toBe(false);
    expect(monthBounds('2026-02')).toEqual({ start: '2026-02-01', end: '2026-02-28' });
  });
});

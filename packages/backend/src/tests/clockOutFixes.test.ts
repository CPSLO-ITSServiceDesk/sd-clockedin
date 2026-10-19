import { describe, expect, it } from 'vitest';
import { findClockOutFixes } from '../lib/clockOutFixes';
import { getOrgLocalInstant } from '../lib/orgTime';
import type { Database } from '../types/database.types';

type Term = Database['public']['Tables']['academic_term']['Row'];
type Schedule = Database['public']['Tables']['schedules']['Row'];
type ScheduleBlock = Database['public']['Tables']['schedule_blocks']['Row'];
type TimeEntry = Database['public']['Tables']['time_entry']['Row'];
type StudentAssistant = Database['public']['Tables']['student_assistant']['Row'];

const term: Term = {
  id: 1,
  name: 'Fall 2026',
  start_date: '2026-09-21',
  end_date: '2026-12-11',
  is_active: true,
  remote_shifts_allowed: false,
  off_days: null,
  created_at: '2026-09-01T00:00:00Z',
};

const schedules: Schedule[] = [
  { id: 10, academic_term_id: 1, student_assistant_id: 100, start_date: null, end_date: null, created_at: '2026-09-01T00:00:00Z' },
];

// Mondays 9:00–12:00
const scheduleBlocks: ScheduleBlock[] = [
  { id: 20, schedule_id: 10, days: 'monday', start_time: '09:00:00', end_time: '12:00:00', is_remote: false, created_at: '2026-09-01T00:00:00Z' },
];

const students: StudentAssistant[] = [
  {
    id: 100, first_name: 'Sam', last_name: 'Reed', work_email: null, position: 'student_assistant',
    is_active: true, polycard_id: null, entra_user_id: null, created_at: '2026-09-01T00:00:00Z',
  },
];

const at = (date: string, hour: number, minute = 0) => getOrgLocalInstant(date, hour, minute).toISOString();
const MONDAY = '2026-10-12';
const NOW = getOrgLocalInstant('2026-10-19', 10, 0);

let nextId = 1;
const entry = (clockIn: string, clockOut: string | null, blockId: number | null = 20): TimeEntry => ({
  id: nextId++,
  student_assistant_id: 100,
  schedule_block_id: blockId,
  clock_in: clockIn,
  clock_out: clockOut,
  created_at: clockIn,
});

const run = (timeEntries: TimeEntry[], autoClockOutMinutes: number | null = 17 * 60) =>
  findClockOutFixes({ term, schedules, scheduleBlocks, timeEntries, students, now: NOW, autoClockOutMinutes });

describe('findClockOutFixes', () => {
  it('flags each kind of odd clock-out and proposes the scheduled end', () => {
    const entries = [
      entry(at(MONDAY, 9), null),
      entry(at(MONDAY, 9), at(MONDAY, 17)),
      entry(at(MONDAY, 9), at('2026-10-13', 17)),
      entry(at(MONDAY, 9), at(MONDAY, 14, 5)),
      entry(at(MONDAY, 9), at(MONDAY, 8)),
    ];
    const fixes = run(entries);

    expect(fixes.map((fix) => fix.issue)).toEqual(['missing', 'auto_clock_out', 'next_day', 'long_after_end', 'before_clock_in']);
    for (const fix of fixes) expect(fix.proposedClockOut).toBe(at(MONDAY, 12));
    expect(fixes[0]).toMatchObject({ studentName: 'Sam Reed', date: MONDAY, scheduleBlockId: 20 });
  });

  it('leaves normal clock-outs, shifts still running today and unlinked entries alone', () => {
    const today = '2026-10-19';
    const fixes = run([
      entry(at(MONDAY, 9), at(MONDAY, 12, 20)),
      entry(at(MONDAY, 9), at(MONDAY, 11)),
      entry(at(today, 9), null),
      entry(at(MONDAY, 9), null, null),
    ]);
    expect(fixes).toEqual([]);
  });

  it("flags today's open entry once the shift ended more than 30 minutes ago", () => {
    const today = '2026-10-19';
    const open = entry(at(today, 9), null);
    const check = (hour: number, minute: number) =>
      findClockOutFixes({
        term, schedules, scheduleBlocks, timeEntries: [open], students,
        now: getOrgLocalInstant(today, hour, minute), autoClockOutMinutes: 17 * 60,
      });

    expect(check(12, 20)).toEqual([]);
    const [fix] = check(15, 0);
    expect(fix).toMatchObject({ issue: 'still_open', proposedClockOut: at(today, 12) });
  });

  it('only treats the auto clock-out time as odd when auto clock-out is on', () => {
    const late = entry(at(MONDAY, 9), at(MONDAY, 17));
    expect(run([late])[0].issue).toBe('auto_clock_out');
    // Still well past the shift end, so it's flagged either way.
    expect(run([late], null)[0].issue).toBe('long_after_end');
  });

  it("skips entries that clocked in after the shift ended", () => {
    expect(run([entry(at(MONDAY, 12, 30), null)])).toEqual([]);
  });
});

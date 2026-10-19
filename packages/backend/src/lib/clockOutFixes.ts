import { getOrgLocalDateString, getOrgLocalInstant, getOrgLocalMinutes } from './orgTime';
import { getClockInDate } from './shiftStatus';
import { timeToMinutes } from './time';
import type { Database } from '../types/database.types';

type ScheduleBlock = Database['public']['Tables']['schedule_blocks']['Row'];
type Schedule = Database['public']['Tables']['schedules']['Row'];
type TimeEntry = Database['public']['Tables']['time_entry']['Row'];
type Term = Database['public']['Tables']['academic_term']['Row'];
type StudentAssistant = Database['public']['Tables']['student_assistant']['Row'];

/** Clocked out this long after the shift ended counts as a forgotten clock-out. */
export const LATE_CLOCK_OUT_GRACE_MINUTES = 30;

export type ClockOutIssue =
  /** Still clocked in from a past day. */
  | 'missing'
  /** Still clocked in today, well after the shift ended. */
  | 'still_open'
  /** Closed by the auto clock-out job, after the shift had already ended. */
  | 'auto_clock_out'
  /** Clocked out on a later day than they clocked in. */
  | 'next_day'
  /** Clocked out well after the shift ended. */
  | 'long_after_end'
  /** Clock-out is before the clock-in. */
  | 'before_clock_in';

export interface ClockOutFix {
  timeEntryId: number;
  studentAssistantId: number;
  studentName: string;
  date: string;
  clockIn: string;
  clockOut: string | null;
  scheduleBlockId: number;
  blockStartTime: string;
  blockEndTime: string;
  /** Scheduled end of the shift on the clock-in date, as an ISO instant. */
  proposedClockOut: string;
  issue: ClockOutIssue;
}

export interface ClockOutFixInput {
  term: Term;
  schedules: Schedule[];
  scheduleBlocks: ScheduleBlock[];
  timeEntries: TimeEntry[];
  students: StudentAssistant[];
  now?: Date;
  /** Org-local minutes the auto clock-out job runs at, or null when it's disabled. */
  autoClockOutMinutes: number | null;
}

function studentName(student: StudentAssistant | undefined, id: number): string {
  const name = [student?.first_name, student?.last_name].filter(Boolean).join(' ');
  return name || `Student #${id}`;
}

function detectIssue(
  entry: TimeEntry,
  date: string,
  now: Date,
  blockEndMinutes: number,
  autoClockOutMinutes: number | null,
): ClockOutIssue | null {
  if (!entry.clock_out) {
    if (date < getOrgLocalDateString(now)) return 'missing';
    return getOrgLocalMinutes(now) > blockEndMinutes + LATE_CLOCK_OUT_GRACE_MINUTES ? 'still_open' : null;
  }

  const clockIn = new Date(entry.clock_in!);
  const clockOut = new Date(entry.clock_out);
  if (Number.isNaN(clockOut.getTime())) return null;
  if (clockOut < clockIn) return 'before_clock_in';
  if (getOrgLocalDateString(clockOut) !== date) return 'next_day';

  const outMinutes = getOrgLocalMinutes(clockOut);
  if (
    autoClockOutMinutes != null &&
    Math.abs(outMinutes - autoClockOutMinutes) <= 1 &&
    blockEndMinutes < outMinutes
  ) {
    return 'auto_clock_out';
  }
  if (outMinutes > blockEndMinutes + LATE_CLOCK_OUT_GRACE_MINUTES) return 'long_after_end';
  return null;
}

/**
 * Time entries linked to a shift whose clock-out looks wrong, with the
 * shift's scheduled end on that day as the suggested clock-out.
 */
export function findClockOutFixes({
  term,
  schedules,
  scheduleBlocks,
  timeEntries,
  students,
  now = new Date(),
  autoClockOutMinutes,
}: ClockOutFixInput): ClockOutFix[] {
  if (!term.start_date || !term.end_date) return [];

  const today = getOrgLocalDateString(now);
  const termScheduleIds = new Set(
    schedules.filter((schedule) => schedule.academic_term_id === term.id).map((schedule) => schedule.id),
  );
  const blockById = new Map(
    scheduleBlocks
      .filter((block) => block.schedule_id != null && termScheduleIds.has(block.schedule_id))
      .map((block) => [block.id, block]),
  );
  const studentById = new Map(students.map((student) => [student.id, student]));

  const fixes: ClockOutFix[] = [];
  for (const entry of timeEntries) {
    if (entry.schedule_block_id == null || entry.student_assistant_id == null || !entry.clock_in) continue;
    const block = blockById.get(entry.schedule_block_id);
    if (!block?.start_time || !block.end_time) continue;

    const date = getClockInDate(entry.clock_in);
    if (!date || date < term.start_date || date > term.end_date || date > today) continue;

    const blockEndMinutes = timeToMinutes(block.end_time);
    const proposed = getOrgLocalInstant(date, Math.floor(blockEndMinutes / 60), blockEndMinutes % 60);
    // Clocked in after the shift ended: the scheduled end can't be the answer.
    if (proposed <= new Date(entry.clock_in)) continue;

    const issue = detectIssue(entry, date, now, blockEndMinutes, autoClockOutMinutes);
    if (!issue) continue;

    fixes.push({
      timeEntryId: entry.id,
      studentAssistantId: entry.student_assistant_id,
      studentName: studentName(studentById.get(entry.student_assistant_id), entry.student_assistant_id),
      date,
      clockIn: entry.clock_in,
      clockOut: entry.clock_out,
      scheduleBlockId: block.id,
      blockStartTime: block.start_time,
      blockEndTime: block.end_time,
      proposedClockOut: proposed.toISOString(),
      issue,
    });
  }

  return fixes.sort((a, b) => a.date.localeCompare(b.date) || a.studentName.localeCompare(b.studentName));
}

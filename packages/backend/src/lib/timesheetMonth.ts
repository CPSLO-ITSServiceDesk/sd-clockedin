import type { Database } from '../types/database.types';
import { getOrgLocalDateString } from './orgTime';
import { getEffectiveScheduleDateRange } from './scheduleDateRange';
import { getClockInDate } from './shiftStatus';
import { normalizeTimeKey, timeToMinutes } from './time';
import {
  isTimeOffCoveringOrgLocalDate,
  isVacationDay,
  parseOffDays,
  type TimeOffInterval,
} from './timeOffCoverage';

type ScheduleBlock = Database['public']['Tables']['schedule_blocks']['Row'];
type Schedule = Database['public']['Tables']['schedules']['Row'];
type TimeEntry = Database['public']['Tables']['time_entry']['Row'];
type Term = Database['public']['Tables']['academic_term']['Row'];

/** Worked and scheduled hours closer than this count as matching. */
export const TIMESHEET_MATCH_TOLERANCE_HOURS = 0.25;

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * - ok / off: worked hours match (or don't match) the in-person schedule
 * - absent: scheduled in person, no time entries
 * - open: an entry from a past day was never clocked out
 * - excused: every scheduled block is covered by Teams time off
 * - remote: only remote blocks, which don't need a clock-in
 * - unscheduled: worked with nothing scheduled
 * - upcoming / in-progress: today or later, not yet judged
 */
export type TimesheetDayStatus =
  | 'ok'
  | 'off'
  | 'absent'
  | 'open'
  | 'excused'
  | 'remote'
  | 'unscheduled'
  | 'upcoming'
  | 'in-progress';

const ISSUE_STATUSES: ReadonlySet<TimesheetDayStatus> = new Set([
  'off',
  'absent',
  'open',
  'unscheduled',
]);

export interface TimesheetBlock {
  scheduleBlockId: number;
  startTime: string;
  endTime: string;
  isRemote: boolean;
  excused: boolean;
  hours: number;
}

export interface TimesheetEntry {
  id: number;
  scheduleBlockId: number | null;
  clockIn: string;
  clockOut: string | null;
  /** Null while the entry is still open. */
  hours: number | null;
}

export interface TimesheetDay {
  date: string;
  status: TimesheetDayStatus;
  blocks: TimesheetBlock[];
  entries: TimesheetEntry[];
  workedHours: number;
  /** In-person hours that were expected; excused and remote blocks are left out. */
  scheduledHours: number;
  excusedHours: number;
  remoteHours: number;
}

export interface TimesheetIssueCounts {
  absent: number;
  open: number;
  off: number;
  unscheduled: number;
}

export interface StudentMonthSummary {
  studentAssistantId: number;
  workedHours: number;
  scheduledHours: number;
  excusedHours: number;
  remoteHours: number;
  excusedDays: number;
  issues: TimesheetIssueCounts;
  issueCount: number;
}

export interface StudentMonthTimesheet extends StudentMonthSummary {
  days: TimesheetDay[];
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function blockHours(start: string, end: string): number {
  const minutes = timeToMinutes(end) - timeToMinutes(start);
  return Number.isNaN(minutes) || minutes <= 0 ? 0 : minutes / 60;
}

/** "YYYY-MM" → inclusive first and last calendar dates. */
export function monthBounds(month: string): { start: string; end: string } {
  const [year, monthIndex] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
  return { start: `${month}-01`, end: `${month}-${String(lastDay).padStart(2, '0')}` };
}

export function isValidMonth(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

function* datesBetween(start: string, end: string): Generator<string> {
  const [y, m, d] = start.split('-').map(Number);
  const cursor = new Date(Date.UTC(y, m - 1, d));
  for (;;) {
    const date = cursor.toISOString().slice(0, 10);
    if (date > end) return;
    yield date;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
}

function weekdayOf(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

function judgeDay(day: Omit<TimesheetDay, 'status'>, today: string): TimesheetDayStatus {
  const hasOpenEntry = day.entries.some((entry) => entry.clockOut == null);

  if (day.date > today) return 'upcoming';
  if (hasOpenEntry) return day.date === today ? 'in-progress' : 'open';

  if (day.scheduledHours === 0) {
    if (day.entries.length > 0) return 'unscheduled';
    return day.excusedHours > 0 ? 'excused' : 'remote';
  }

  if (day.entries.length === 0) return day.date === today ? 'upcoming' : 'absent';
  if (day.date === today && day.workedHours < day.scheduledHours) return 'in-progress';

  return Math.abs(day.workedHours - day.scheduledHours) >= TIMESHEET_MATCH_TOLERANCE_HOURS
    ? 'off'
    : 'ok';
}

function summarize(studentAssistantId: number, days: TimesheetDay[]): StudentMonthTimesheet {
  // Expected hours only count once a day can be judged; worked hours always count.
  const judged = days.filter((day) => day.status !== 'upcoming' && day.status !== 'in-progress');
  const sum = (list: TimesheetDay[], pick: (day: TimesheetDay) => number) =>
    round2(list.reduce((total, day) => total + pick(day), 0));
  const count = (status: TimesheetDayStatus) => days.filter((day) => day.status === status).length;
  const issues = {
    absent: count('absent'),
    open: count('open'),
    off: count('off'),
    unscheduled: count('unscheduled'),
  };

  return {
    studentAssistantId,
    days,
    workedHours: sum(days, (day) => day.workedHours),
    scheduledHours: sum(judged, (day) => day.scheduledHours),
    excusedHours: sum(judged, (day) => day.excusedHours),
    remoteHours: sum(judged, (day) => day.remoteHours),
    excusedDays: count('excused'),
    issues,
    issueCount: days.filter((day) => ISSUE_STATUSES.has(day.status)).length,
  };
}

/**
 * Per-student, per-day comparison of worked hours (closed time entries, by
 * org-local clock-in date) with scheduled blocks for one calendar month.
 * Campus vacation days are skipped; Teams time off marks a day's blocks excused.
 */
export function buildMonthTimesheets(
  month: string,
  data: {
    terms: Term[];
    schedules: Schedule[];
    scheduleBlocks: ScheduleBlock[];
    timeEntries: TimeEntry[];
    timeOff: TimeOffInterval[];
  },
  options: { studentAssistantId?: number; now?: Date } = {},
): Map<number, StudentMonthTimesheet> {
  const { start, end } = monthBounds(month);
  const today = getOrgLocalDateString(options.now ?? new Date());
  const wanted = (id: number | null | undefined): id is number =>
    id != null && (options.studentAssistantId == null || id === options.studentAssistantId);

  const days = new Map<number, Map<string, Omit<TimesheetDay, 'status'>>>();
  const dayFor = (studentId: number, date: string) => {
    let byDate = days.get(studentId);
    if (!byDate) {
      byDate = new Map();
      days.set(studentId, byDate);
    }
    let day = byDate.get(date);
    if (!day) {
      day = { date, blocks: [], entries: [], workedHours: 0, scheduledHours: 0, excusedHours: 0, remoteHours: 0 };
      byDate.set(date, day);
    }
    return day;
  };

  const termById = new Map(data.terms.map((term) => [term.id, term]));
  const blocksBySchedule = new Map<number, ScheduleBlock[]>();
  for (const block of data.scheduleBlocks) {
    if (block.schedule_id == null) continue;
    const list = blocksBySchedule.get(block.schedule_id) ?? [];
    list.push(block);
    blocksBySchedule.set(block.schedule_id, list);
  }

  for (const schedule of data.schedules) {
    if (!wanted(schedule.student_assistant_id)) continue;
    const term = schedule.academic_term_id != null ? termById.get(schedule.academic_term_id) : undefined;
    if (!term) continue;
    const range = getEffectiveScheduleDateRange(schedule, term);
    if (!range) continue;

    const offDays = parseOffDays(term);
    const from = range.startDate > start ? range.startDate : start;
    const to = range.endDate < end ? range.endDate : end;

    for (const date of datesBetween(from, to)) {
      if (isVacationDay(date, offDays)) continue;
      const weekday = weekdayOf(date);
      const excused = isTimeOffCoveringOrgLocalDate(data.timeOff, schedule.student_assistant_id, date);

      for (const block of blocksBySchedule.get(schedule.id) ?? []) {
        if (block.days !== weekday || !block.start_time || !block.end_time) continue;
        const hours = blockHours(block.start_time, block.end_time);
        const day = dayFor(schedule.student_assistant_id, date);
        day.blocks.push({
          scheduleBlockId: block.id,
          startTime: normalizeTimeKey(block.start_time),
          endTime: normalizeTimeKey(block.end_time),
          isRemote: block.is_remote,
          excused,
          hours,
        });
        if (block.is_remote) day.remoteHours += hours;
        else if (excused) day.excusedHours += hours;
        else day.scheduledHours += hours;
      }
    }
  }

  for (const entry of data.timeEntries) {
    if (!wanted(entry.student_assistant_id) || !entry.clock_in) continue;
    const date = getClockInDate(entry.clock_in);
    if (!date || date < start || date > end) continue;

    const clockInMs = Date.parse(entry.clock_in);
    const clockOutMs = entry.clock_out ? Date.parse(entry.clock_out) : Number.NaN;
    const hours = Number.isNaN(clockOutMs) ? null : Math.max(0, (clockOutMs - clockInMs) / 3_600_000);

    const day = dayFor(entry.student_assistant_id, date);
    day.entries.push({
      id: entry.id,
      scheduleBlockId: entry.schedule_block_id,
      clockIn: entry.clock_in,
      clockOut: entry.clock_out,
      hours: hours == null ? null : round2(hours),
    });
    if (hours != null) day.workedHours += hours;
  }

  const result = new Map<number, StudentMonthTimesheet>();
  for (const [studentId, byDate] of days) {
    const studentDays = Array.from(byDate.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((day) => {
        day.blocks.sort((a, b) => a.startTime.localeCompare(b.startTime));
        day.entries.sort((a, b) => a.clockIn.localeCompare(b.clockIn));
        const rounded = {
          ...day,
          workedHours: round2(day.workedHours),
          scheduledHours: round2(day.scheduledHours),
          excusedHours: round2(day.excusedHours),
          remoteHours: round2(day.remoteHours),
        };
        return { ...rounded, status: judgeDay(rounded, today) };
      });
    result.set(studentId, summarize(studentId, studentDays));
  }

  return result;
}

export function emptyMonthTimesheet(studentAssistantId: number): StudentMonthTimesheet {
  return summarize(studentAssistantId, []);
}

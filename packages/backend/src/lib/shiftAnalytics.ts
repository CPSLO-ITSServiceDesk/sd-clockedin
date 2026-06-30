import { getEffectiveScheduleDateRange } from './scheduleDateRange';
import type { Database } from '../types/database.types';
import { normalizeTimeKey } from './time';
import {
  computeHistoricalShiftStatus,
  getClockInDate,
  toLocalDateString,
  type EvaluatableShiftStatus,
} from './shiftStatus';

type ScheduleBlockDay = Database['public']['Enums']['days'];
type ScheduleBlock = Database['public']['Tables']['schedule_blocks']['Row'];
type Schedule = Database['public']['Tables']['schedules']['Row'];
type TimeEntry = Database['public']['Tables']['time_entry']['Row'];
type Term = Database['public']['Tables']['academic_term']['Row'];

const WEEKDAY_DAYS: ScheduleBlockDay[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
];

type TermOffDays = {
  vacations?: { date: string }[];
  special_schedules?: { date: string; swap_to_day: string }[];
};

export interface TimelinessSummary {
  totalEvaluated: number;
  onTime: number;
  early: number;
  late: number;
  absent: number;
  onTimeRate: number;
  punctualityRate: number;
  avgMinutesLate: number;
}

export interface LateByTimeSlot {
  startTime: string;
  lateCount: number;
  totalShifts: number;
  lateRate: number;
}

export interface DailyTrendPoint {
  date: string;
  /** Shifts with on-time or early status (within punctuality window). */
  punctual: number;
  late: number;
  absent: number;
}

export interface StudentLateShift {
  date: string;
  startTime: string;
  endTime: string;
  clockIn: string | null;
  minutesLate: number;
  status: 'late' | 'absent';
}

export interface EvaluatedShift {
  date: string;
  studentAssistantId: number;
  scheduleBlockId: number;
  day: ScheduleBlockDay;
  startTime: string;
  endTime: string;
  clockIn: string | null;
  status: EvaluatableShiftStatus;
  minutesLate: number;
}

export interface TermAnalyticsResult {
  summary: TimelinessSummary;
  dailyTrend: DailyTrendPoint[];
  lateByTimeSlot: LateByTimeSlot[];
  weekdayPatterns: WeekdayPattern[];
  lateLeaderboard: StudentLeaderboardEntry[];
}

export interface WeekdayPattern {
  day: string;
  late: number;
  absent: number;
  total: number;
}

export interface StudentLeaderboardEntry {
  studentAssistantId: number;
  late: number;
  absent: number;
  total: number;
}

export interface StudentAnalyticsResult {
  summary: TimelinessSummary;
  lateByTimeSlot: LateByTimeSlot[];
  weekdayPatterns: WeekdayPattern[];
  dailyTrend: DailyTrendPoint[];
  recentIssues: StudentLateShift[];
}

function parseOffDays(term: Term): TermOffDays | null {
  if (!term.off_days || typeof term.off_days !== 'object' || Array.isArray(term.off_days)) {
    return null;
  }
  return term.off_days as TermOffDays;
}

function isVacationDay(date: string, offDays: TermOffDays | null): boolean {
  return offDays?.vacations?.some((vacation) => vacation.date === date) ?? false;
}

function getWeekdayForDate(dateStr: string): ScheduleBlockDay | null {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const weekday = date.getDay();
  if (weekday === 0 || weekday === 6) return null;
  return WEEKDAY_DAYS[weekday - 1];
}

function* iterateDates(startDate: string, endDate: string): Generator<string> {
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
  const current = new Date(startYear, startMonth - 1, startDay);
  const end = new Date(endYear, endMonth - 1, endDay);

  while (current <= end) {
    yield toLocalDateString(current);
    current.setDate(current.getDate() + 1);
  }
}

function getEntryDate(entry: TimeEntry): string | null {
  const fromClockIn = getClockInDate(entry.clock_in);
  if (fromClockIn) return fromClockIn;

  if (entry.created_at?.includes('T')) {
    return toLocalDateString(new Date(entry.created_at));
  }

  return entry.created_at?.slice(0, 10) ?? null;
}

function buildTimeEntryMap(timeEntries: TimeEntry[]): Map<string, TimeEntry> {
  const map = new Map<string, TimeEntry>();

  for (const entry of timeEntries) {
    if (entry.schedule_block_id == null || entry.student_assistant_id == null) {
      continue;
    }

    const date = getEntryDate(entry);
    if (!date) continue;

    const key = `${entry.schedule_block_id}-${entry.student_assistant_id}-${date}`;
    map.set(key, entry);
  }

  return map;
}

function emptySummary(): TimelinessSummary {
  return {
    totalEvaluated: 0,
    onTime: 0,
    early: 0,
    late: 0,
    absent: 0,
    onTimeRate: 0,
    punctualityRate: 0,
    avgMinutesLate: 0,
  };
}

function summarizeShifts(shifts: EvaluatedShift[]): TimelinessSummary {
  if (shifts.length === 0) {
    return emptySummary();
  }

  const onTime = shifts.filter((shift) => shift.status === 'on-time').length;
  const early = shifts.filter((shift) => shift.status === 'early').length;
  const late = shifts.filter((shift) => shift.status === 'late').length;
  const absent = shifts.filter((shift) => shift.status === 'absent').length;
  const totalEvaluated = shifts.length;

  const lateShifts = shifts.filter((shift) => shift.status === 'late');
  const avgMinutesLate =
    lateShifts.length > 0
      ? lateShifts.reduce((sum, shift) => sum + shift.minutesLate, 0) / lateShifts.length
      : 0;

  return {
    totalEvaluated,
    onTime,
    early,
    late,
    absent,
    onTimeRate: onTime / totalEvaluated,
    punctualityRate: (onTime + early) / totalEvaluated,
    avgMinutesLate: Math.round(avgMinutesLate * 10) / 10,
  };
}

function aggregateLateByTimeSlot(shifts: EvaluatedShift[]): LateByTimeSlot[] {
  const slotMap = new Map<string, { late: number; total: number }>();

  for (const shift of shifts) {
    const startTime = normalizeTimeKey(shift.startTime);
    const current = slotMap.get(startTime) ?? { late: 0, total: 0 };
    current.total += 1;
    if (shift.status === 'late') {
      current.late += 1;
    }
    slotMap.set(startTime, current);
  }

  return [...slotMap.entries()]
    .map(([startTime, counts]) => ({
      startTime,
      lateCount: counts.late,
      totalShifts: counts.total,
      lateRate: counts.total > 0 ? counts.late / counts.total : 0,
    }))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

const WEEKDAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const;

function aggregateWeekdayPatterns(shifts: EvaluatedShift[]): WeekdayPattern[] {
  const map = new Map<string, { late: number; absent: number; total: number }>(
    WEEKDAY_ORDER.map((day) => [day, { late: 0, absent: 0, total: 0 }]),
  );

  for (const shift of shifts) {
    const current = map.get(shift.day);
    if (!current) continue;
    current.total += 1;
    if (shift.status === 'late') current.late += 1;
    if (shift.status === 'absent') current.absent += 1;
  }

  return WEEKDAY_ORDER.map((day) => ({
    day,
    ...map.get(day)!,
  }));
}

function aggregateLateLeaderboard(shifts: EvaluatedShift[]): StudentLeaderboardEntry[] {
  const map = new Map<number, { late: number; absent: number; total: number }>();

  for (const shift of shifts) {
    const current = map.get(shift.studentAssistantId) ?? { late: 0, absent: 0, total: 0 };
    current.total += 1;
    if (shift.status === 'late') current.late += 1;
    if (shift.status === 'absent') current.absent += 1;
    map.set(shift.studentAssistantId, current);
  }

  return [...map.entries()]
    .map(([studentAssistantId, counts]) => ({
      studentAssistantId,
      ...counts,
    }))
    .sort((a, b) => b.late - a.late || b.absent - a.absent)
    .slice(0, 5);
}

function aggregateDailyTrend(shifts: EvaluatedShift[]): DailyTrendPoint[] {
  const dayMap = new Map<string, DailyTrendPoint>();

  for (const shift of shifts) {
    const current = dayMap.get(shift.date) ?? {
      date: shift.date,
      punctual: 0,
      late: 0,
      absent: 0,
    };

    if (shift.status === 'on-time' || shift.status === 'early') {
      current.punctual += 1;
    } else if (shift.status === 'late') {
      current.late += 1;
    } else if (shift.status === 'absent') {
      current.absent += 1;
    }

    dayMap.set(shift.date, current);
  }

  return [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function expandEvaluatedShifts(
  term: Term,
  schedules: Schedule[],
  scheduleBlocks: ScheduleBlock[],
  timeEntries: TimeEntry[],
  options: {
    studentAssistantId?: number;
    now?: Date;
  } = {},
): EvaluatedShift[] {
  if (!term.start_date || !term.end_date) {
    return [];
  }

  const now = options.now ?? new Date();
  const today = toLocalDateString(now);
  const offDays = parseOffDays(term);
  const termSchedules = schedules.filter(
    (schedule) => schedule.academic_term_id === term.id,
  );

  if (termSchedules.length === 0) {
    return [];
  }

  const scheduleMap = new Map(termSchedules.map((schedule) => [schedule.id, schedule]));
  const inPersonBlocks = scheduleBlocks.filter((block) => {
    if (block.is_remote || block.schedule_id == null) return false;
    return scheduleMap.has(block.schedule_id);
  });

  const timeEntryMap = buildTimeEntryMap(timeEntries);
  const evaluated: EvaluatedShift[] = [];

  for (const block of inPersonBlocks) {
    if (!block.days || !block.start_time || !block.end_time || block.schedule_id == null) {
      continue;
    }

    const schedule = scheduleMap.get(block.schedule_id);
    if (!schedule?.student_assistant_id) continue;

    if (
      options.studentAssistantId != null &&
      schedule.student_assistant_id !== options.studentAssistantId
    ) {
      continue;
    }

    const range = getEffectiveScheduleDateRange(schedule, term);
    if (!range) continue;

    for (const date of iterateDates(range.startDate, range.endDate)) {
      if (date > today) continue;
      if (isVacationDay(date, offDays)) continue;

      const weekday = getWeekdayForDate(date);
      if (weekday !== block.days) continue;

      const entryKey = `${block.id}-${schedule.student_assistant_id}-${date}`;
      const entry = timeEntryMap.get(entryKey) ?? null;
      const clockIn = entry?.clock_in ?? null;
      const result = computeHistoricalShiftStatus(
        block.start_time,
        clockIn,
        date,
        now,
      );

      if (
        result.status === 'skipped' ||
        result.status === 'incoming' ||
        result.status === 'expected'
      ) {
        continue;
      }

      evaluated.push({
        date,
        studentAssistantId: schedule.student_assistant_id,
        scheduleBlockId: block.id,
        day: block.days,
        startTime: normalizeTimeKey(block.start_time),
        endTime: normalizeTimeKey(block.end_time),
        clockIn,
        status: result.status,
        minutesLate: result.minutesLate,
      });
    }
  }

  return evaluated;
}

export function buildTermAnalytics(
  term: Term,
  schedules: Schedule[],
  scheduleBlocks: ScheduleBlock[],
  timeEntries: TimeEntry[],
  now: Date = new Date(),
): TermAnalyticsResult {
  const shifts = expandEvaluatedShifts(term, schedules, scheduleBlocks, timeEntries, { now });

  return {
    summary: summarizeShifts(shifts),
    dailyTrend: aggregateDailyTrend(shifts),
    lateByTimeSlot: aggregateLateByTimeSlot(shifts),
    weekdayPatterns: aggregateWeekdayPatterns(shifts),
    lateLeaderboard: aggregateLateLeaderboard(shifts),
  };
}

export function buildStudentAnalytics(
  term: Term,
  studentAssistantId: number,
  schedules: Schedule[],
  scheduleBlocks: ScheduleBlock[],
  timeEntries: TimeEntry[],
  now: Date = new Date(),
): StudentAnalyticsResult {
  const shifts = expandEvaluatedShifts(term, schedules, scheduleBlocks, timeEntries, {
    studentAssistantId,
    now,
  });

  const recentIssues = shifts
    .filter((shift) => shift.status === 'late' || shift.status === 'absent')
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 20)
    .map((shift) => ({
      date: shift.date,
      startTime: shift.startTime,
      endTime: shift.endTime,
      clockIn: shift.clockIn,
      minutesLate: shift.minutesLate,
      status: shift.status as 'late' | 'absent',
    }));

  return {
    summary: summarizeShifts(shifts),
    lateByTimeSlot: aggregateLateByTimeSlot(shifts),
    weekdayPatterns: aggregateWeekdayPatterns(shifts),
    dailyTrend: aggregateDailyTrend(shifts),
    recentIssues,
  };
}

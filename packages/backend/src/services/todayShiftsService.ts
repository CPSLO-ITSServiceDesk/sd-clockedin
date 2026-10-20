import { withTodayShiftsCache } from '../lib/todayShiftsCache';
import { isDateInEffectiveScheduleRange } from '../lib/scheduleDateRange';
import { formatStudentRole } from '../lib/formatStudentRole';
import { getOrgDayOfWeek, getOrgLocalInstant } from '../lib/orgTime';
import { timeToMinutes } from '../lib/time';
import {
  isCampusVacationOnDate,
  isTimeOffCoveringInstant,
  timeOffForShift,
  timeOffPiecesForShift,
  type TimeOffInterval,
} from '../lib/timeOffCoverage';
import { computeRemoteShiftStatus, computeShiftStatus, getClockInDate, type ShiftStatus, toLocalDateString } from '../lib/shiftStatus';
import type { Database } from '../types/database.types';
import { scheduleBlocksService } from './scheduleBlocksService';
import { schedulesService } from './schedulesService';
import { studentAssistantService } from './studentAssistantService';
import { studentTimeOffService } from './studentTimeOffService';
import { termService } from './termService';
import { timeEntryService } from './timeEntryService';

type ScheduleBlockDay = Database['public']['Enums']['days'];
type Schedule = Database['public']['Tables']['schedules']['Row'];
type ScheduleBlock = Database['public']['Tables']['schedule_blocks']['Row'];
type Term = Database['public']['Tables']['academic_term']['Row'];

export interface TodayShift {
  scheduleBlockId: number | null;
  studentAssistantId: number;
  firstName: string;
  lastName: string;
  role: string;
  startTime: string;
  endTime: string;
  clockInActual: string | null;
  clockOutActual: string | null;
  timeEntryId: number | null;
  status: ShiftStatus;
  isRemote: boolean;
}

/** A scheduled block omitted from `shifts` because time off covers the whole shift, or covers it now. */
export interface TodayTimeOffShift {
  scheduleBlockId: number;
  studentAssistantId: number;
  firstName: string;
  lastName: string;
  role: string;
  startTime: string;
  endTime: string;
  isRemote: boolean;
  timeOffStartsAt: string;
  timeOffEndsAt: string;
  timeOffReason: string | null;
}

export interface UpcomingTimeOff {
  studentAssistantId: number;
  firstName: string;
  lastName: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
}

export interface TodayShiftsResult {
  shifts: TodayShift[];
  remoteOnlyStudentIds: number[];
  timeOffShifts: TodayTimeOffShift[];
  /** The time-off part of shifts still in `shifts` (trimmed); `startTime`/`endTime` are the hours off. */
  partialTimeOff: TodayTimeOffShift[];
  upcomingTimeOff: UpcomingTimeOff[];
  /** Every time off overlapping today (past, current or later), soonest first. */
  todayTimeOff: UpcomingTimeOff[];
}

type TodayTimeOffInterval = TimeOffInterval & { time_off_reason?: string | null };

export interface AssembleTodayShiftsInput {
  now: Date;
  todayDate: string;
  includeRemote: boolean;
  schedules: Schedule[];
  scheduleBlocks: ScheduleBlock[];
  studentAssistants: StudentAssistant[];
  timeEntries: TimeEntry[];
  terms: Term[];
  studentTimeOff: TodayTimeOffInterval[];
}

/** How far ahead `upcomingTimeOff` looks from `now`. */
export const UPCOMING_TIME_OFF_WINDOW_DAYS = 14;

const WEEKDAY_DAYS: ScheduleBlockDay[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
];

export function getTodayDay(now: Date = new Date()): ScheduleBlockDay | null {
  const day = getOrgDayOfWeek(now);
  if (day === 0 || day === 6) return null;
  return WEEKDAY_DAYS[day - 1];
}

export function getTodayDateString(now: Date = new Date()): string {
  return toLocalDateString(now);
}

function resolveBlockStudentId(
  block: Database['public']['Tables']['schedule_blocks']['Row'],
  scheduleMap: Map<number, Database['public']['Tables']['schedules']['Row']>,
): number | null {
  if (block.schedule_id == null) return null;
  return scheduleMap.get(block.schedule_id)?.student_assistant_id ?? null;
}

type StudentAssistant = Database['public']['Tables']['student_assistant']['Row'];
type TimeEntry = Database['public']['Tables']['time_entry']['Row'];

/** Time off for active students overlapping `[fromMs, toMs)`, soonest first. */
function listTimeOff(
  rows: TodayTimeOffInterval[],
  studentAssistantMap: Map<number, StudentAssistant>,
  fromMs: number,
  toMs: number,
): UpcomingTimeOff[] {
  return rows
    .filter((row) => {
      const start = Date.parse(row.starts_at);
      const end = Date.parse(row.ends_at);
      if (Number.isNaN(start) || Number.isNaN(end)) return false;
      return end > fromMs && start < toMs;
    })
    .flatMap((row) => {
      const studentAssistant = studentAssistantMap.get(row.student_assistant_id);
      if (!studentAssistant || studentAssistant.is_active === false) return [];
      return [{
        studentAssistantId: row.student_assistant_id,
        firstName: studentAssistant.first_name ?? '',
        lastName: studentAssistant.last_name ?? '',
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        reason: row.time_off_reason ?? null,
      }];
    })
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.firstName.localeCompare(b.firstName));
}

function buildUpcomingTimeOff(
  rows: TodayTimeOffInterval[],
  studentAssistantMap: Map<number, StudentAssistant>,
  now: Date,
): UpcomingTimeOff[] {
  const nowMs = now.getTime();
  return listTimeOff(rows, studentAssistantMap, nowMs, nowMs + UPCOMING_TIME_OFF_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

/** All of `todayDate` in the org timezone, so time off that already ended today still counts. */
function buildTodayTimeOff(
  rows: TodayTimeOffInterval[],
  studentAssistantMap: Map<number, StudentAssistant>,
  todayDate: string,
): UpcomingTimeOff[] {
  const dayStart = getOrgLocalInstant(todayDate, 0, 0).getTime();
  const [y, m, d] = todayDate.split('-').map(Number);
  const nextDate = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  return listTimeOff(rows, studentAssistantMap, dayStart, getOrgLocalInstant(nextDate, 0, 0).getTime());
}

type BlockTimeOff =
  /** Campus vacation: the block doesn't run and isn't listed. */
  | { kind: 'vacation' }
  /** Time off covers the whole shift, or covers it right now. */
  | { kind: 'off'; timeOff: TodayTimeOffInterval }
  /** Works the shift; `startTime`/`endTime` are trimmed around any partial time off. */
  | { kind: 'work'; startTime: string; endTime: string };

function minutesToTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/**
 * Time off is matched against the shift's own hours on `todayDate`, not just
 * the current instant, so a shift fully covered by time off is shown as time
 * off all day and a partly covered one is trimmed (8–11 with 10–11 off is
 * expected 8–10; with 8–9 off it's expected from 9, so it isn't marked late).
 */
function resolveBlockTimeOff(
  block: ScheduleBlock,
  studentAssistantId: number,
  todayDate: string,
  now: Date,
  term: Term | undefined,
  studentTimeOff: TodayTimeOffInterval[],
): BlockTimeOff {
  if (isCampusVacationOnDate(term, todayDate)) return { kind: 'vacation' };

  const startTime = block.start_time ?? '00:00';
  const endTime = block.end_time ?? '00:00';
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  if (Number.isNaN(startMinutes) || Number.isNaN(endMinutes) || endMinutes <= startMinutes) {
    return { kind: 'work', startTime, endTime };
  }

  const { timeOff, remaining } = timeOffForShift(
    studentTimeOff,
    studentAssistantId,
    todayDate,
    startMinutes,
    endMinutes,
  );
  if (!timeOff) return { kind: 'work', startTime, endTime };
  if (!remaining || isTimeOffCoveringInstant([timeOff], studentAssistantId, now)) {
    return { kind: 'off', timeOff };
  }
  return {
    kind: 'work',
    startTime: remaining[0] === startMinutes ? startTime : minutesToTime(remaining[0]),
    endTime: remaining[1] === endMinutes ? endTime : minutesToTime(remaining[1]),
  };
}

function buildUnscheduledShifts(
  todaysTimeEntries: TimeEntry[],
  studentAssistantMap: Map<number, StudentAssistant>,
): TodayShift[] {
  const unscheduledShifts: TodayShift[] = [];

  for (const entry of todaysTimeEntries) {
    if (
      entry.schedule_block_id != null ||
      entry.clock_out != null ||
      entry.student_assistant_id == null
    ) {
      continue;
    }

    const studentAssistant = studentAssistantMap.get(entry.student_assistant_id);
    if (!studentAssistant || studentAssistant.is_active === false) continue;

    unscheduledShifts.push({
      scheduleBlockId: null,
      studentAssistantId: entry.student_assistant_id,
      firstName: studentAssistant.first_name ?? '',
      lastName: studentAssistant.last_name ?? '',
      role: formatStudentRole(studentAssistant.position),
      startTime: '',
      endTime: '',
      clockInActual: entry.clock_in ?? null,
      clockOutActual: null,
      timeEntryId: entry.id ?? null,
      status: 'on-time',
      isRemote: false,
    });
  }

  return unscheduledShifts;
}

export const todayShiftsService = {
  async getTodayShifts(
    now: Date = new Date(),
    options: { includeRemote?: boolean } = {},
  ): Promise<TodayShiftsResult> {
    const includeRemote = options.includeRemote ?? false;
    const todayDate = getTodayDateString(now);

    return withTodayShiftsCache(todayDate, includeRemote, () =>
      computeTodayShifts(now, todayDate, includeRemote),
    );
  },
};

export function assembleTodayShifts(input: AssembleTodayShiftsInput): TodayShiftsResult {
  const {
    now,
    todayDate,
    includeRemote,
    schedules,
    scheduleBlocks,
    studentAssistants,
    timeEntries,
    terms,
    studentTimeOff,
  } = input;

  const todayDay = getTodayDay(now);

  const studentAssistantMap = new Map(
    studentAssistants.map((assistant) => [assistant.id, assistant]),
  );

  const todaysTimeEntries = timeEntries.filter((entry) =>
    getClockInDate(entry.clock_in) === todayDate,
  );

  const upcomingTimeOff = buildUpcomingTimeOff(studentTimeOff, studentAssistantMap, now);
  const todayTimeOff = buildTodayTimeOff(studentTimeOff, studentAssistantMap, todayDate);

  if (!todayDay) {
    return {
      shifts: buildUnscheduledShifts(todaysTimeEntries, studentAssistantMap),
      remoteOnlyStudentIds: [],
      timeOffShifts: [],
      partialTimeOff: [],
      upcomingTimeOff,
      todayTimeOff,
    };
  }

  const termMap = new Map(terms.map((term) => [term.id, term]));

  const scheduleMap = new Map(schedules.map((schedule) => [schedule.id, schedule]));
  const todaysBlocks = scheduleBlocks.filter((block) => block.days === todayDay);

  const inPersonStudentIds = new Set<number>();
  const remoteStudentIds = new Set<number>();

  for (const block of todaysBlocks) {
    const studentId = resolveBlockStudentId(block, scheduleMap);
    if (studentId == null) continue;

    const schedule =
      block.schedule_id != null ? scheduleMap.get(block.schedule_id) : undefined;
    const term =
      schedule?.academic_term_id != null
        ? termMap.get(schedule.academic_term_id)
        : undefined;
    if (
      schedule &&
      term &&
      !isDateInEffectiveScheduleRange(todayDate, schedule, term)
    ) {
      continue;
    }

    const studentAssistant = studentAssistantMap.get(studentId);
    if (!studentAssistant || studentAssistant.is_active === false) continue;

    if (resolveBlockTimeOff(block, studentId, todayDate, now, term, studentTimeOff).kind !== 'work') {
      continue;
    }

    if (block.is_remote) {
      remoteStudentIds.add(studentId);
    } else {
      inPersonStudentIds.add(studentId);
    }
  }

  const remoteOnlyStudentIds = [...remoteStudentIds].filter(
    (studentId) => !inPersonStudentIds.has(studentId),
  );

  const timeEntryMap = new Map<string, TimeEntry>();
  for (const entry of todaysTimeEntries) {
    const key = `${entry.schedule_block_id}-${entry.student_assistant_id}`;
    timeEntryMap.set(key, entry);
  }

  const timeOffShifts: TodayTimeOffShift[] = [];
  const partialTimeOff: TodayTimeOffShift[] = [];

  const scheduledShifts: TodayShift[] = todaysBlocks.flatMap((block) => {
    if (block.is_remote && !includeRemote) return [];

    const schedule =
      block.schedule_id != null ? scheduleMap.get(block.schedule_id) : undefined;
    if (!schedule?.student_assistant_id) return [];

    const term =
      schedule.academic_term_id != null
        ? termMap.get(schedule.academic_term_id)
        : undefined;
    if (
      term &&
      !isDateInEffectiveScheduleRange(todayDate, schedule, term)
    ) {
      return [];
    }

    const studentAssistant = studentAssistantMap.get(schedule.student_assistant_id);
    if (!studentAssistant || studentAssistant.is_active === false) return [];

    const resolved = resolveBlockTimeOff(
      block,
      schedule.student_assistant_id,
      todayDate,
      now,
      term,
      studentTimeOff,
    );
    if (resolved.kind === 'vacation') return [];
    if (resolved.kind === 'off') {
      timeOffShifts.push({
        scheduleBlockId: block.id,
        studentAssistantId: schedule.student_assistant_id,
        firstName: studentAssistant.first_name ?? '',
        lastName: studentAssistant.last_name ?? '',
        role: formatStudentRole(studentAssistant.position),
        startTime: block.start_time ?? '00:00',
        endTime: block.end_time ?? '00:00',
        isRemote: block.is_remote ?? false,
        timeOffStartsAt: resolved.timeOff.starts_at,
        timeOffEndsAt: resolved.timeOff.ends_at,
        timeOffReason: resolved.timeOff.time_off_reason ?? null,
      });
      return [];
    }

    const { startTime, endTime } = resolved;
    const blockStart = block.start_time ?? '00:00';
    const blockEnd = block.end_time ?? '00:00';
    if (startTime !== blockStart || endTime !== blockEnd) {
      const pieces = timeOffPiecesForShift(
        studentTimeOff,
        schedule.student_assistant_id,
        todayDate,
        timeToMinutes(blockStart),
        timeToMinutes(blockEnd),
      );
      for (const piece of pieces) {
        partialTimeOff.push({
          scheduleBlockId: block.id,
          studentAssistantId: schedule.student_assistant_id,
          firstName: studentAssistant.first_name ?? '',
          lastName: studentAssistant.last_name ?? '',
          role: formatStudentRole(studentAssistant.position),
          startTime: minutesToTime(piece.startMinutes),
          endTime: minutesToTime(piece.endMinutes),
          isRemote: block.is_remote ?? false,
          timeOffStartsAt: piece.timeOff.starts_at,
          timeOffEndsAt: piece.timeOff.ends_at,
          timeOffReason: piece.timeOff.time_off_reason ?? null,
        });
      }
    }

    const timeEntryKey = `${block.id}-${schedule.student_assistant_id}`;
    const timeEntry = timeEntryMap.get(timeEntryKey) ?? null;

    return [{
      scheduleBlockId: block.id,
      studentAssistantId: schedule.student_assistant_id,
      firstName: studentAssistant.first_name ?? '',
      lastName: studentAssistant.last_name ?? '',
      role: formatStudentRole(studentAssistant.position),
      startTime,
      endTime,
      clockInActual: timeEntry?.clock_in ?? null,
      clockOutActual: timeEntry?.clock_out ?? null,
      timeEntryId: timeEntry?.id ?? null,
      status: block.is_remote
        ? computeRemoteShiftStatus(startTime, now)
        : computeShiftStatus(startTime, timeEntry?.clock_in ?? null, now),
      isRemote: block.is_remote ?? false,
    }];
  });

  const unscheduledShifts = buildUnscheduledShifts(
    todaysTimeEntries,
    studentAssistantMap,
  );

  return {
    shifts: [...scheduledShifts, ...unscheduledShifts],
    remoteOnlyStudentIds,
    timeOffShifts: timeOffShifts.sort((a, b) => a.startTime.localeCompare(b.startTime)),
    partialTimeOff: partialTimeOff.sort((a, b) => a.startTime.localeCompare(b.startTime)),
    upcomingTimeOff,
    todayTimeOff,
  };
}

async function computeTodayShifts(
  now: Date,
  todayDate: string,
  includeRemote: boolean,
): Promise<TodayShiftsResult> {
  const [schedules, scheduleBlocks, studentAssistants, timeEntries, terms] =
    await Promise.all([
      schedulesService.getAll(),
      scheduleBlocksService.getAll(),
      studentAssistantService.getAll(),
      timeEntryService.getAll(),
      termService.getAll(),
    ]);

  const studentTimeOff = (
    await Promise.all(terms.map((term) => studentTimeOffService.listByTerm(term.id)))
  ).flat();

  return assembleTodayShifts({
    now,
    todayDate,
    includeRemote,
    schedules,
    scheduleBlocks,
    studentAssistants,
    timeEntries,
    terms,
    studentTimeOff,
  });
}

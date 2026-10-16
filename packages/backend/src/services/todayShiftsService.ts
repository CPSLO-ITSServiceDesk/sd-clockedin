import { withTodayShiftsCache } from '../lib/todayShiftsCache';
import { isDateInEffectiveScheduleRange } from '../lib/scheduleDateRange';
import { formatStudentRole } from '../lib/formatStudentRole';
import { getOrgDayOfWeek } from '../lib/orgTime';
import {
  isCampusVacationOnDate,
  isTimeOffCoveringInstant,
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

/** A scheduled block omitted from `shifts` because the student's time off covers now. */
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
  upcomingTimeOff: UpcomingTimeOff[];
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

function findTimeOffCoveringInstant(
  rows: TodayTimeOffInterval[],
  studentAssistantId: number,
  instant: Date,
): TodayTimeOffInterval | null {
  return (
    rows.find((row) => isTimeOffCoveringInstant([row], studentAssistantId, instant)) ?? null
  );
}

function buildUpcomingTimeOff(
  rows: TodayTimeOffInterval[],
  studentAssistantMap: Map<number, StudentAssistant>,
  now: Date,
): UpcomingTimeOff[] {
  const nowMs = now.getTime();
  const windowEndMs = nowMs + UPCOMING_TIME_OFF_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  return rows
    .filter((row) => {
      const start = Date.parse(row.starts_at);
      const end = Date.parse(row.ends_at);
      if (Number.isNaN(start) || Number.isNaN(end)) return false;
      return end > nowMs && start < windowEndMs;
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
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}

function shouldOmitScheduledBlock(
  todayDate: string,
  now: Date,
  term: Term | undefined,
  studentAssistantId: number,
  studentTimeOff: TimeOffInterval[],
): boolean {
  if (isCampusVacationOnDate(term, todayDate)) return true;
  return isTimeOffCoveringInstant(studentTimeOff, studentAssistantId, now);
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

  if (!todayDay) {
    return {
      shifts: buildUnscheduledShifts(todaysTimeEntries, studentAssistantMap),
      remoteOnlyStudentIds: [],
      timeOffShifts: [],
      upcomingTimeOff,
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

    if (shouldOmitScheduledBlock(todayDate, now, term, studentId, studentTimeOff)) {
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

    if (
      shouldOmitScheduledBlock(
        todayDate,
        now,
        term,
        schedule.student_assistant_id,
        studentTimeOff,
      )
    ) {
      const timeOff = isCampusVacationOnDate(term, todayDate)
        ? null
        : findTimeOffCoveringInstant(studentTimeOff, schedule.student_assistant_id, now);
      if (timeOff) {
        timeOffShifts.push({
          scheduleBlockId: block.id,
          studentAssistantId: schedule.student_assistant_id,
          firstName: studentAssistant.first_name ?? '',
          lastName: studentAssistant.last_name ?? '',
          role: formatStudentRole(studentAssistant.position),
          startTime: block.start_time ?? '00:00',
          endTime: block.end_time ?? '00:00',
          isRemote: block.is_remote ?? false,
          timeOffStartsAt: timeOff.starts_at,
          timeOffEndsAt: timeOff.ends_at,
          timeOffReason: timeOff.time_off_reason ?? null,
        });
      }
      return [];
    }

    const timeEntryKey = `${block.id}-${schedule.student_assistant_id}`;
    const timeEntry = timeEntryMap.get(timeEntryKey) ?? null;
    const startTime = block.start_time ?? '00:00';

    return [{
      scheduleBlockId: block.id,
      studentAssistantId: schedule.student_assistant_id,
      firstName: studentAssistant.first_name ?? '',
      lastName: studentAssistant.last_name ?? '',
      role: formatStudentRole(studentAssistant.position),
      startTime,
      endTime: block.end_time ?? '00:00',
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
    upcomingTimeOff,
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

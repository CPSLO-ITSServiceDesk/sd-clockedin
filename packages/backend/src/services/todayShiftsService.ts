import { formatStudentRole } from '../lib/formatStudentRole';
import { computeRemoteShiftStatus, computeShiftStatus, type ShiftStatus } from '../lib/shiftStatus';
import type { Database } from '../types/database.types';
import { scheduleBlocksService } from './scheduleBlocksService';
import { schedulesService } from './schedulesService';
import { studentAssistantService } from './studentAssistantService';
import { timeEntryService } from './timeEntryService';

type ScheduleBlockDay = Database['public']['Enums']['days'];

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

export interface TodayShiftsResult {
  shifts: TodayShift[];
  remoteOnlyStudentIds: number[];
}

const WEEKDAY_DAYS: ScheduleBlockDay[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
];

export function getTodayDay(now: Date = new Date()): ScheduleBlockDay | null {
  const day = now.getDay();
  if (day === 0 || day === 6) return null;
  return WEEKDAY_DAYS[day - 1];
}

export function getTodayDateString(now: Date = new Date()): string {
  return now.toISOString().split('T')[0];
}

function resolveBlockStudentId(
  block: Database['public']['Tables']['schedule_blocks']['Row'],
  scheduleMap: Map<number, Database['public']['Tables']['schedules']['Row']>,
): number | null {
  if (block.schedule_id == null) return null;
  return scheduleMap.get(block.schedule_id)?.student_assistant_id ?? null;
}

export const todayShiftsService = {
  async getTodayShifts(
    now: Date = new Date(),
    options: { includeRemote?: boolean } = {},
  ): Promise<TodayShiftsResult> {
    const includeRemote = options.includeRemote ?? false;
    const todayDay = getTodayDay(now);
    if (!todayDay) {
      return { shifts: [], remoteOnlyStudentIds: [] };
    }

    const todayDate = getTodayDateString(now);

    const [schedules, scheduleBlocks, studentAssistants, timeEntries] =
      await Promise.all([
        schedulesService.getAll(),
        scheduleBlocksService.getAll(),
        studentAssistantService.getAll(),
        timeEntryService.getAll(),
      ]);

    const todaysBlocks = scheduleBlocks.filter((block) => block.days === todayDay);
    const todaysTimeEntries = timeEntries.filter((entry) =>
      entry.created_at?.startsWith(todayDate),
    );

    const scheduleMap = new Map(schedules.map((schedule) => [schedule.id, schedule]));
    const studentAssistantMap = new Map(
      studentAssistants.map((assistant) => [assistant.id, assistant]),
    );

    const inPersonStudentIds = new Set<number>();
    const remoteStudentIds = new Set<number>();

    for (const block of todaysBlocks) {
      const studentId = resolveBlockStudentId(block, scheduleMap);
      if (studentId == null) continue;

      const studentAssistant = studentAssistantMap.get(studentId);
      if (!studentAssistant || studentAssistant.is_active === false) continue;

      if (block.is_remote) {
        remoteStudentIds.add(studentId);
      } else {
        inPersonStudentIds.add(studentId);
      }
    }

    const remoteOnlyStudentIds = [...remoteStudentIds].filter(
      (studentId) => !inPersonStudentIds.has(studentId),
    );

    const timeEntryMap = new Map<string, (typeof timeEntries)[number]>();
    for (const entry of todaysTimeEntries) {
      const key = `${entry.schedule_block_id}-${entry.student_assistant_id}`;
      timeEntryMap.set(key, entry);
    }

    const scheduledShifts: TodayShift[] = todaysBlocks.flatMap((block) => {
      if (block.is_remote && !includeRemote) return [];

      const schedule =
        block.schedule_id != null ? scheduleMap.get(block.schedule_id) : undefined;
      if (!schedule?.student_assistant_id) return [];

      const studentAssistant = studentAssistantMap.get(schedule.student_assistant_id);
      if (!studentAssistant || studentAssistant.is_active === false) return [];

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

    return {
      shifts: [...scheduledShifts, ...unscheduledShifts],
      remoteOnlyStudentIds,
    };
  },
};

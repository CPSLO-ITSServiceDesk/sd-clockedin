import { formatStudentRole } from '../lib/formatStudentRole';
import { computeShiftStatus, type ShiftStatus } from '../lib/shiftStatus';
import type { Database } from '../types/database.types';
import { scheduleBlocksService } from './scheduleBlocksService';
import { schedulesService } from './schedulesService';
import { studentAssistantService } from './studentAssistantService';
import { timeEntryService } from './timeEntryService';

type ScheduleBlockDay = Database['public']['Enums']['days'];

export interface TodayShift {
  scheduleBlockId: number;
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

export const todayShiftsService = {
  async getTodayShifts(now: Date = new Date()): Promise<TodayShift[]> {
    const todayDay = getTodayDay(now);
    if (!todayDay) return [];

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

    const timeEntryMap = new Map<string, (typeof timeEntries)[number]>();
    for (const entry of todaysTimeEntries) {
      const key = `${entry.schedule_block_id}-${entry.student_assistant_id}`;
      timeEntryMap.set(key, entry);
    }

    return todaysBlocks
      .map((block) => {
        const schedule =
          block.schedule_id != null ? scheduleMap.get(block.schedule_id) : undefined;
        if (!schedule?.student_assistant_id) return null;

        const studentAssistant = studentAssistantMap.get(schedule.student_assistant_id);
        if (!studentAssistant || studentAssistant.is_active === false) return null;

        const timeEntryKey = `${block.id}-${schedule.student_assistant_id}`;
        const timeEntry = timeEntryMap.get(timeEntryKey) ?? null;
        const startTime = block.start_time ?? '00:00';

        return {
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
          status: computeShiftStatus(startTime, timeEntry?.clock_in ?? null, now),
        } satisfies TodayShift;
      })
      .filter((shift): shift is TodayShift => shift !== null);
  },
};

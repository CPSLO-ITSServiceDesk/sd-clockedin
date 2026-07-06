import { resolveNearestBlock } from '../lib/resolveNearestBlock';
import { isDateInEffectiveScheduleRange } from '../lib/scheduleDateRange';
import { getOrgLocalDateString } from '../lib/orgTime';
import {
  addLocalDays,
  getClockInDate,
  isLocalDateInRange,
} from '../lib/shiftStatus';
import { supabase } from '../lib/supabase';
import { HttpError } from '../middleware/errorHandler';
import type { Database } from '../types/database.types';
import { scheduleBlocksService } from './scheduleBlocksService';
import { schedulesService } from './schedulesService';
import { studentAssistantService } from './studentAssistantService';
import { termService } from './termService';
import { getTodayDateString, getTodayDay } from './todayShiftsService';

type TimeEntry = Database['public']['Tables']['time_entry']['Row'];
type TimeEntryInsert = Database['public']['Tables']['time_entry']['Insert'];
type TimeEntryUpdate = Database['public']['Tables']['time_entry']['Update'];

export interface ClockInResult {
  timeEntry: TimeEntry;
  matchedBlock: {
    id: number;
    startTime: string;
    endTime: string;
  } | null;
}

export interface AutoClockOutResult {
  closedCount: number;
  entryIds: number[];
  skippedCount: number;
  staleCount: number;
}

// PostgREST returns this code when .single() finds no matching row.
const NO_ROWS = 'PGRST116';

export const timeEntryService = {
  async getAll(): Promise<TimeEntry[]> {
    const { data, error } = await supabase
      .from('time_entry')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new HttpError(500, error.message);
    return data ?? [];
  },

  async getById(id: number): Promise<TimeEntry | null> {
    const { data, error } = await supabase
      .from('time_entry')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === NO_ROWS) return null;
      throw new HttpError(500, error.message);
    }
    return data;
  },

  async getOpenByScheduleAndAssistant(schedule_block_id: number, student_assistant_id: number): Promise<TimeEntry | null> {
    const { data, error } = await supabase
      .from('time_entry')
      .select('*')
      .eq('schedule_block_id', schedule_block_id)
      .eq('student_assistant_id', student_assistant_id)
      .is('clock_out', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === NO_ROWS) return null;
      throw new HttpError(500, error.message);
    }
    return data;
  },

  async getOpenByAssistant(student_assistant_id: number): Promise<TimeEntry | null> {
    const { data, error } = await supabase
      .from('time_entry')
      .select('*')
      .eq('student_assistant_id', student_assistant_id)
      .is('clock_out', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === NO_ROWS) return null;
      throw new HttpError(500, error.message);
    }
    return data;
  },

  async getAllOpen(): Promise<TimeEntry[]> {
    const { data, error } = await supabase
      .from('time_entry')
      .select('*')
      .is('clock_out', null)
      .order('created_at', { ascending: false });

    if (error) throw new HttpError(500, error.message);
    return data ?? [];
  },

  async create(payload: TimeEntryInsert): Promise<TimeEntry> {
    const { data, error } = await supabase
      .from('time_entry')
      .insert(payload)
      .select()
      .single();

    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async update(id: number, payload: TimeEntryUpdate): Promise<TimeEntry | null> {
    const { data, error } = await supabase
      .from('time_entry')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === NO_ROWS) return null;
      throw new HttpError(500, error.message);
    }
    return data;
  },

  async remove(id: number): Promise<void> {
    const { error } = await supabase
      .from('time_entry')
      .delete()
      .eq('id', id);

    if (error) throw new HttpError(500, error.message);
  },

  async clockIn(
    params: { student_assistant_id: number; clock_in?: string },
    now: Date = new Date(),
  ): Promise<ClockInResult> {
    const { student_assistant_id, clock_in } = params;

    const studentAssistant = await studentAssistantService.getById(student_assistant_id);
    if (!studentAssistant || studentAssistant.is_active === false) {
      throw new HttpError(404, 'Student assistant not found or inactive');
    }

    const openEntry = await this.getOpenByAssistant(student_assistant_id);
    if (openEntry) {
      throw new HttpError(409, 'Student is already clocked in');
    }

    const todayDay = getTodayDay(now);
    const todayDate = getTodayDateString(now);
    const [schedules, scheduleBlocks, timeEntries, terms] = await Promise.all([
      schedulesService.getAll(),
      scheduleBlocksService.getAll(),
      this.getAll(),
      termService.getAll(),
    ]);

    const scheduleMap = new Map(schedules.map((schedule) => [schedule.id, schedule]));
    const termMap = new Map(terms.map((term) => [term.id, term]));

    const studentScheduleIds = new Set(
      schedules
        .filter((schedule) => schedule.student_assistant_id === student_assistant_id)
        .map((schedule) => schedule.id),
    );

    const todaysBlocks = todayDay
      ? scheduleBlocks.filter((block) => {
          if (
            block.days !== todayDay ||
            block.schedule_id == null ||
            !studentScheduleIds.has(block.schedule_id)
          ) {
            return false;
          }

          const schedule = scheduleMap.get(block.schedule_id);
          if (!schedule) return false;

          const term =
            schedule.academic_term_id != null
              ? termMap.get(schedule.academic_term_id)
              : undefined;
          if (!term) return true;

          return isDateInEffectiveScheduleRange(todayDate, schedule, term);
        })
      : [];

    const todaysTimeEntries = timeEntries.filter(
      (entry) =>
        getClockInDate(entry.clock_in) === todayDate &&
        entry.student_assistant_id === student_assistant_id,
    );

    const timeEntryMap = new Map<string, TimeEntry>();
    for (const entry of todaysTimeEntries) {
      const key = `${entry.schedule_block_id}-${entry.student_assistant_id}`;
      timeEntryMap.set(key, entry);
    }

    const candidates = todaysBlocks.map((block) => {
      const timeEntryKey = `${block.id}-${student_assistant_id}`;
      const timeEntry = timeEntryMap.get(timeEntryKey) ?? null;
      return {
        scheduleBlockId: block.id,
        startTime: block.start_time ?? '00:00',
        endTime: block.end_time ?? '00:00',
        clockInActual: timeEntry?.clock_in ?? null,
      };
    });

    const matched = resolveNearestBlock(candidates, now);
    const clockInTime = clock_in ?? new Date().toISOString();

    const timeEntry = await this.create({
      schedule_block_id: matched?.scheduleBlockId ?? null,
      student_assistant_id,
      clock_in: clockInTime,
    });

    return {
      timeEntry,
      matchedBlock: matched
        ? {
            id: matched.scheduleBlockId,
            startTime: matched.startTime,
            endTime: matched.endTime,
          }
        : null,
    };
  },

  async closeOpenByAssistant(student_assistant_id: number): Promise<TimeEntry> {
    const openEntry = await this.getOpenByAssistant(student_assistant_id);
    if (!openEntry) {
      throw new HttpError(404, 'No open time entry found for this student');
    }

    const updated = await this.update(openEntry.id, {
      clock_out: new Date().toISOString(),
    });
    if (!updated) {
      throw new HttpError(500, 'Failed to update time entry');
    }

    return updated;
  },

  async autoClockOutOpen(
    clockOut: string,
    now: Date = new Date(),
  ): Promise<AutoClockOutResult> {
    const openEntries = await this.getAllOpen();
    const today = getOrgLocalDateString(now);
    const clockOutTime = new Date(clockOut).getTime();

    const eligibleIds: number[] = [];
    let skippedCount = 0;
    let staleCount = 0;

    for (const entry of openEntries) {
      if (!entry.clock_in || entry.student_assistant_id == null) {
        skippedCount += 1;
        continue;
      }

      const clockInTime = new Date(entry.clock_in).getTime();
      if (Number.isNaN(clockInTime) || clockInTime > clockOutTime) {
        skippedCount += 1;
        continue;
      }

      const clockInDate = getClockInDate(entry.clock_in);
      if (clockInDate && clockInDate !== today) {
        staleCount += 1;
        console.warn(
          `Auto clock-out: stale entry id=${entry.id} clock_in=${entry.clock_in}`,
        );
      }

      eligibleIds.push(entry.id);
    }

    if (eligibleIds.length === 0) {
      return {
        closedCount: 0,
        entryIds: [],
        skippedCount,
        staleCount,
      };
    }

    const { data, error } = await supabase
      .from('time_entry')
      .update({ clock_out: clockOut })
      .in('id', eligibleIds)
      .is('clock_out', null)
      .select('id');

    if (error) throw new HttpError(500, error.message);

    const entryIds = (data ?? []).map((row) => row.id);

    return {
      closedCount: entryIds.length,
      entryIds,
      skippedCount,
      staleCount,
    };
  },

  async getHoursByDay(studentAssistantId: number, startDate: string, endDate: string): Promise<Record<string, number>> {
    // Widen the query so entries near month boundaries are not missed due to UTC storage.
    const queryStart = addLocalDays(startDate, -1);
    const queryEnd = addLocalDays(endDate, 1);

    const { data, error } = await supabase
      .from('time_entry')
      .select('clock_in, clock_out')
      .eq('student_assistant_id', studentAssistantId)
      .gte('clock_in', queryStart)
      .lt('clock_in', queryEnd)
      .order('clock_in');

    if (error) throw new HttpError(500, error.message);

    const hoursByDay: Record<string, number> = {};

    (data || []).forEach(entry => {
      if (!entry.clock_in || !entry.clock_out) return;

      const dateStr = getClockInDate(entry.clock_in);
      if (!dateStr || !isLocalDateInRange(dateStr, startDate, endDate)) return;

      const start = new Date(entry.clock_in);
      const end = new Date(entry.clock_out);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;

      const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      hoursByDay[dateStr] = (hoursByDay[dateStr] || 0) + hours;
    });

    return hoursByDay;
  },
};
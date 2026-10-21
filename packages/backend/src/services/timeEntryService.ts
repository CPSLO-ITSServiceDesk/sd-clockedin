import { resolveNearestBlock } from '../lib/resolveNearestBlock';
import { isDateInEffectiveScheduleRange } from '../lib/scheduleDateRange';
import { getOrgLocalDateString, getOrgLocalInstant } from '../lib/orgTime';
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
import { invalidateTodayShiftsCache } from '../lib/todayShiftsCache';
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

/** Resolves the shift-board date a time entry affects, for cache invalidation. */
function resolveEntryDate(clockIn: string | null | undefined): string {
  return getClockInDate(clockIn ?? null) ?? getTodayDateString(new Date());
}

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

  /** Entries whose clock_in falls in [startIso, endIso). */
  async getByClockInRange(startIso: string, endIso: string): Promise<TimeEntry[]> {
    const { data, error } = await supabase
      .from('time_entry')
      .select('*')
      .gte('clock_in', startIso)
      .lt('clock_in', endIso)
      .order('clock_in');

    if (error) throw new HttpError(500, error.message);
    return data ?? [];
  },

  /** Entries for a specific student on a specific date (org-local). */
  async getByStudentAndDate(
    studentAssistantId: number,
    dateStr: string,
  ): Promise<TimeEntry[]> {
    const startIso = getOrgLocalInstant(dateStr, 0, 0).toISOString();
    const endIso = getOrgLocalInstant(dateStr, 23, 59).toISOString();

    const { data, error } = await supabase
      .from('time_entry')
      .select('*')
      .eq('student_assistant_id', studentAssistantId)
      .gte('clock_in', startIso)
      .lt('clock_in', endIso)
      .order('clock_in');

    if (error) throw new HttpError(500, error.message);
    return data ?? [];
  },

  /** Entries for a specific student on a specific date with optional block filter. */
  async getByStudentDateAndBlock(
    studentAssistantId: number,
    dateStr: string,
    scheduleBlockId?: number,
  ): Promise<TimeEntry[]> {
    const startIso = getOrgLocalInstant(dateStr, 0, 0).toISOString();
    const endIso = getOrgLocalInstant(dateStr, 23, 59).toISOString();

    let query = supabase
      .from('time_entry')
      .select('*')
      .eq('student_assistant_id', studentAssistantId)
      .gte('clock_in', startIso)
      .lt('clock_in', endIso)
      .order('clock_in');

    if (scheduleBlockId != null) {
      query = query.eq('schedule_block_id', scheduleBlockId);
    }

    const { data, error } = await query;

    if (error) throw new HttpError(500, error.message);
    return data ?? [];
  },

  /** Today's entries for the shift board (org-local date). */
  async getTodaysEntries(dateStr: string): Promise<TimeEntry[]> {
    const startIso = getOrgLocalInstant(dateStr, 0, 0).toISOString();
    const endIso = getOrgLocalInstant(dateStr, 23, 59).toISOString();

    const { data, error } = await supabase
      .from('time_entry')
      .select('*')
      .gte('clock_in', startIso)
      .lt('clock_in', endIso)
      .order('clock_in', { ascending: false });

    if (error) throw new HttpError(500, error.message);
    return data ?? [];
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
    await invalidateTodayShiftsCache(resolveEntryDate(data.clock_in));
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
    await invalidateTodayShiftsCache(resolveEntryDate(data.clock_in));
    return data;
  },

  async remove(id: number): Promise<void> {
    const existing = await this.getById(id);

    const { error } = await supabase
      .from('time_entry')
      .delete()
      .eq('id', id);

    if (error) throw new HttpError(500, error.message);
    await invalidateTodayShiftsCache(resolveEntryDate(existing?.clock_in));
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

    if (!todayDay) {
      // Weekend - no scheduled blocks, create unscheduled entry
      const timeEntry = await this.create({
        schedule_block_id: null,
        student_assistant_id,
        clock_in: clock_in ?? new Date().toISOString(),
      });
      return { timeEntry, matchedBlock: null };
    }

    // Get active term
    const activeTerm = await termService.getActive();
    if (!activeTerm) {
      throw new HttpError(400, 'No active academic term');
    }

    // Get student's schedule for the active term
    const studentSchedule = await schedulesService.getByStudentAndTerm(student_assistant_id, activeTerm.id);
    if (!studentSchedule) {
      // No schedule for this term, create unscheduled entry
      const timeEntry = await this.create({
        schedule_block_id: null,
        student_assistant_id,
        clock_in: clock_in ?? new Date().toISOString(),
      });
      return { timeEntry, matchedBlock: null };
    }

    // Get today's blocks for this student's schedule
    const studentBlocks = await scheduleBlocksService.getByScheduleId(studentSchedule.id);
    const todaysBlocks = studentBlocks.filter((block) => block.days === todayDay);

    // Check if date is in effective schedule range
    const effectiveBlocks = todaysBlocks.filter((block) =>
      isDateInEffectiveScheduleRange(todayDate, studentSchedule, activeTerm),
    );

    // Get today's time entries for this student
    const todaysTimeEntries = await this.getByStudentAndDate(student_assistant_id, todayDate);

    const timeEntryMap = new Map<string, TimeEntry>();
    for (const entry of todaysTimeEntries) {
      const key = `${entry.schedule_block_id}-${entry.student_assistant_id}`;
      timeEntryMap.set(key, entry);
    }

    const candidates = effectiveBlocks.map((block) => {
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
    if (entryIds.length > 0) {
      await invalidateTodayShiftsCache(today);
    }

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
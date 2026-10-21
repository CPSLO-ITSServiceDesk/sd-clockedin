import { clearScheduleBlockReferences } from '../lib/clearScheduleBlockReferences';
import { invalidateTodayShiftsCacheForNow } from '../lib/todayShiftsCache';
import { getOrgDayOfWeek, getOrgLocalInstant } from '../lib/orgTime';
import { supabase } from '../lib/supabase';
import { HttpError } from '../middleware/errorHandler';
import type { Database } from '../types/database.types';

type ScheduleBlock = Database['public']['Tables']['schedule_blocks']['Row'];
type ScheduleBlockInsert = Database['public']['Tables']['schedule_blocks']['Insert'];
type ScheduleBlockUpdate = Database['public']['Tables']['schedule_blocks']['Update'];

// PostgREST returns this code when .single() finds no matching row.
const NO_ROWS = 'PGRST116';

export const scheduleBlocksService = {
  async getAll(): Promise<ScheduleBlock[]> {
    const { data, error } = await supabase
      .from('schedule_blocks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new HttpError(500, error.message);
    return data ?? [];
  },

  async getById(id: number): Promise<ScheduleBlock | null> {
    const { data, error } = await supabase
      .from('schedule_blocks')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === NO_ROWS) return null;
      throw new HttpError(500, error.message);
    }
    return data;
  },

  async create(payload: ScheduleBlockInsert): Promise<ScheduleBlock> {
    const { data, error } = await supabase
      .from('schedule_blocks')
      .insert(payload)
      .select()
      .single();

    if (error) throw new HttpError(500, error.message);
    await invalidateTodayShiftsCacheForNow();
    return data;
  },

  async update(id: number, payload: ScheduleBlockUpdate): Promise<ScheduleBlock | null> {
    const { data, error } = await supabase
      .from('schedule_blocks')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === NO_ROWS) return null;
      throw new HttpError(500, error.message);
    }
    await invalidateTodayShiftsCacheForNow();
    return data;
  },

  async remove(id: number): Promise<void> {
    await clearScheduleBlockReferences([id]);

    const { error } = await supabase
      .from('schedule_blocks')
      .delete()
      .eq('id', id);

    if (error) throw new HttpError(500, error.message);
    await invalidateTodayShiftsCacheForNow();
  },

  async removeMany(ids: number[]): Promise<void> {
    if (ids.length === 0) return;

    await clearScheduleBlockReferences(ids);

    const { error } = await supabase
      .from('schedule_blocks')
      .delete()
      .in('id', ids);

    if (error) throw new HttpError(500, error.message);
    await invalidateTodayShiftsCacheForNow();
  },

  async getByScheduleId(schedule_id: number): Promise<ScheduleBlock[]> {
    const { data, error } = await supabase
      .from('schedule_blocks')
      .select('*')
      .eq('schedule_id', schedule_id)
      .order('days', { ascending: true });

    if (error) throw new HttpError(500, error.message);
    return data ?? [];
  },

  /** Get blocks for a specific day of the week (org timezone). */
  async getByDay(day: Database['public']['Enums']['days']): Promise<ScheduleBlock[]> {
    const { data, error } = await supabase
      .from('schedule_blocks')
      .select('*')
      .eq('days', day)
      .order('start_time', { ascending: true });

    if (error) throw new HttpError(500, error.message);
    return data ?? [];
  },

  /** Get today's blocks for the shift board. */
  async getTodaysBlocks(): Promise<ScheduleBlock[]> {
    const day = getOrgDayOfWeek(new Date());
    if (day === 0 || day === 6) return [];
    const days: Database['public']['Enums']['days'][] = [
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
    ];
    return this.getByDay(days[day - 1]);
  },
};
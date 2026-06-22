import { supabase } from '../lib/supabase';
import { HttpError } from '../middleware/errorHandler';
import type { Database } from '../types/database.types';

type TimeEntry = Database['public']['Tables']['time_entry']['Row'];
type TimeEntryInsert = Database['public']['Tables']['time_entry']['Insert'];
type TimeEntryUpdate = Database['public']['Tables']['time_entry']['Update'];

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
};
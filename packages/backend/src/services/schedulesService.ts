import { supabase } from '../lib/supabase';
import { HttpError } from '../middleware/errorHandler';
import type { Database } from '../types/database.types';

type Schedule = Database['public']['Tables']['schedules']['Row'];
type ScheduleInsert = Database['public']['Tables']['schedules']['Insert'];
type ScheduleUpdate = Database['public']['Tables']['schedules']['Update'];

// PostgREST returns this code when .single() finds no matching row.
const NO_ROWS = 'PGRST116';

export const schedulesService = {
  async getAll(): Promise<Schedule[]> {
    const { data, error } = await supabase
      .from('schedules')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new HttpError(500, error.message);
    return data ?? [];
  },

  async getById(id: number): Promise<Schedule | null> {
    const { data, error } = await supabase
      .from('schedules')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === NO_ROWS) return null;
      throw new HttpError(500, error.message);
    }
    return data;
  },

  async getByStudentAndTerm(
    studentAssistantId: number,
    academicTermId: number,
  ): Promise<Schedule | null> {
    const { data, error } = await supabase
      .from('schedules')
      .select('*')
      .eq('student_assistant_id', studentAssistantId)
      .eq('academic_term_id', academicTermId)
      .maybeSingle();

    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async create(payload: ScheduleInsert): Promise<Schedule> {
    const { data, error } = await supabase
      .from('schedules')
      .insert(payload)
      .select()
      .single();

    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async update(id: number, payload: ScheduleUpdate): Promise<Schedule | null> {
    const { data, error } = await supabase
      .from('schedules')
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
      .from('schedules')
      .delete()
      .eq('id', id);

    if (error) throw new HttpError(500, error.message);
  },
};
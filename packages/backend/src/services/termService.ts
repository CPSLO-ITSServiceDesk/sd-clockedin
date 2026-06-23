import { supabase } from '../lib/supabase';
import { HttpError } from '../middleware/errorHandler';
import type { Database } from '../types/database.types';
import { scheduleBlocksService } from './scheduleBlocksService';

type Term = Database['public']['Tables']['academic_term']['Row'];
type TermInsert = Database['public']['Tables']['academic_term']['Insert'];
type TermUpdate = Database['public']['Tables']['academic_term']['Update'];

// PostgREST returns this code when .single() finds no matching row.
const NO_ROWS = 'PGRST116';

export const termService = {
  // get all terms
  async getAll(): Promise<Term[]> {
    const { data, error } = await supabase
      .from('academic_term')
      .select('*')
      .order('start_date', { ascending: false });

    if (error) throw new HttpError(500, error.message);
    return data ?? [];
  },

  // get a single term by id
  async getById(id: number): Promise<Term | null> {
    const { data, error } = await supabase
      .from('academic_term')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === NO_ROWS) return null;
      throw new HttpError(500, error.message);
    }
    return data;
  },

  // create a new term
  async create(payload: TermInsert): Promise<Term> {
    const { data, error } = await supabase
      .from('academic_term')
      .insert(payload)
      .select()
      .single();

    if (error) throw new HttpError(500, error.message);
    return data;
  },

  // update a term by id
  async update(id: number, payload: TermUpdate): Promise<Term | null> {
    const { data, error } = await supabase
      .from('academic_term')
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

  // delete a term by id and its schedules + schedule blocks
  async remove(id: number): Promise<void> {
    const { data: schedules, error: schedulesError } = await supabase
      .from('schedules')
      .select('id')
      .eq('academic_term_id', id);

    if (schedulesError) throw new HttpError(500, schedulesError.message);

    const scheduleIds = (schedules ?? []).map((schedule) => schedule.id);

    if (scheduleIds.length > 0) {
      const { data: blocks, error: blocksError } = await supabase
        .from('schedule_blocks')
        .select('id')
        .in('schedule_id', scheduleIds);

      if (blocksError) throw new HttpError(500, blocksError.message);

      const blockIds = (blocks ?? []).map((block) => block.id);
      await scheduleBlocksService.removeMany(blockIds);

      const { error: deleteSchedulesError } = await supabase
        .from('schedules')
        .delete()
        .in('id', scheduleIds);

      if (deleteSchedulesError) {
        throw new HttpError(500, deleteSchedulesError.message);
      }
    }

    const { error } = await supabase
      .from('academic_term')
      .delete()
      .eq('id', id);

    if (error) throw new HttpError(500, error.message);
  },
};

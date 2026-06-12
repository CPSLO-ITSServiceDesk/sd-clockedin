import { supabase } from '../lib/supabase';
import { HttpError } from '../middleware/errorHandler';
import type { Database } from '../types/database.types';

type Term = Database['public']['Tables']['academic_term']['Row'];
type TermInsert = Database['public']['Tables']['academic_term']['Insert'];
type TermUpdate = Database['public']['Tables']['academic_term']['Update'];

// PostgREST returns this code when .single() finds no matching row.
const NO_ROWS = 'PGRST116';

export const termService = {
  async getAll(): Promise<Term[]> {
    const { data, error } = await supabase
      .from('academic_term')
      .select('*')
      .order('start_date', { ascending: false });

    if (error) throw new HttpError(500, error.message);
    return data ?? [];
  },

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

  async create(payload: TermInsert): Promise<Term> {
    const { data, error } = await supabase
      .from('academic_term')
      .insert(payload)
      .select()
      .single();

    if (error) throw new HttpError(500, error.message);
    return data;
  },

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

  async remove(id: number): Promise<void> {
    const { error } = await supabase
      .from('academic_term')
      .delete()
      .eq('id', id);

    if (error) throw new HttpError(500, error.message);
  },
};

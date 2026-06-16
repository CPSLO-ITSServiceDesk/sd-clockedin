import { supabase } from '../lib/supabase';
import { HttpError } from '../middleware/errorHandler';
import type { Database } from '../types/database.types';

type StudentAssistant = Database['public']['Tables']['student_assistant']['Row'];
type StudentAssistantInsert = Database['public']['Tables']['student_assistant']['Insert'];
type StudentAssistantUpdate = Database['public']['Tables']['student_assistant']['Update'];

// PostgREST returns this code when .single() finds no matching row.
const NO_ROWS = 'PGRST116';

export const studentAssistantService = {
  // get all student assistants
  async getAll(): Promise<StudentAssistant[]> {
    const { data, error } = await supabase
      .from('student_assistant')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw new HttpError(500, error.message);
    return data ?? [];
  },

  // get a single student assistant by id
  async getById(id: number): Promise<StudentAssistant | null> {
    const { data, error } = await supabase
      .from('student_assistant')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === NO_ROWS) return null;
      throw new HttpError(500, error.message);
    }
    return data;
  },

  // create a new student assistant
  async create(payload: StudentAssistantInsert): Promise<StudentAssistant> {
    const { data, error } = await supabase
      .from('student_assistant')
      .insert(payload)
      .select()
      .single();

    if (error) throw new HttpError(500, error.message);
    return data;
  },

  // update a student assistant by id
  async update(id: number, payload: StudentAssistantUpdate): Promise<StudentAssistant | null> {
    const { data, error } = await supabase
      .from('student_assistant')
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

  // delete a student assistant by id
  async remove(id: number): Promise<void> {
    const { error } = await supabase
      .from('student_assistant')
      .delete()
      .eq('id', id);

    if (error) throw new HttpError(500, error.message);
  },
};
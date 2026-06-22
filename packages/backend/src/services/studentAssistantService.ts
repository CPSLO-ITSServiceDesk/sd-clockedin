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

  // delete a student assistant by id, including related schedules and time entries
  async remove(id: number): Promise<void> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new HttpError(404, 'Student assistant not found');
    }

    const { data: schedules, error: schedulesError } = await supabase
      .from('schedules')
      .select('id')
      .eq('student_assistant_id', id);

    if (schedulesError) throw new HttpError(500, schedulesError.message);

    const scheduleIds = (schedules ?? []).map((schedule) => schedule.id);

    let blockIds: number[] = [];
    if (scheduleIds.length > 0) {
      const { data: blocks, error: blocksError } = await supabase
        .from('schedule_blocks')
        .select('id')
        .in('schedule_id', scheduleIds);

      if (blocksError) throw new HttpError(500, blocksError.message);
      blockIds = (blocks ?? []).map((block) => block.id);
    }

    const { error: timeByStudentError } = await supabase
      .from('time_entry')
      .delete()
      .eq('student_assistant_id', id);

    if (timeByStudentError) throw new HttpError(500, timeByStudentError.message);

    if (blockIds.length > 0) {
      const { error: timeByBlockError } = await supabase
        .from('time_entry')
        .delete()
        .in('schedule_block_id', blockIds);

      if (timeByBlockError) throw new HttpError(500, timeByBlockError.message);

      const { error: blocksDeleteError } = await supabase
        .from('schedule_blocks')
        .delete()
        .in('id', blockIds);

      if (blocksDeleteError) throw new HttpError(500, blocksDeleteError.message);
    }

    if (scheduleIds.length > 0) {
      const { error: schedulesDeleteError } = await supabase
        .from('schedules')
        .delete()
        .in('id', scheduleIds);

      if (schedulesDeleteError) {
        throw new HttpError(500, schedulesDeleteError.message);
      }
    }

    const { error } = await supabase
      .from('student_assistant')
      .delete()
      .eq('id', id);

    if (error) throw new HttpError(500, error.message);
  },
};
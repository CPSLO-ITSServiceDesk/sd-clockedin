import { invalidateLiveReads } from '../lib/derivedReadsCache';
import { supabase } from '../lib/supabase';
import { HttpError } from '../middleware/errorHandler';
import type { Database } from '../types/database.types';

type StudentTimeOff = Database['public']['Tables']['student_time_off']['Row'];
type StudentTimeOffInsert = Database['public']['Tables']['student_time_off']['Insert'];

export const studentTimeOffService = {
  async listByTerm(academicTermId: number): Promise<StudentTimeOff[]> {
    const { data, error } = await supabase
      .from('student_time_off')
      .select('*')
      .eq('academic_term_id', academicTermId)
      .order('starts_at', { ascending: true });

    if (error) throw new HttpError(500, error.message);
    return data ?? [];
  },

  /** Time off overlapping [startIso, endIso). */
  async listOverlapping(startIso: string, endIso: string): Promise<StudentTimeOff[]> {
    const { data, error } = await supabase
      .from('student_time_off')
      .select('*')
      .lt('starts_at', endIso)
      .gt('ends_at', startIso)
      .order('starts_at', { ascending: true });

    if (error) throw new HttpError(500, error.message);
    return data ?? [];
  },

  async upsertByTeamsTimeOffId(payload: StudentTimeOffInsert): Promise<StudentTimeOff> {
    const teamsTimeOffId = payload.teams_time_off_id.trim();
    if (!teamsTimeOffId) {
      throw new HttpError(400, 'teams_time_off_id is required');
    }

    const { data, error } = await supabase
      .from('student_time_off')
      .upsert(
        { ...payload, teams_time_off_id: teamsTimeOffId },
        { onConflict: 'teams_time_off_id' },
      )
      .select()
      .single();

    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async deleteMissingForTerm(
    academicTermId: number,
    keepTeamsTimeOffIds: string[],
  ): Promise<void> {
    if (keepTeamsTimeOffIds.length === 0) {
      const { error } = await supabase
        .from('student_time_off')
        .delete()
        .eq('academic_term_id', academicTermId);

      if (error) throw new HttpError(500, error.message);
      return;
    }

    const existing = await this.listByTerm(academicTermId);
    const keep = new Set(keepTeamsTimeOffIds.map((id) => id.trim()));
    const idsToDelete = existing
      .filter((row) => !keep.has(row.teams_time_off_id))
      .map((row) => row.id);

    if (idsToDelete.length === 0) return;

    const { error } = await supabase
      .from('student_time_off')
      .delete()
      .in('id', idsToDelete);

    if (error) throw new HttpError(500, error.message);
  },

  async replaceForTerm(
    academicTermId: number,
    rows: StudentTimeOffInsert[],
  ): Promise<StudentTimeOff[]> {
    const payloads = rows.map((row) => ({
      ...row,
      academic_term_id: academicTermId,
      teams_time_off_id: row.teams_time_off_id.trim(),
    }));

    let upserted: StudentTimeOff[] = [];

    if (payloads.length > 0) {
      const { data, error } = await supabase
        .from('student_time_off')
        .upsert(payloads, { onConflict: 'teams_time_off_id' })
        .select();

      if (error) throw new HttpError(500, error.message);
      upserted = data ?? [];
    }

    await this.deleteMissingForTerm(
      academicTermId,
      payloads.map((row) => row.teams_time_off_id),
    );

    await invalidateLiveReads();
    return upserted;
  },
};

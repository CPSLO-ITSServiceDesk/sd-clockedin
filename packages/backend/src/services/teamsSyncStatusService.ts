import { supabase } from '../lib/supabase';
import { HttpError } from '../middleware/errorHandler';
import type { Database } from '../types/database.types';

type TeamsSyncStatus = Database['public']['Tables']['teams_sync_status']['Row'];
type TeamsSyncStatusInsert = Database['public']['Tables']['teams_sync_status']['Insert'];

export const teamsSyncStatusService = {
  async getByTermId(academicTermId: number): Promise<TeamsSyncStatus | null> {
    const { data, error } = await supabase
      .from('teams_sync_status')
      .select('*')
      .eq('academic_term_id', academicTermId)
      .maybeSingle();

    if (error) throw new HttpError(500, error.message);
    return data;
  },

  async upsert(payload: TeamsSyncStatusInsert): Promise<TeamsSyncStatus> {
    const { data, error } = await supabase
      .from('teams_sync_status')
      .upsert(payload, { onConflict: 'academic_term_id' })
      .select()
      .single();

    if (error) throw new HttpError(500, error.message);
    return data;
  },
};

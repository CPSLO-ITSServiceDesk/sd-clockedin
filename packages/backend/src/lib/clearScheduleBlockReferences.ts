import { supabase } from './supabase';
import { HttpError } from '../middleware/errorHandler';

/** Preserve time entries when schedule blocks are replaced or deleted. */
export async function clearScheduleBlockReferences(
  blockIds: number[],
): Promise<void> {
  if (blockIds.length === 0) return;

  const { error } = await supabase
    .from('time_entry')
    .update({ schedule_block_id: null })
    .in('schedule_block_id', blockIds);

  if (error) throw new HttpError(500, error.message);
}

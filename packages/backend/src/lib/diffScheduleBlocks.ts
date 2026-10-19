import type { DraftScheduleBlock } from './scheduleImportTransform';
import { normalizeTimeKey } from './time';

export interface ExistingScheduleBlock {
  id: number;
  days: string | null;
  start_time: string | null;
  end_time: string | null;
  is_remote: boolean | null;
}

export interface ScheduleBlockDiff {
  /** Unchanged blocks whose ids (and linked time entries) stay as they are. */
  keepIds: number[];
  /** Same day and times, only the remote flag changed: update in place to keep the id. */
  updates: { id: number; is_remote: boolean }[];
  /** Blocks no longer in the incoming schedule. */
  removeIds: number[];
  /** Incoming blocks with no existing counterpart. */
  creates: DraftScheduleBlock[];
}

const blockKey = (day: string | null, start: string | null, end: string | null) =>
  `${day ?? ''}|${start ? normalizeTimeKey(start) : ''}|${end ? normalizeTimeKey(end) : ''}`;

/**
 * Match incoming blocks to existing ones by day + start + end so a re-sync
 * keeps block ids stable instead of delete-and-recreate, which would unlink
 * every time entry that referenced the old blocks.
 */
export function diffScheduleBlocks(
  existing: ExistingScheduleBlock[],
  incoming: DraftScheduleBlock[],
): ScheduleBlockDiff {
  const available = new Map<string, ExistingScheduleBlock[]>();
  for (const block of existing) {
    const key = blockKey(block.days, block.start_time, block.end_time);
    available.set(key, [...(available.get(key) ?? []), block]);
  }

  const diff: ScheduleBlockDiff = { keepIds: [], updates: [], removeIds: [], creates: [] };

  for (const block of incoming) {
    const match = available.get(blockKey(block.day, block.start_time, block.end_time))?.shift();
    if (!match) {
      diff.creates.push(block);
    } else if (Boolean(match.is_remote) !== block.is_remote) {
      diff.updates.push({ id: match.id, is_remote: block.is_remote });
    } else {
      diff.keepIds.push(match.id);
    }
  }

  for (const leftovers of available.values()) {
    diff.removeIds.push(...leftovers.map((block) => block.id));
  }

  return diff;
}

import { getOrgLocalMinutes } from './orgTime';
import { timeToMinutes } from './time';

/** Max minutes before shift start that still auto-match a schedule block on clock-in. */
export const EARLY_CLOCK_IN_WINDOW_MINUTES = 60;

export interface BlockCandidate {
  scheduleBlockId: number;
  startTime: string;
  endTime: string;
  clockInActual: string | null;
}

export function resolveNearestBlockFromMinutes(
  blocks: BlockCandidate[],
  referenceMinutes: number,
): BlockCandidate | null {
  const pending = blocks.filter((block) => !block.clockInActual);
  if (pending.length === 0) return null;

  const eligible = pending.filter((block) => {
    const start = timeToMinutes(block.startTime);
    const end = timeToMinutes(block.endTime);
    if (Number.isNaN(start) || Number.isNaN(end)) return false;
    return (
      referenceMinutes >= start - EARLY_CLOCK_IN_WINDOW_MINUTES &&
      referenceMinutes < end
    );
  });

  if (eligible.length === 0) return null;

  const inWindow = eligible.filter((block) => {
    const start = timeToMinutes(block.startTime);
    return referenceMinutes >= start;
  });

  const pool = inWindow.length > 0 ? inWindow : eligible;
  const useStartTieBreak = inWindow.length > 0;

  return pool.reduce<BlockCandidate | null>((best, block) => {
    const start = timeToMinutes(block.startTime);
    if (Number.isNaN(start)) return best;

    const dist = useStartTieBreak ? start : Math.abs(referenceMinutes - start);
    if (best === null) return block;

    const bestStart = timeToMinutes(best.startTime);
    const bestDist = useStartTieBreak ? bestStart : Math.abs(referenceMinutes - bestStart);

    return dist < bestDist ? block : best;
  }, null);
}

export function resolveNearestBlock(
  blocks: BlockCandidate[],
  now: Date = new Date(),
): BlockCandidate | null {
  return resolveNearestBlockFromMinutes(blocks, getOrgLocalMinutes(now));
}

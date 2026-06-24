import { timeToMinutes } from './time';

export interface BlockCandidate {
  scheduleBlockId: number;
  startTime: string;
  endTime: string;
  clockInActual: string | null;
}

export function resolveNearestBlock(
  blocks: BlockCandidate[],
  now: Date = new Date(),
): BlockCandidate | null {
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const pending = blocks.filter((block) => !block.clockInActual);
  if (pending.length === 0) return null;

  const inWindow = pending.filter((block) => {
    const start = timeToMinutes(block.startTime);
    const end = timeToMinutes(block.endTime);
    if (Number.isNaN(start) || Number.isNaN(end)) return false;
    return nowMin >= start && nowMin < end;
  });

  const pool = inWindow.length > 0 ? inWindow : pending;
  const useStartTieBreak = inWindow.length > 0;

  return pool.reduce<BlockCandidate | null>((best, block) => {
    const start = timeToMinutes(block.startTime);
    if (Number.isNaN(start)) return best;

    const dist = useStartTieBreak ? start : Math.abs(nowMin - start);
    if (best === null) return block;

    const bestStart = timeToMinutes(best.startTime);
    const bestDist = useStartTieBreak ? bestStart : Math.abs(nowMin - bestStart);

    return dist < bestDist ? block : best;
  }, null);
}

import { describe, it, expect } from 'vitest';
import { resolveNearestBlock, type BlockCandidate } from '../lib/resolveNearestBlock';

function block(
  id: number,
  startTime: string,
  endTime: string,
  clockInActual: string | null = null,
): BlockCandidate {
  return { scheduleBlockId: id, startTime, endTime, clockInActual };
}

describe('resolveNearestBlock', () => {
  const morning = block(1, '09:00', '12:00');
  const afternoon = block(2, '13:00', '16:00');

  it('returns the only pending block', () => {
    const now = new Date(2026, 5, 23, 10, 0);
    expect(resolveNearestBlock([morning], now)).toEqual(morning);
  });

  it('picks the in-window block when inside morning shift', () => {
    const now = new Date(2026, 5, 23, 10, 30);
    expect(resolveNearestBlock([morning, afternoon], now)).toEqual(morning);
  });

  it('picks the in-window block when inside afternoon shift', () => {
    const now = new Date(2026, 5, 23, 15, 0);
    expect(resolveNearestBlock([morning, afternoon], now)).toEqual(afternoon);
  });

  it('picks closest start when between shifts', () => {
    const now = new Date(2026, 5, 23, 12, 30);
    expect(resolveNearestBlock([morning, afternoon], now)).toEqual(afternoon);
  });

  it('picks closest start when arriving early', () => {
    const now = new Date(2026, 5, 23, 8, 45);
    expect(resolveNearestBlock([morning, afternoon], now)).toEqual(morning);
  });

  it('returns null when all blocks are already clocked in', () => {
    const now = new Date(2026, 5, 23, 10, 0);
    const clockedIn = block(1, '09:00', '12:00', '2026-06-23T09:00:00');
    expect(resolveNearestBlock([clockedIn], now)).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(resolveNearestBlock([])).toBeNull();
  });
});

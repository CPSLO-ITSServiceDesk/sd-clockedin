import { describe, it, expect } from 'vitest';
import {
  resolveNearestBlock,
  resolveNearestBlockFromMinutes,
  type BlockCandidate,
} from '../lib/resolveNearestBlock';

function block(
  id: number,
  startTime: string,
  endTime: string,
  clockInActual: string | null = null,
): BlockCandidate {
  return { scheduleBlockId: id, startTime, endTime, clockInActual };
}

/** Pacific wall-clock instants in June (PDT, UTC-7). */
const PT = {
  jun23_845am: new Date('2026-06-23T15:45:00.000Z'),
  jun23_10am: new Date('2026-06-23T17:00:00.000Z'),
  jun23_1030am: new Date('2026-06-23T17:30:00.000Z'),
  jun23_1230pm: new Date('2026-06-23T19:30:00.000Z'),
  jun23_3pm: new Date('2026-06-23T22:00:00.000Z'),
  jun25_820am: new Date('2026-06-25T15:20:00.000Z'),
  jun25_11am: new Date('2026-06-25T18:00:00.000Z'),
} as const;

describe('resolveNearestBlock', () => {
  const morning = block(1, '09:00', '12:00');
  const afternoon = block(2, '13:00', '16:00');
  const thursdayMorning = block(350, '08:00:00+00', '11:00:00+00');
  const thursdayAfternoon = block(357, '12:00:00+00', '17:00:00+00');

  it('returns the only pending block', () => {
    expect(resolveNearestBlock([morning], PT.jun23_10am)).toEqual(morning);
  });

  it('picks the in-window block when inside morning shift', () => {
    expect(resolveNearestBlock([morning, afternoon], PT.jun23_1030am)).toEqual(morning);
  });

  it('picks the in-window block when inside afternoon shift', () => {
    expect(resolveNearestBlock([morning, afternoon], PT.jun23_3pm)).toEqual(afternoon);
  });

  it('picks closest start when between shifts', () => {
    expect(resolveNearestBlock([morning, afternoon], PT.jun23_1230pm)).toEqual(afternoon);
  });

  it('picks closest start when arriving early', () => {
    expect(resolveNearestBlock([morning, afternoon], PT.jun23_845am)).toEqual(morning);
  });

  it('returns null when all blocks are already clocked in', () => {
    const clockedIn = block(1, '09:00', '12:00', '2026-06-23T16:00:00.000Z');
    expect(resolveNearestBlock([clockedIn], PT.jun23_10am)).toBeNull();
  });

  it('returns null for empty input', () => {
    expect(resolveNearestBlock([])).toBeNull();
  });

  it('returns null when clocking in too early for the only block', () => {
    const afternoonOnly = block(1, '12:00', '17:00');
    expect(resolveNearestBlock([afternoonOnly], PT.jun25_820am)).toBeNull();
  });

  it('matches an afternoon block when within the early-arrival window', () => {
    const afternoonOnly = block(1, '12:00', '17:00');
    expect(resolveNearestBlock([afternoonOnly], PT.jun25_11am)).toEqual(afternoonOnly);
  });

  it('picks morning 8-11 at 8:20 Pacific when student also has a 12-5 shift', () => {
    expect(
      resolveNearestBlock([thursdayMorning, thursdayAfternoon], PT.jun25_820am),
    ).toEqual(thursdayMorning);
  });
});

describe('resolveNearestBlockFromMinutes', () => {
  const morning = block(1, '09:00', '12:00');
  const afternoon = block(2, '13:00', '16:00');

  it('matches using minutes directly', () => {
    expect(resolveNearestBlockFromMinutes([morning], 9 * 60 + 30)).toEqual(morning);
  });

  it('returns null when reference minutes are too early', () => {
    expect(resolveNearestBlockFromMinutes([afternoon], 8 * 60 + 20)).toBeNull();
  });

  it('picks closest block when between shifts', () => {
    expect(resolveNearestBlockFromMinutes([morning, afternoon], 12 * 60 + 30)).toEqual(
      afternoon,
    );
  });
});

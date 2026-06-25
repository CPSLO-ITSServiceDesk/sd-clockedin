import { describe, it, expect } from 'vitest';
import {
  computeHistoricalShiftStatus,
  computeMinutesLate,
  computeRemoteShiftStatus,
  computeShiftStatus,
  ON_TIME_GRACE_MINUTES,
  toLocalDateString,
} from '../lib/shiftStatus';

/** Pacific wall-clock instants in June (PDT, UTC-7). */
const PT = {
  jun22_845am: new Date('2026-06-22T15:45:00.000Z'),
  jun22_830am: new Date('2026-06-22T15:30:00.000Z'),
  jun22_9am: new Date('2026-06-22T16:00:00.000Z'),
  jun22_930am: new Date('2026-06-22T16:30:00.000Z'),
  jun23_830am: new Date('2026-06-23T15:30:00.000Z'),
  jun23_10am: new Date('2026-06-23T17:00:00.000Z'),
  jun23_330pm: new Date('2026-06-23T22:30:00.000Z'),
  jun25_820am: new Date('2026-06-25T15:20:00.000Z'),
} as const;

describe('computeRemoteShiftStatus', () => {
  const startTime = '09:00';

  it('returns incoming before the remote shift starts', () => {
    expect(computeRemoteShiftStatus(startTime, PT.jun22_830am)).toBe('incoming');
  });

  it('returns expected once the remote shift has started', () => {
    expect(computeRemoteShiftStatus(startTime, PT.jun22_930am)).toBe('expected');
  });
});

describe('computeShiftStatus', () => {
  const startTime = '09:00';

  it('returns incoming when not clocked in and shift has not started', () => {
    expect(computeShiftStatus(startTime, null, PT.jun22_830am)).toBe('incoming');
  });

  it('returns absent when not clocked in and shift start has passed', () => {
    expect(computeShiftStatus(startTime, null, PT.jun22_930am)).toBe('absent');
  });

  it('returns early when clocked in before scheduled start', () => {
    expect(
      computeShiftStatus(startTime, '2026-06-22T15:45:00.000Z', PT.jun22_9am),
    ).toBe('early');
  });

  it('returns early when clocked in hours before a noon shift', () => {
    expect(
      computeShiftStatus(
        '12:00',
        '2026-06-25T15:20:00.000Z',
        PT.jun25_820am,
      ),
    ).toBe('early');
  });

  it('returns on-time when clocked in at scheduled start', () => {
    expect(
      computeShiftStatus(startTime, '2026-06-22T16:00:00.000Z', PT.jun22_9am),
    ).toBe('on-time');
  });

  it('returns on-time when clocked in within grace period', () => {
    const graceClockIn = `2026-06-22T16:0${ON_TIME_GRACE_MINUTES}:00.000Z`;
    expect(computeShiftStatus(startTime, graceClockIn, PT.jun22_930am)).toBe('on-time');
  });

  it('returns late when clocked in after grace period', () => {
    expect(
      computeShiftStatus(startTime, '2026-06-22T16:10:00.000Z', PT.jun22_930am),
    ).toBe('late');
  });
});

describe('computeHistoricalShiftStatus', () => {
  const startTime = '09:00';
  const now = PT.jun23_10am;

  it('skips future shift dates', () => {
    expect(
      computeHistoricalShiftStatus(startTime, null, '2026-06-24', now),
    ).toEqual({ status: 'skipped', minutesLate: 0 });
  });

  it('returns absent for past dates without clock-in', () => {
    expect(
      computeHistoricalShiftStatus(startTime, null, '2026-06-20', now),
    ).toEqual({ status: 'absent', minutesLate: 0 });
  });

  it('returns incoming for today before start without clock-in', () => {
    expect(
      computeHistoricalShiftStatus(startTime, null, '2026-06-23', PT.jun23_830am),
    ).toEqual({ status: 'incoming', minutesLate: 0 });
  });

  it('returns absent for today after start without clock-in', () => {
    expect(
      computeHistoricalShiftStatus(startTime, null, '2026-06-23', now),
    ).toEqual({ status: 'absent', minutesLate: 0 });
  });

  it('returns on-time within grace period', () => {
    expect(
      computeHistoricalShiftStatus(
        startTime,
        '2026-06-20T16:05:00.000Z',
        '2026-06-20',
        now,
      ),
    ).toEqual({ status: 'on-time', minutesLate: 0 });
  });

  it('returns late with minutesLate after grace period', () => {
    expect(
      computeHistoricalShiftStatus(
        startTime,
        '2026-06-20T16:10:00.000Z',
        '2026-06-20',
        now,
      ),
    ).toEqual({ status: 'late', minutesLate: 5 });
  });
});

describe('computeMinutesLate', () => {
  it('returns minutes beyond grace period', () => {
    expect(computeMinutesLate('09:00', '2026-06-20T16:10:00.000Z')).toBe(5);
    expect(computeMinutesLate('09:00', '2026-06-20T16:05:00.000Z')).toBe(0);
  });
});

describe('toLocalDateString', () => {
  it('formats organization calendar date', () => {
    expect(toLocalDateString(PT.jun23_330pm)).toBe('2026-06-23');
  });
});

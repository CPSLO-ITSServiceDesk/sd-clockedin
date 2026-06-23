import { describe, it, expect } from 'vitest';
import {
  computeHistoricalShiftStatus,
  computeMinutesLate,
  computeRemoteShiftStatus,
  computeShiftStatus,
  ON_TIME_GRACE_MINUTES,
  toLocalDateString,
} from '../lib/shiftStatus';

describe('computeRemoteShiftStatus', () => {
  const startTime = '09:00';
  const beforeStart = new Date(2026, 5, 22, 8, 30);
  const afterStart = new Date(2026, 5, 22, 9, 30);

  it('returns incoming before the remote shift starts', () => {
    expect(computeRemoteShiftStatus(startTime, beforeStart)).toBe('incoming');
  });

  it('returns expected once the remote shift has started', () => {
    expect(computeRemoteShiftStatus(startTime, afterStart)).toBe('expected');
  });
});

describe('computeShiftStatus', () => {
  const startTime = '09:00';
  const beforeStart = new Date(2026, 5, 22, 8, 30);
  const atStart = new Date(2026, 5, 22, 9, 0);
  const afterStart = new Date(2026, 5, 22, 9, 30);

  it('returns incoming when not clocked in and shift has not started', () => {
    expect(computeShiftStatus(startTime, null, beforeStart)).toBe('incoming');
  });

  it('returns absent when not clocked in and shift start has passed', () => {
    expect(computeShiftStatus(startTime, null, afterStart)).toBe('absent');
  });

  it('returns early when clocked in before scheduled start', () => {
    expect(computeShiftStatus(startTime, '2026-06-22T08:45:00', atStart)).toBe('early');
  });

  it('returns on-time when clocked in at scheduled start', () => {
    expect(computeShiftStatus(startTime, '2026-06-22T09:00:00', atStart)).toBe('on-time');
  });

  it('returns on-time when clocked in within grace period', () => {
    const graceClockIn = `2026-06-22T09:0${ON_TIME_GRACE_MINUTES}:00`;
    expect(computeShiftStatus(startTime, graceClockIn, afterStart)).toBe('on-time');
  });

  it('returns late when clocked in after grace period', () => {
    expect(computeShiftStatus(startTime, '2026-06-22T09:10:00', afterStart)).toBe('late');
  });
});

describe('computeHistoricalShiftStatus', () => {
  const startTime = '09:00';
  const now = new Date(2026, 5, 23, 10, 0);

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
    const morning = new Date(2026, 5, 23, 8, 30);
    expect(
      computeHistoricalShiftStatus(startTime, null, '2026-06-23', morning),
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
        '2026-06-20T09:05:00',
        '2026-06-20',
        now,
      ),
    ).toEqual({ status: 'on-time', minutesLate: 0 });
  });

  it('returns late with minutesLate after grace period', () => {
    expect(
      computeHistoricalShiftStatus(
        startTime,
        '2026-06-20T09:10:00',
        '2026-06-20',
        now,
      ),
    ).toEqual({ status: 'late', minutesLate: 5 });
  });
});

describe('computeMinutesLate', () => {
  it('returns minutes beyond grace period', () => {
    expect(computeMinutesLate('09:00', '2026-06-20T09:10:00')).toBe(5);
    expect(computeMinutesLate('09:00', '2026-06-20T09:05:00')).toBe(0);
  });
});

describe('toLocalDateString', () => {
  it('formats local calendar date', () => {
    expect(toLocalDateString(new Date(2026, 5, 23, 15, 30))).toBe('2026-06-23');
  });
});

import { describe, it, expect } from 'vitest';
import { computeShiftStatus, ON_TIME_GRACE_MINUTES } from '../lib/shiftStatus';

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

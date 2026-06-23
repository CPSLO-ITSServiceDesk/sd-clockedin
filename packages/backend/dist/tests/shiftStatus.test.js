"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const shiftStatus_1 = require("../lib/shiftStatus");
(0, vitest_1.describe)('computeRemoteShiftStatus', () => {
    const startTime = '09:00';
    const beforeStart = new Date(2026, 5, 22, 8, 30);
    const afterStart = new Date(2026, 5, 22, 9, 30);
    (0, vitest_1.it)('returns incoming before the remote shift starts', () => {
        (0, vitest_1.expect)((0, shiftStatus_1.computeRemoteShiftStatus)(startTime, beforeStart)).toBe('incoming');
    });
    (0, vitest_1.it)('returns expected once the remote shift has started', () => {
        (0, vitest_1.expect)((0, shiftStatus_1.computeRemoteShiftStatus)(startTime, afterStart)).toBe('expected');
    });
});
(0, vitest_1.describe)('computeShiftStatus', () => {
    const startTime = '09:00';
    const beforeStart = new Date(2026, 5, 22, 8, 30);
    const atStart = new Date(2026, 5, 22, 9, 0);
    const afterStart = new Date(2026, 5, 22, 9, 30);
    (0, vitest_1.it)('returns incoming when not clocked in and shift has not started', () => {
        (0, vitest_1.expect)((0, shiftStatus_1.computeShiftStatus)(startTime, null, beforeStart)).toBe('incoming');
    });
    (0, vitest_1.it)('returns absent when not clocked in and shift start has passed', () => {
        (0, vitest_1.expect)((0, shiftStatus_1.computeShiftStatus)(startTime, null, afterStart)).toBe('absent');
    });
    (0, vitest_1.it)('returns early when clocked in before scheduled start', () => {
        (0, vitest_1.expect)((0, shiftStatus_1.computeShiftStatus)(startTime, '2026-06-22T08:45:00', atStart)).toBe('early');
    });
    (0, vitest_1.it)('returns on-time when clocked in at scheduled start', () => {
        (0, vitest_1.expect)((0, shiftStatus_1.computeShiftStatus)(startTime, '2026-06-22T09:00:00', atStart)).toBe('on-time');
    });
    (0, vitest_1.it)('returns on-time when clocked in within grace period', () => {
        const graceClockIn = `2026-06-22T09:0${shiftStatus_1.ON_TIME_GRACE_MINUTES}:00`;
        (0, vitest_1.expect)((0, shiftStatus_1.computeShiftStatus)(startTime, graceClockIn, afterStart)).toBe('on-time');
    });
    (0, vitest_1.it)('returns late when clocked in after grace period', () => {
        (0, vitest_1.expect)((0, shiftStatus_1.computeShiftStatus)(startTime, '2026-06-22T09:10:00', afterStart)).toBe('late');
    });
});
(0, vitest_1.describe)('computeHistoricalShiftStatus', () => {
    const startTime = '09:00';
    const now = new Date(2026, 5, 23, 10, 0);
    (0, vitest_1.it)('skips future shift dates', () => {
        (0, vitest_1.expect)((0, shiftStatus_1.computeHistoricalShiftStatus)(startTime, null, '2026-06-24', now)).toEqual({ status: 'skipped', minutesLate: 0 });
    });
    (0, vitest_1.it)('returns absent for past dates without clock-in', () => {
        (0, vitest_1.expect)((0, shiftStatus_1.computeHistoricalShiftStatus)(startTime, null, '2026-06-20', now)).toEqual({ status: 'absent', minutesLate: 0 });
    });
    (0, vitest_1.it)('returns incoming for today before start without clock-in', () => {
        const morning = new Date(2026, 5, 23, 8, 30);
        (0, vitest_1.expect)((0, shiftStatus_1.computeHistoricalShiftStatus)(startTime, null, '2026-06-23', morning)).toEqual({ status: 'incoming', minutesLate: 0 });
    });
    (0, vitest_1.it)('returns absent for today after start without clock-in', () => {
        (0, vitest_1.expect)((0, shiftStatus_1.computeHistoricalShiftStatus)(startTime, null, '2026-06-23', now)).toEqual({ status: 'absent', minutesLate: 0 });
    });
    (0, vitest_1.it)('returns on-time within grace period', () => {
        (0, vitest_1.expect)((0, shiftStatus_1.computeHistoricalShiftStatus)(startTime, '2026-06-20T09:05:00', '2026-06-20', now)).toEqual({ status: 'on-time', minutesLate: 0 });
    });
    (0, vitest_1.it)('returns late with minutesLate after grace period', () => {
        (0, vitest_1.expect)((0, shiftStatus_1.computeHistoricalShiftStatus)(startTime, '2026-06-20T09:10:00', '2026-06-20', now)).toEqual({ status: 'late', minutesLate: 5 });
    });
});
(0, vitest_1.describe)('computeMinutesLate', () => {
    (0, vitest_1.it)('returns minutes beyond grace period', () => {
        (0, vitest_1.expect)((0, shiftStatus_1.computeMinutesLate)('09:00', '2026-06-20T09:10:00')).toBe(5);
        (0, vitest_1.expect)((0, shiftStatus_1.computeMinutesLate)('09:00', '2026-06-20T09:05:00')).toBe(0);
    });
});
(0, vitest_1.describe)('toLocalDateString', () => {
    (0, vitest_1.it)('formats local calendar date', () => {
        (0, vitest_1.expect)((0, shiftStatus_1.toLocalDateString)(new Date(2026, 5, 23, 15, 30))).toBe('2026-06-23');
    });
});

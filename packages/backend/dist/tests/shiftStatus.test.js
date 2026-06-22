"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const shiftStatus_1 = require("../lib/shiftStatus");
(0, vitest_1.describe)('computeShiftStatus', () => {
    const startTime = '09:00';
    const beforeStart = new Date(2026, 5, 22, 8, 30);
    const atStart = new Date(2026, 5, 22, 9, 0);
    const afterStart = new Date(2026, 5, 22, 9, 30);
    (0, vitest_1.it)('returns incoming when not clocked in and shift has not started', () => {
        (0, vitest_1.expect)((0, shiftStatus_1.computeShiftStatus)(startTime, null, beforeStart)).toBe('incoming');
    });
    (0, vitest_1.it)('returns late when not clocked in and shift start has passed', () => {
        (0, vitest_1.expect)((0, shiftStatus_1.computeShiftStatus)(startTime, null, afterStart)).toBe('late');
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

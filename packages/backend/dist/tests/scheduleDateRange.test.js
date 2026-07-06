"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const scheduleDateRange_1 = require("../lib/scheduleDateRange");
const term = {
    start_date: '2026-06-14',
    end_date: '2026-08-24',
};
(0, vitest_1.describe)('getEffectiveScheduleDateRange', () => {
    (0, vitest_1.it)('falls back to term dates when overrides are null', () => {
        (0, vitest_1.expect)((0, scheduleDateRange_1.getEffectiveScheduleDateRange)({ start_date: null, end_date: null }, term)).toEqual({
            startDate: '2026-06-14',
            endDate: '2026-08-24',
        });
    });
    (0, vitest_1.it)('uses schedule overrides within the term', () => {
        (0, vitest_1.expect)((0, scheduleDateRange_1.getEffectiveScheduleDateRange)({ start_date: '2026-06-18', end_date: '2026-07-24' }, term)).toEqual({
            startDate: '2026-06-18',
            endDate: '2026-07-24',
        });
    });
    (0, vitest_1.it)('clamps overrides that exceed the term bounds', () => {
        (0, vitest_1.expect)((0, scheduleDateRange_1.getEffectiveScheduleDateRange)({ start_date: '2026-06-01', end_date: '2026-09-01' }, term)).toEqual({
            startDate: '2026-06-14',
            endDate: '2026-08-24',
        });
    });
});
(0, vitest_1.describe)('isDateInEffectiveScheduleRange', () => {
    (0, vitest_1.it)('returns false for dates outside the effective range', () => {
        const schedule = { start_date: '2026-06-18', end_date: '2026-07-24' };
        (0, vitest_1.expect)((0, scheduleDateRange_1.isDateInEffectiveScheduleRange)('2026-06-16', schedule, term)).toBe(false);
        (0, vitest_1.expect)((0, scheduleDateRange_1.isDateInEffectiveScheduleRange)('2026-06-18', schedule, term)).toBe(true);
        (0, vitest_1.expect)((0, scheduleDateRange_1.isDateInEffectiveScheduleRange)('2026-07-24', schedule, term)).toBe(true);
        (0, vitest_1.expect)((0, scheduleDateRange_1.isDateInEffectiveScheduleRange)('2026-07-28', schedule, term)).toBe(false);
    });
});

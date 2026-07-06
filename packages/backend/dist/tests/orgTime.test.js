"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const orgTime_1 = require("../lib/orgTime");
(0, vitest_1.describe)('orgTime', () => {
    // 8:20 AM PDT on Thu Jun 25, 2026
    const pacificMorning = new Date('2026-06-25T15:20:20.061Z');
    (0, vitest_1.it)('uses organization timezone for minutes, not server timezone', () => {
        (0, vitest_1.expect)((0, orgTime_1.getOrgLocalMinutes)(pacificMorning)).toBe(8 * 60 + 20);
    });
    (0, vitest_1.it)('uses organization timezone for calendar date', () => {
        (0, vitest_1.expect)((0, orgTime_1.getOrgLocalDateString)(pacificMorning)).toBe('2026-06-25');
    });
    (0, vitest_1.it)('uses organization timezone for weekday', () => {
        (0, vitest_1.expect)((0, orgTime_1.getOrgDayOfWeek)(pacificMorning)).toBe(4);
    });
});
(0, vitest_1.describe)('getOrgLocalCutoffInstant', () => {
    (0, vitest_1.it)('returns 5 PM PDT as UTC midnight next calendar day', () => {
        const duringDay = new Date('2026-06-25T15:20:20.061Z');
        const cutoff = (0, orgTime_1.getOrgLocalCutoffInstant)(duringDay, 17, 0);
        (0, vitest_1.expect)(cutoff.toISOString()).toBe('2026-06-26T00:00:00.000Z');
    });
    (0, vitest_1.it)('returns 5 PM PST as UTC 1 AM next calendar day', () => {
        const duringDay = new Date('2026-01-15T20:00:00.000Z');
        const cutoff = (0, orgTime_1.getOrgLocalCutoffInstant)(duringDay, 17, 0);
        (0, vitest_1.expect)(cutoff.toISOString()).toBe('2026-01-16T01:00:00.000Z');
    });
});

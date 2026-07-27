"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const orgTime_1 = require("../lib/orgTime");
(0, vitest_1.describe)('isValidOrgLocalDateString', () => {
    (0, vitest_1.it)('accepts real calendar dates', () => {
        (0, vitest_1.expect)((0, orgTime_1.isValidOrgLocalDateString)('2026-06-25')).toBe(true);
        (0, vitest_1.expect)((0, orgTime_1.isValidOrgLocalDateString)('2024-02-29')).toBe(true);
    });
    (0, vitest_1.it)('rejects invalid formats and non-dates', () => {
        (0, vitest_1.expect)((0, orgTime_1.isValidOrgLocalDateString)('06-25-2026')).toBe(false);
        (0, vitest_1.expect)((0, orgTime_1.isValidOrgLocalDateString)('2026-6-25')).toBe(false);
        (0, vitest_1.expect)((0, orgTime_1.isValidOrgLocalDateString)('2026-02-30')).toBe(false);
        (0, vitest_1.expect)((0, orgTime_1.isValidOrgLocalDateString)('not-a-date')).toBe(false);
    });
});
(0, vitest_1.describe)('resolveShiftsReferenceNow', () => {
    // 8:20 AM PDT on Thu Jun 25, 2026
    const now = new Date('2026-06-25T15:20:20.061Z');
    (0, vitest_1.it)('returns live clock when date is omitted', () => {
        (0, vitest_1.expect)((0, orgTime_1.resolveShiftsReferenceNow)(undefined, now)).toBe(now);
    });
    (0, vitest_1.it)('returns live clock when date is today', () => {
        (0, vitest_1.expect)((0, orgTime_1.resolveShiftsReferenceNow)('2026-06-25', now)).toBe(now);
    });
    (0, vitest_1.it)('returns 4 PM org-local for a past date', () => {
        const resolved = (0, orgTime_1.resolveShiftsReferenceNow)('2026-06-24', now);
        (0, vitest_1.expect)((0, orgTime_1.getOrgLocalDateString)(resolved)).toBe('2026-06-24');
        (0, vitest_1.expect)((0, orgTime_1.getOrgLocalMinutes)(resolved)).toBe(16 * 60);
    });
    (0, vitest_1.it)('returns midnight org-local for a future date', () => {
        const resolved = (0, orgTime_1.resolveShiftsReferenceNow)('2026-06-26', now);
        (0, vitest_1.expect)((0, orgTime_1.getOrgLocalDateString)(resolved)).toBe('2026-06-26');
        (0, vitest_1.expect)((0, orgTime_1.getOrgLocalMinutes)(resolved)).toBe(0);
    });
});

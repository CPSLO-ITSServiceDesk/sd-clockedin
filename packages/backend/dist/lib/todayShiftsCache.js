"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.invalidateTodayShiftsCache = invalidateTodayShiftsCache;
exports.invalidateTodayShiftsCacheForNow = invalidateTodayShiftsCacheForNow;
exports.withTodayShiftsCache = withTodayShiftsCache;
const cache_1 = require("./cache");
const shiftStatus_1 = require("./shiftStatus");
// Short enough that the 30s frontend poll never serves data older than one
// cycle, but long enough to absorb bursts from multiple concurrent viewers.
const TODAY_SHIFTS_CACHE_TTL_SECONDS = 15;
function todayShiftsCacheKey(date, includeRemote) {
    return `today-shifts:${date}:${includeRemote ? '1' : '0'}`;
}
/** Call after any mutation that can change the shift board for `date`. */
async function invalidateTodayShiftsCache(date) {
    await (0, cache_1.invalidateCache)(todayShiftsCacheKey(date, false), todayShiftsCacheKey(date, true));
}
/** Invalidate today's board (org-local date). */
async function invalidateTodayShiftsCacheForNow(now = new Date()) {
    await invalidateTodayShiftsCache((0, shiftStatus_1.toLocalDateString)(now));
}
async function withTodayShiftsCache(date, includeRemote, fn) {
    return (0, cache_1.withCache)(todayShiftsCacheKey(date, includeRemote), TODAY_SHIFTS_CACHE_TTL_SECONDS, fn);
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ON_TIME_GRACE_MINUTES = exports.ARRIVAL_WINDOW_MINUTES = void 0;
exports.computeRemoteShiftStatus = computeRemoteShiftStatus;
exports.computeShiftStatus = computeShiftStatus;
exports.toLocalDateString = toLocalDateString;
exports.addLocalDays = addLocalDays;
exports.isLocalDateInRange = isLocalDateInRange;
exports.getClockInDate = getClockInDate;
exports.computeMinutesLate = computeMinutesLate;
exports.computeHistoricalShiftStatus = computeHistoricalShiftStatus;
const orgTime_1 = require("./orgTime");
const time_1 = require("./time");
/** Minutes before/after scheduled start that still count as on-time. */
exports.ARRIVAL_WINDOW_MINUTES = 10;
/** @deprecated Use ARRIVAL_WINDOW_MINUTES */
exports.ON_TIME_GRACE_MINUTES = exports.ARRIVAL_WINDOW_MINUTES;
function computeRemoteShiftStatus(scheduledStartTime, now = new Date()) {
    const startMinutes = (0, time_1.timeToMinutes)(scheduledStartTime);
    if (Number.isNaN(startMinutes)) {
        return 'expected';
    }
    const nowMinutes = (0, orgTime_1.getOrgLocalMinutes)(now);
    if (nowMinutes < startMinutes) {
        return 'incoming';
    }
    return 'expected';
}
function computeShiftStatus(scheduledStartTime, clockIn, now = new Date()) {
    const startMinutes = (0, time_1.timeToMinutes)(scheduledStartTime);
    if (Number.isNaN(startMinutes)) {
        return 'incoming';
    }
    const nowMinutes = (0, orgTime_1.getOrgLocalMinutes)(now);
    if (!clockIn) {
        return isWithinArrivalWindow(startMinutes, nowMinutes) ? 'incoming' : 'absent';
    }
    const clockInMinutes = (0, time_1.timeToMinutes)(clockIn);
    if (Number.isNaN(clockInMinutes)) {
        return isWithinArrivalWindow(startMinutes, nowMinutes) ? 'incoming' : 'absent';
    }
    return evaluateClockedInStatus(startMinutes, clockInMinutes);
}
function evaluateClockedInStatus(startMinutes, clockInMinutes) {
    if (clockInMinutes < startMinutes - exports.ARRIVAL_WINDOW_MINUTES) {
        return 'early';
    }
    if (clockInMinutes <= startMinutes + exports.ARRIVAL_WINDOW_MINUTES) {
        return 'on-time';
    }
    return 'late';
}
function isWithinArrivalWindow(startMinutes, nowMinutes) {
    return nowMinutes <= startMinutes + exports.ARRIVAL_WINDOW_MINUTES;
}
/** Format a Date as YYYY-MM-DD in the organization timezone. */
function toLocalDateString(date) {
    return (0, orgTime_1.getOrgLocalDateString)(date);
}
/** Shift a YYYY-MM-DD local date by a number of days. */
function addLocalDays(dateStr, delta) {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + delta);
    return toLocalDateString(date);
}
/** True when dateKey falls in [startDate, endDateExclusive). */
function isLocalDateInRange(dateKey, startDate, endDateExclusive) {
    return dateKey >= startDate && dateKey < endDateExclusive;
}
/** Extract the local calendar date from a clock-in timestamp. */
function getClockInDate(clockIn) {
    if (!clockIn)
        return null;
    if (clockIn.includes('T')) {
        const date = new Date(clockIn);
        if (Number.isNaN(date.getTime()))
            return null;
        return toLocalDateString(date);
    }
    return null;
}
function computeMinutesLate(scheduledStartTime, clockIn) {
    const startMinutes = (0, time_1.timeToMinutes)(scheduledStartTime);
    const clockInMinutes = (0, time_1.timeToMinutes)(clockIn);
    if (Number.isNaN(startMinutes) || Number.isNaN(clockInMinutes)) {
        return 0;
    }
    const lateBy = clockInMinutes - startMinutes - exports.ARRIVAL_WINDOW_MINUTES;
    return lateBy > 0 ? lateBy : 0;
}
/**
 * Evaluate punctuality for a scheduled in-person shift on a specific date.
 * Returns `skipped` for future dates; `incoming` for today before start with no clock-in.
 */
function computeHistoricalShiftStatus(scheduledStartTime, clockIn, shiftDate, now = new Date()) {
    const today = (0, orgTime_1.getOrgLocalDateString)(now);
    if (shiftDate > today) {
        return { status: 'skipped', minutesLate: 0 };
    }
    const startMinutes = (0, time_1.timeToMinutes)(scheduledStartTime);
    if (Number.isNaN(startMinutes)) {
        return { status: 'skipped', minutesLate: 0 };
    }
    if (!clockIn) {
        if (shiftDate < today) {
            return { status: 'absent', minutesLate: 0 };
        }
        const nowMinutes = (0, orgTime_1.getOrgLocalMinutes)(now);
        if (isWithinArrivalWindow(startMinutes, nowMinutes)) {
            return { status: 'incoming', minutesLate: 0 };
        }
        return { status: 'absent', minutesLate: 0 };
    }
    const clockInMinutes = (0, time_1.timeToMinutes)(clockIn);
    if (Number.isNaN(clockInMinutes)) {
        if (shiftDate < today) {
            return { status: 'absent', minutesLate: 0 };
        }
        const nowMinutes = (0, orgTime_1.getOrgLocalMinutes)(now);
        if (isWithinArrivalWindow(startMinutes, nowMinutes)) {
            return { status: 'incoming', minutesLate: 0 };
        }
        return { status: 'absent', minutesLate: 0 };
    }
    const status = evaluateClockedInStatus(startMinutes, clockInMinutes);
    return {
        status,
        minutesLate: status === 'late'
            ? computeMinutesLate(scheduledStartTime, clockIn)
            : 0,
    };
}

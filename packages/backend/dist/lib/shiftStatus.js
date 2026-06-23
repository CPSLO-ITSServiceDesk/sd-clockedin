"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ON_TIME_GRACE_MINUTES = void 0;
exports.computeRemoteShiftStatus = computeRemoteShiftStatus;
exports.computeShiftStatus = computeShiftStatus;
exports.toLocalDateString = toLocalDateString;
exports.getClockInDate = getClockInDate;
exports.computeMinutesLate = computeMinutesLate;
exports.computeHistoricalShiftStatus = computeHistoricalShiftStatus;
const time_1 = require("./time");
/** Minutes after scheduled start that still count as on-time. */
exports.ON_TIME_GRACE_MINUTES = 5;
function computeRemoteShiftStatus(scheduledStartTime, now = new Date()) {
    const startMinutes = (0, time_1.timeToMinutes)(scheduledStartTime);
    if (Number.isNaN(startMinutes)) {
        return 'expected';
    }
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
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
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    if (!clockIn) {
        return nowMinutes < startMinutes ? 'incoming' : 'absent';
    }
    const clockInMinutes = (0, time_1.timeToMinutes)(clockIn);
    if (Number.isNaN(clockInMinutes)) {
        return nowMinutes < startMinutes ? 'incoming' : 'absent';
    }
    if (clockInMinutes < startMinutes) {
        return 'early';
    }
    if (clockInMinutes <= startMinutes + exports.ON_TIME_GRACE_MINUTES) {
        return 'on-time';
    }
    return 'late';
}
/** Format a Date as YYYY-MM-DD in local time. */
function toLocalDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
    const lateBy = clockInMinutes - startMinutes - exports.ON_TIME_GRACE_MINUTES;
    return lateBy > 0 ? lateBy : 0;
}
/**
 * Evaluate punctuality for a scheduled in-person shift on a specific date.
 * Returns `skipped` for future dates; `incoming` for today before start with no clock-in.
 */
function computeHistoricalShiftStatus(scheduledStartTime, clockIn, shiftDate, now = new Date()) {
    const today = toLocalDateString(now);
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
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        if (nowMinutes < startMinutes) {
            return { status: 'incoming', minutesLate: 0 };
        }
        return { status: 'absent', minutesLate: 0 };
    }
    const clockInMinutes = (0, time_1.timeToMinutes)(clockIn);
    if (Number.isNaN(clockInMinutes)) {
        if (shiftDate < today) {
            return { status: 'absent', minutesLate: 0 };
        }
        const nowMinutes = now.getHours() * 60 + now.getMinutes();
        if (nowMinutes < startMinutes) {
            return { status: 'incoming', minutesLate: 0 };
        }
        return { status: 'absent', minutesLate: 0 };
    }
    if (clockInMinutes < startMinutes) {
        return { status: 'early', minutesLate: 0 };
    }
    if (clockInMinutes <= startMinutes + exports.ON_TIME_GRACE_MINUTES) {
        return { status: 'on-time', minutesLate: 0 };
    }
    return {
        status: 'late',
        minutesLate: computeMinutesLate(scheduledStartTime, clockIn),
    };
}

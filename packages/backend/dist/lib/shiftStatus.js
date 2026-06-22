"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ON_TIME_GRACE_MINUTES = void 0;
exports.computeShiftStatus = computeShiftStatus;
const time_1 = require("./time");
/** Minutes after scheduled start that still count as on-time. */
exports.ON_TIME_GRACE_MINUTES = 5;
function computeShiftStatus(scheduledStartTime, clockIn, now = new Date()) {
    const startMinutes = (0, time_1.timeToMinutes)(scheduledStartTime);
    if (Number.isNaN(startMinutes)) {
        return 'incoming';
    }
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    if (!clockIn) {
        return nowMinutes < startMinutes ? 'incoming' : 'late';
    }
    const clockInMinutes = (0, time_1.timeToMinutes)(clockIn);
    if (Number.isNaN(clockInMinutes)) {
        return nowMinutes < startMinutes ? 'incoming' : 'late';
    }
    if (clockInMinutes < startMinutes) {
        return 'early';
    }
    if (clockInMinutes <= startMinutes + exports.ON_TIME_GRACE_MINUTES) {
        return 'on-time';
    }
    return 'late';
}

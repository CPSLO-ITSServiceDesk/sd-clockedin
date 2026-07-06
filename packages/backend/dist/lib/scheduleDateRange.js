"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEffectiveScheduleDateRange = getEffectiveScheduleDateRange;
exports.isDateInEffectiveScheduleRange = isDateInEffectiveScheduleRange;
function getEffectiveScheduleDateRange(schedule, term) {
    if (!term.start_date || !term.end_date) {
        return null;
    }
    const startDate = schedule.start_date ?? term.start_date;
    const endDate = schedule.end_date ?? term.end_date;
    const clampedStart = startDate < term.start_date ? term.start_date : startDate;
    const clampedEnd = endDate > term.end_date ? term.end_date : endDate;
    if (clampedStart > clampedEnd) {
        return null;
    }
    return { startDate: clampedStart, endDate: clampedEnd };
}
function isDateInEffectiveScheduleRange(date, schedule, term) {
    const range = getEffectiveScheduleDateRange(schedule, term);
    if (!range)
        return false;
    return date >= range.startDate && date <= range.endDate;
}

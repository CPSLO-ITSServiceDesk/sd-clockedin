"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.expandEvaluatedShifts = expandEvaluatedShifts;
exports.buildTermAnalytics = buildTermAnalytics;
exports.buildStudentAnalytics = buildStudentAnalytics;
const scheduleDateRange_1 = require("./scheduleDateRange");
const time_1 = require("./time");
const shiftStatus_1 = require("./shiftStatus");
const WEEKDAY_DAYS = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
];
function parseOffDays(term) {
    if (!term.off_days || typeof term.off_days !== 'object' || Array.isArray(term.off_days)) {
        return null;
    }
    return term.off_days;
}
function isVacationDay(date, offDays) {
    return offDays?.vacations?.some((vacation) => vacation.date === date) ?? false;
}
function getWeekdayForDate(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const weekday = date.getDay();
    if (weekday === 0 || weekday === 6)
        return null;
    return WEEKDAY_DAYS[weekday - 1];
}
function* iterateDates(startDate, endDate) {
    const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
    const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
    const current = new Date(startYear, startMonth - 1, startDay);
    const end = new Date(endYear, endMonth - 1, endDay);
    while (current <= end) {
        yield (0, shiftStatus_1.toLocalDateString)(current);
        current.setDate(current.getDate() + 1);
    }
}
function getEntryDate(entry) {
    const fromClockIn = (0, shiftStatus_1.getClockInDate)(entry.clock_in);
    if (fromClockIn)
        return fromClockIn;
    if (entry.created_at?.includes('T')) {
        return (0, shiftStatus_1.toLocalDateString)(new Date(entry.created_at));
    }
    return entry.created_at?.slice(0, 10) ?? null;
}
function buildTimeEntryMap(timeEntries) {
    const map = new Map();
    for (const entry of timeEntries) {
        if (entry.schedule_block_id == null || entry.student_assistant_id == null) {
            continue;
        }
        const date = getEntryDate(entry);
        if (!date)
            continue;
        const key = `${entry.schedule_block_id}-${entry.student_assistant_id}-${date}`;
        map.set(key, entry);
    }
    return map;
}
function emptySummary() {
    return {
        totalEvaluated: 0,
        onTime: 0,
        early: 0,
        late: 0,
        absent: 0,
        onTimeRate: 0,
        punctualityRate: 0,
        avgMinutesLate: 0,
    };
}
function summarizeShifts(shifts) {
    if (shifts.length === 0) {
        return emptySummary();
    }
    const onTime = shifts.filter((shift) => shift.status === 'on-time').length;
    const early = shifts.filter((shift) => shift.status === 'early').length;
    const late = shifts.filter((shift) => shift.status === 'late').length;
    const absent = shifts.filter((shift) => shift.status === 'absent').length;
    const totalEvaluated = shifts.length;
    const lateShifts = shifts.filter((shift) => shift.status === 'late');
    const avgMinutesLate = lateShifts.length > 0
        ? lateShifts.reduce((sum, shift) => sum + shift.minutesLate, 0) / lateShifts.length
        : 0;
    return {
        totalEvaluated,
        onTime,
        early,
        late,
        absent,
        onTimeRate: onTime / totalEvaluated,
        punctualityRate: (onTime + early) / totalEvaluated,
        avgMinutesLate: Math.round(avgMinutesLate * 10) / 10,
    };
}
function aggregateLateByTimeSlot(shifts) {
    const slotMap = new Map();
    for (const shift of shifts) {
        const startTime = (0, time_1.normalizeTimeKey)(shift.startTime);
        const current = slotMap.get(startTime) ?? { late: 0, total: 0 };
        current.total += 1;
        if (shift.status === 'late') {
            current.late += 1;
        }
        slotMap.set(startTime, current);
    }
    return [...slotMap.entries()]
        .map(([startTime, counts]) => ({
        startTime,
        lateCount: counts.late,
        totalShifts: counts.total,
        lateRate: counts.total > 0 ? counts.late / counts.total : 0,
    }))
        .sort((a, b) => a.startTime.localeCompare(b.startTime));
}
const WEEKDAY_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
function aggregateWeekdayPatterns(shifts) {
    const map = new Map(WEEKDAY_ORDER.map((day) => [day, { late: 0, absent: 0, total: 0 }]));
    for (const shift of shifts) {
        const current = map.get(shift.day);
        if (!current)
            continue;
        current.total += 1;
        if (shift.status === 'late')
            current.late += 1;
        if (shift.status === 'absent')
            current.absent += 1;
    }
    return WEEKDAY_ORDER.map((day) => ({
        day,
        ...map.get(day),
    }));
}
function aggregateLateLeaderboard(shifts) {
    const map = new Map();
    for (const shift of shifts) {
        const current = map.get(shift.studentAssistantId) ?? { late: 0, absent: 0, total: 0 };
        current.total += 1;
        if (shift.status === 'late')
            current.late += 1;
        if (shift.status === 'absent')
            current.absent += 1;
        map.set(shift.studentAssistantId, current);
    }
    return [...map.entries()]
        .map(([studentAssistantId, counts]) => ({
        studentAssistantId,
        ...counts,
    }))
        .sort((a, b) => b.late - a.late || b.absent - a.absent)
        .slice(0, 5);
}
function aggregateDailyTrend(shifts) {
    const dayMap = new Map();
    for (const shift of shifts) {
        const current = dayMap.get(shift.date) ?? {
            date: shift.date,
            punctual: 0,
            late: 0,
            absent: 0,
        };
        if (shift.status === 'on-time' || shift.status === 'early') {
            current.punctual += 1;
        }
        else if (shift.status === 'late') {
            current.late += 1;
        }
        else if (shift.status === 'absent') {
            current.absent += 1;
        }
        dayMap.set(shift.date, current);
    }
    return [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date));
}
function expandEvaluatedShifts(term, schedules, scheduleBlocks, timeEntries, options = {}) {
    if (!term.start_date || !term.end_date) {
        return [];
    }
    const now = options.now ?? new Date();
    const today = (0, shiftStatus_1.toLocalDateString)(now);
    const offDays = parseOffDays(term);
    const termSchedules = schedules.filter((schedule) => schedule.academic_term_id === term.id);
    if (termSchedules.length === 0) {
        return [];
    }
    const scheduleMap = new Map(termSchedules.map((schedule) => [schedule.id, schedule]));
    const inPersonBlocks = scheduleBlocks.filter((block) => {
        if (block.is_remote || block.schedule_id == null)
            return false;
        return scheduleMap.has(block.schedule_id);
    });
    const timeEntryMap = buildTimeEntryMap(timeEntries);
    const evaluated = [];
    for (const block of inPersonBlocks) {
        if (!block.days || !block.start_time || !block.end_time || block.schedule_id == null) {
            continue;
        }
        const schedule = scheduleMap.get(block.schedule_id);
        if (!schedule?.student_assistant_id)
            continue;
        if (options.studentAssistantId != null &&
            schedule.student_assistant_id !== options.studentAssistantId) {
            continue;
        }
        const range = (0, scheduleDateRange_1.getEffectiveScheduleDateRange)(schedule, term);
        if (!range)
            continue;
        for (const date of iterateDates(range.startDate, range.endDate)) {
            if (date > today)
                continue;
            if (isVacationDay(date, offDays))
                continue;
            const weekday = getWeekdayForDate(date);
            if (weekday !== block.days)
                continue;
            const entryKey = `${block.id}-${schedule.student_assistant_id}-${date}`;
            const entry = timeEntryMap.get(entryKey) ?? null;
            const clockIn = entry?.clock_in ?? null;
            const result = (0, shiftStatus_1.computeHistoricalShiftStatus)(block.start_time, clockIn, date, now);
            if (result.status === 'skipped' ||
                result.status === 'incoming' ||
                result.status === 'expected') {
                continue;
            }
            evaluated.push({
                date,
                studentAssistantId: schedule.student_assistant_id,
                scheduleBlockId: block.id,
                day: block.days,
                startTime: (0, time_1.normalizeTimeKey)(block.start_time),
                endTime: (0, time_1.normalizeTimeKey)(block.end_time),
                clockIn,
                status: result.status,
                minutesLate: result.minutesLate,
            });
        }
    }
    return evaluated;
}
function buildTermAnalytics(term, schedules, scheduleBlocks, timeEntries, now = new Date()) {
    const shifts = expandEvaluatedShifts(term, schedules, scheduleBlocks, timeEntries, { now });
    return {
        summary: summarizeShifts(shifts),
        dailyTrend: aggregateDailyTrend(shifts),
        lateByTimeSlot: aggregateLateByTimeSlot(shifts),
        weekdayPatterns: aggregateWeekdayPatterns(shifts),
        lateLeaderboard: aggregateLateLeaderboard(shifts),
    };
}
function buildStudentAnalytics(term, studentAssistantId, schedules, scheduleBlocks, timeEntries, now = new Date()) {
    const shifts = expandEvaluatedShifts(term, schedules, scheduleBlocks, timeEntries, {
        studentAssistantId,
        now,
    });
    const recentIssues = shifts
        .filter((shift) => shift.status === 'late' || shift.status === 'absent')
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 20)
        .map((shift) => ({
        date: shift.date,
        startTime: shift.startTime,
        endTime: shift.endTime,
        clockIn: shift.clockIn,
        minutesLate: shift.minutesLate,
        status: shift.status,
    }));
    return {
        summary: summarizeShifts(shifts),
        lateByTimeSlot: aggregateLateByTimeSlot(shifts),
        weekdayPatterns: aggregateWeekdayPatterns(shifts),
        dailyTrend: aggregateDailyTrend(shifts),
        recentIssues,
    };
}

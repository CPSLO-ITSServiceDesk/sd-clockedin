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
        unscheduled: 0,
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
    const unscheduled = shifts.filter((shift) => shift.status === 'unscheduled').length;
    const totalEvaluated = onTime + early + late + absent;
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
        unscheduled,
        onTimeRate: totalEvaluated > 0 ? onTime / totalEvaluated : 0,
        punctualityRate: totalEvaluated > 0 ? (onTime + early) / totalEvaluated : 0,
        avgMinutesLate: Math.round(avgMinutesLate * 10) / 10,
    };
}
function aggregateLateByTimeSlot(shifts) {
    const slotMap = new Map();
    for (const shift of shifts) {
        if (shift.status === 'unscheduled')
            continue;
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
        if (shift.status === 'unscheduled')
            continue;
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
        if (shift.status === 'unscheduled')
            continue;
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
function findUnmatchedEntries(timeEntries, term, termSchedules, usedEntryKeys, today, options = {}) {
    const scheduleByStudent = new Map(termSchedules
        .filter((schedule) => schedule.student_assistant_id != null)
        .map((schedule) => [schedule.student_assistant_id, schedule]));
    return timeEntries.filter((entry) => {
        if (!entry.student_assistant_id || !entry.clock_in)
            return false;
        if (options.studentAssistantId != null &&
            entry.student_assistant_id !== options.studentAssistantId) {
            return false;
        }
        const date = getEntryDate(entry);
        if (!date || date > today)
            return false;
        const schedule = scheduleByStudent.get(entry.student_assistant_id);
        if (!schedule)
            return entry.schedule_block_id == null;
        const range = (0, scheduleDateRange_1.getEffectiveScheduleDateRange)(schedule, term);
        if (!range || date < range.startDate || date > range.endDate)
            return false;
        if (entry.schedule_block_id == null)
            return true;
        const entryKey = `${entry.schedule_block_id}-${entry.student_assistant_id}-${date}`;
        return !usedEntryKeys.has(entryKey);
    });
}
function groupEntriesByStudentDate(entries) {
    const map = new Map();
    for (const entry of entries) {
        if (!entry.student_assistant_id)
            continue;
        const date = getEntryDate(entry);
        if (!date)
            continue;
        const key = `${entry.student_assistant_id}-${date}`;
        const list = map.get(key) ?? [];
        list.push(entry);
        map.set(key, list);
    }
    return map;
}
function applyUnscheduledShifts(evaluated, unmatchedEntries) {
    const entriesByStudentDate = groupEntriesByStudentDate(unmatchedEntries);
    const consumedEntryIds = new Set();
    const result = [];
    for (const shift of evaluated) {
        if (shift.status !== 'absent') {
            result.push(shift);
            continue;
        }
        const key = `${shift.studentAssistantId}-${shift.date}`;
        const available = (entriesByStudentDate.get(key) ?? []).filter((entry) => entry.id != null && !consumedEntryIds.has(entry.id));
        if (available.length === 0) {
            result.push(shift);
            continue;
        }
        const entry = available[0];
        consumedEntryIds.add(entry.id);
        result.push({
            ...shift,
            status: 'unscheduled',
            clockIn: entry.clock_in,
        });
    }
    for (const entry of unmatchedEntries) {
        if (entry.id != null && consumedEntryIds.has(entry.id))
            continue;
        if (!entry.student_assistant_id || !entry.clock_in)
            continue;
        const date = getEntryDate(entry);
        const weekday = date ? getWeekdayForDate(date) : null;
        if (!date || !weekday)
            continue;
        if (entry.id != null) {
            consumedEntryIds.add(entry.id);
        }
        result.push({
            date,
            studentAssistantId: entry.student_assistant_id,
            scheduleBlockId: null,
            day: weekday,
            startTime: (0, time_1.normalizeTimeKey)(entry.clock_in),
            endTime: entry.clock_out ? (0, time_1.normalizeTimeKey)(entry.clock_out) : '',
            clockIn: entry.clock_in,
            status: 'unscheduled',
            minutesLate: 0,
        });
    }
    return result;
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
    const usedEntryKeys = new Set();
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
            if (entry) {
                usedEntryKeys.add(entryKey);
            }
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
    const unmatchedEntries = findUnmatchedEntries(timeEntries, term, termSchedules, usedEntryKeys, today, options);
    return applyUnscheduledShifts(evaluated, unmatchedEntries);
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
        .filter((shift) => shift.status === 'late' ||
        shift.status === 'absent' ||
        shift.status === 'unscheduled')
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

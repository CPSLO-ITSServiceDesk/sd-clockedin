"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildNormalizationPreview = buildNormalizationPreview;
exports.validateNormalizationMatch = validateNormalizationMatch;
const orgTime_1 = require("./orgTime");
const scheduleDateRange_1 = require("./scheduleDateRange");
const resolveNearestBlock_1 = require("./resolveNearestBlock");
const shiftStatus_1 = require("./shiftStatus");
const time_1 = require("./time");
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
function getEntryDate(entry) {
    const fromClockIn = (0, shiftStatus_1.getClockInDate)(entry.clock_in);
    if (fromClockIn)
        return fromClockIn;
    if (entry.created_at?.includes('T')) {
        return (0, shiftStatus_1.toLocalDateString)(new Date(entry.created_at));
    }
    return entry.created_at?.slice(0, 10) ?? null;
}
function formatStudentName(student) {
    if (!student)
        return 'Unknown';
    const parts = [student.first_name, student.last_name].filter(Boolean);
    return parts.length > 0 ? parts.join(' ') : `Student #${student.id}`;
}
function buildUsedEntryKeys(timeEntries) {
    const keys = new Set();
    for (const entry of timeEntries) {
        if (entry.schedule_block_id == null || entry.student_assistant_id == null) {
            continue;
        }
        const date = getEntryDate(entry);
        if (!date)
            continue;
        keys.add(`${entry.schedule_block_id}-${entry.student_assistant_id}-${date}`);
    }
    return keys;
}
function buildNormalizationMaps(term, schedules, scheduleBlocks, students) {
    const termSchedules = schedules.filter((schedule) => schedule.academic_term_id === term.id);
    const scheduleByStudent = new Map(termSchedules
        .filter((schedule) => schedule.student_assistant_id != null)
        .map((schedule) => [schedule.student_assistant_id, schedule]));
    const blocksBySchedule = new Map();
    for (const block of scheduleBlocks) {
        if (block.schedule_id == null)
            continue;
        const list = blocksBySchedule.get(block.schedule_id) ?? [];
        list.push(block);
        blocksBySchedule.set(block.schedule_id, list);
    }
    const studentById = new Map(students.map((student) => [student.id, student]));
    return { scheduleByStudent, blocksBySchedule, studentById };
}
function buildNormalizationPreview(term, schedules, scheduleBlocks, timeEntries, students, now = new Date()) {
    const today = (0, orgTime_1.getOrgLocalDateString)(now);
    const offDays = parseOffDays(term);
    const { scheduleByStudent, blocksBySchedule, studentById } = buildNormalizationMaps(term, schedules, scheduleBlocks, students);
    const claimedKeys = buildUsedEntryKeys(timeEntries);
    const unscheduled = timeEntries
        .filter((entry) => entry.schedule_block_id == null &&
        entry.clock_in != null &&
        entry.student_assistant_id != null &&
        entry.id != null)
        .sort((a, b) => a.clock_in.localeCompare(b.clock_in));
    const proposals = [];
    const unmatched = [];
    for (const entry of unscheduled) {
        const studentId = entry.student_assistant_id;
        const student = studentById.get(studentId);
        const studentName = formatStudentName(student);
        const date = getEntryDate(entry);
        if (!date || date > today) {
            unmatched.push({
                timeEntryId: entry.id,
                studentAssistantId: studentId,
                studentName,
                date: date ?? '',
                clockIn: entry.clock_in,
                reason: 'outside_term_range',
            });
            continue;
        }
        const schedule = scheduleByStudent.get(studentId);
        if (!schedule) {
            unmatched.push({
                timeEntryId: entry.id,
                studentAssistantId: studentId,
                studentName,
                date,
                clockIn: entry.clock_in,
                reason: 'no_schedule',
            });
            continue;
        }
        const range = (0, scheduleDateRange_1.getEffectiveScheduleDateRange)(schedule, term);
        if (!range || date < range.startDate || date > range.endDate) {
            unmatched.push({
                timeEntryId: entry.id,
                studentAssistantId: studentId,
                studentName,
                date,
                clockIn: entry.clock_in,
                reason: 'outside_term_range',
            });
            continue;
        }
        if (isVacationDay(date, offDays)) {
            unmatched.push({
                timeEntryId: entry.id,
                studentAssistantId: studentId,
                studentName,
                date,
                clockIn: entry.clock_in,
                reason: 'no_blocks_that_day',
            });
            continue;
        }
        const weekday = getWeekdayForDate(date);
        if (!weekday) {
            unmatched.push({
                timeEntryId: entry.id,
                studentAssistantId: studentId,
                studentName,
                date,
                clockIn: entry.clock_in,
                reason: 'no_blocks_that_day',
            });
            continue;
        }
        const allDayBlocks = (blocksBySchedule.get(schedule.id) ?? []).filter((block) => block.days === weekday &&
            !block.is_remote &&
            block.start_time &&
            block.end_time);
        if (allDayBlocks.length === 0) {
            unmatched.push({
                timeEntryId: entry.id,
                studentAssistantId: studentId,
                studentName,
                date,
                clockIn: entry.clock_in,
                reason: 'no_blocks_that_day',
            });
            continue;
        }
        const availableBlocks = allDayBlocks.filter((block) => {
            const key = `${block.id}-${studentId}-${date}`;
            return !claimedKeys.has(key);
        });
        if (availableBlocks.length === 0) {
            unmatched.push({
                timeEntryId: entry.id,
                studentAssistantId: studentId,
                studentName,
                date,
                clockIn: entry.clock_in,
                reason: 'block_already_claimed',
            });
            continue;
        }
        const clockInMinutes = (0, time_1.timeToMinutes)(entry.clock_in);
        if (Number.isNaN(clockInMinutes)) {
            unmatched.push({
                timeEntryId: entry.id,
                studentAssistantId: studentId,
                studentName,
                date,
                clockIn: entry.clock_in,
                reason: 'outside_window',
            });
            continue;
        }
        const candidates = availableBlocks.map((block) => ({
            scheduleBlockId: block.id,
            startTime: block.start_time,
            endTime: block.end_time,
            clockInActual: null,
        }));
        const matched = (0, resolveNearestBlock_1.resolveNearestBlockFromMinutes)(candidates, clockInMinutes);
        if (!matched) {
            unmatched.push({
                timeEntryId: entry.id,
                studentAssistantId: studentId,
                studentName,
                date,
                clockIn: entry.clock_in,
                reason: 'outside_window',
            });
            continue;
        }
        const block = allDayBlocks.find((b) => b.id === matched.scheduleBlockId);
        proposals.push({
            timeEntryId: entry.id,
            studentAssistantId: studentId,
            studentName,
            date,
            clockIn: entry.clock_in,
            clockOut: entry.clock_out,
            proposedBlockId: matched.scheduleBlockId,
            blockStartTime: block.start_time,
            blockEndTime: block.end_time,
            blockDay: block.days,
        });
        claimedKeys.add(`${matched.scheduleBlockId}-${studentId}-${date}`);
    }
    return {
        summary: {
            totalUnscheduled: unscheduled.length,
            proposedMatches: proposals.length,
            noMatch: unmatched.length,
        },
        proposals,
        unmatched,
    };
}
function validateNormalizationMatch(match, context, now = new Date()) {
    const entry = context.timeEntries.find((e) => e.id === match.timeEntryId);
    if (!entry) {
        return { valid: false, reason: 'Time entry not found' };
    }
    if (entry.schedule_block_id != null) {
        return { valid: false, reason: 'Time entry already linked to a block' };
    }
    if (!entry.clock_in || !entry.student_assistant_id) {
        return { valid: false, reason: 'Time entry missing clock-in or student' };
    }
    const block = context.scheduleBlocks.find((b) => b.id === match.scheduleBlockId);
    if (!block) {
        return { valid: false, reason: 'Schedule block not found' };
    }
    const { scheduleByStudent } = buildNormalizationMaps(context.term, context.schedules, context.scheduleBlocks, context.students);
    const schedule = scheduleByStudent.get(entry.student_assistant_id);
    if (schedule?.id !== block.schedule_id) {
        return { valid: false, reason: 'Block does not belong to student schedule in term' };
    }
    const date = getEntryDate(entry);
    if (!date) {
        return { valid: false, reason: 'Could not determine entry date' };
    }
    const today = (0, orgTime_1.getOrgLocalDateString)(now);
    if (date > today) {
        return { valid: false, reason: 'Entry date is in the future' };
    }
    const range = (0, scheduleDateRange_1.getEffectiveScheduleDateRange)(schedule, context.term);
    if (!range || date < range.startDate || date > range.endDate) {
        return { valid: false, reason: 'Entry date outside term range' };
    }
    const offDays = parseOffDays(context.term);
    if (isVacationDay(date, offDays)) {
        return { valid: false, reason: 'Entry date is a vacation day' };
    }
    const weekday = getWeekdayForDate(date);
    if (!weekday || block.days !== weekday) {
        return { valid: false, reason: 'Block weekday does not match entry date' };
    }
    if (block.is_remote) {
        return { valid: false, reason: 'Remote blocks are not eligible' };
    }
    const claimedKeys = buildUsedEntryKeys(context.timeEntries);
    const key = `${match.scheduleBlockId}-${entry.student_assistant_id}-${date}`;
    if (claimedKeys.has(key)) {
        return { valid: false, reason: 'Block already claimed for this student and date' };
    }
    const clockInMinutes = (0, time_1.timeToMinutes)(entry.clock_in);
    if (Number.isNaN(clockInMinutes)) {
        return { valid: false, reason: 'Invalid clock-in time' };
    }
    const candidate = {
        scheduleBlockId: block.id,
        startTime: block.start_time,
        endTime: block.end_time,
        clockInActual: null,
    };
    const resolved = (0, resolveNearestBlock_1.resolveNearestBlockFromMinutes)([candidate], clockInMinutes);
    if (resolved?.scheduleBlockId !== match.scheduleBlockId) {
        return { valid: false, reason: 'Clock-in outside eligible window for block' };
    }
    return { valid: true };
}

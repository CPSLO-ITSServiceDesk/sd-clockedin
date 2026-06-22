"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.todayShiftsService = void 0;
exports.getTodayDay = getTodayDay;
exports.getTodayDateString = getTodayDateString;
const formatStudentRole_1 = require("../lib/formatStudentRole");
const shiftStatus_1 = require("../lib/shiftStatus");
const scheduleBlocksService_1 = require("./scheduleBlocksService");
const schedulesService_1 = require("./schedulesService");
const studentAssistantService_1 = require("./studentAssistantService");
const timeEntryService_1 = require("./timeEntryService");
const WEEKDAY_DAYS = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
];
function getTodayDay(now = new Date()) {
    const day = now.getDay();
    if (day === 0 || day === 6)
        return null;
    return WEEKDAY_DAYS[day - 1];
}
function getTodayDateString(now = new Date()) {
    return now.toISOString().split('T')[0];
}
exports.todayShiftsService = {
    async getTodayShifts(now = new Date()) {
        const todayDay = getTodayDay(now);
        if (!todayDay)
            return [];
        const todayDate = getTodayDateString(now);
        const [schedules, scheduleBlocks, studentAssistants, timeEntries] = await Promise.all([
            schedulesService_1.schedulesService.getAll(),
            scheduleBlocksService_1.scheduleBlocksService.getAll(),
            studentAssistantService_1.studentAssistantService.getAll(),
            timeEntryService_1.timeEntryService.getAll(),
        ]);
        const todaysBlocks = scheduleBlocks.filter((block) => block.days === todayDay);
        const todaysTimeEntries = timeEntries.filter((entry) => entry.created_at?.startsWith(todayDate));
        const scheduleMap = new Map(schedules.map((schedule) => [schedule.id, schedule]));
        const studentAssistantMap = new Map(studentAssistants.map((assistant) => [assistant.id, assistant]));
        const timeEntryMap = new Map();
        for (const entry of todaysTimeEntries) {
            const key = `${entry.schedule_block_id}-${entry.student_assistant_id}`;
            timeEntryMap.set(key, entry);
        }
        return todaysBlocks
            .map((block) => {
            const schedule = block.schedule_id != null ? scheduleMap.get(block.schedule_id) : undefined;
            if (!schedule?.student_assistant_id)
                return null;
            const studentAssistant = studentAssistantMap.get(schedule.student_assistant_id);
            if (!studentAssistant || studentAssistant.is_active === false)
                return null;
            const timeEntryKey = `${block.id}-${schedule.student_assistant_id}`;
            const timeEntry = timeEntryMap.get(timeEntryKey) ?? null;
            const startTime = block.start_time ?? '00:00';
            return {
                scheduleBlockId: block.id,
                studentAssistantId: schedule.student_assistant_id,
                firstName: studentAssistant.first_name ?? '',
                lastName: studentAssistant.last_name ?? '',
                role: (0, formatStudentRole_1.formatStudentRole)(studentAssistant.position),
                startTime,
                endTime: block.end_time ?? '00:00',
                clockInActual: timeEntry?.clock_in ?? null,
                clockOutActual: timeEntry?.clock_out ?? null,
                timeEntryId: timeEntry?.id ?? null,
                status: (0, shiftStatus_1.computeShiftStatus)(startTime, timeEntry?.clock_in ?? null, now),
            };
        })
            .filter((shift) => shift !== null);
    },
};

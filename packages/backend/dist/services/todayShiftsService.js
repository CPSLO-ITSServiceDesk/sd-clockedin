"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.todayShiftsService = void 0;
exports.getTodayDay = getTodayDay;
exports.getTodayDateString = getTodayDateString;
const scheduleDateRange_1 = require("../lib/scheduleDateRange");
const formatStudentRole_1 = require("../lib/formatStudentRole");
const orgTime_1 = require("../lib/orgTime");
const shiftStatus_1 = require("../lib/shiftStatus");
const scheduleBlocksService_1 = require("./scheduleBlocksService");
const schedulesService_1 = require("./schedulesService");
const studentAssistantService_1 = require("./studentAssistantService");
const termService_1 = require("./termService");
const timeEntryService_1 = require("./timeEntryService");
const WEEKDAY_DAYS = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
];
function getTodayDay(now = new Date()) {
    const day = (0, orgTime_1.getOrgDayOfWeek)(now);
    if (day === 0 || day === 6)
        return null;
    return WEEKDAY_DAYS[day - 1];
}
function getTodayDateString(now = new Date()) {
    return (0, shiftStatus_1.toLocalDateString)(now);
}
function resolveBlockStudentId(block, scheduleMap) {
    if (block.schedule_id == null)
        return null;
    return scheduleMap.get(block.schedule_id)?.student_assistant_id ?? null;
}
exports.todayShiftsService = {
    async getTodayShifts(now = new Date(), options = {}) {
        const includeRemote = options.includeRemote ?? false;
        const todayDay = getTodayDay(now);
        if (!todayDay) {
            return { shifts: [], remoteOnlyStudentIds: [] };
        }
        const todayDate = getTodayDateString(now);
        const [schedules, scheduleBlocks, studentAssistants, timeEntries, terms] = await Promise.all([
            schedulesService_1.schedulesService.getAll(),
            scheduleBlocksService_1.scheduleBlocksService.getAll(),
            studentAssistantService_1.studentAssistantService.getAll(),
            timeEntryService_1.timeEntryService.getAll(),
            termService_1.termService.getAll(),
        ]);
        const termMap = new Map(terms.map((term) => [term.id, term]));
        const todaysBlocks = scheduleBlocks.filter((block) => block.days === todayDay);
        const todaysTimeEntries = timeEntries.filter((entry) => (0, shiftStatus_1.getClockInDate)(entry.clock_in) === todayDate);
        const scheduleMap = new Map(schedules.map((schedule) => [schedule.id, schedule]));
        const studentAssistantMap = new Map(studentAssistants.map((assistant) => [assistant.id, assistant]));
        const inPersonStudentIds = new Set();
        const remoteStudentIds = new Set();
        for (const block of todaysBlocks) {
            const studentId = resolveBlockStudentId(block, scheduleMap);
            if (studentId == null)
                continue;
            const schedule = block.schedule_id != null ? scheduleMap.get(block.schedule_id) : undefined;
            const term = schedule?.academic_term_id != null
                ? termMap.get(schedule.academic_term_id)
                : undefined;
            if (schedule &&
                term &&
                !(0, scheduleDateRange_1.isDateInEffectiveScheduleRange)(todayDate, schedule, term)) {
                continue;
            }
            const studentAssistant = studentAssistantMap.get(studentId);
            if (!studentAssistant || studentAssistant.is_active === false)
                continue;
            if (block.is_remote) {
                remoteStudentIds.add(studentId);
            }
            else {
                inPersonStudentIds.add(studentId);
            }
        }
        const remoteOnlyStudentIds = [...remoteStudentIds].filter((studentId) => !inPersonStudentIds.has(studentId));
        const timeEntryMap = new Map();
        for (const entry of todaysTimeEntries) {
            const key = `${entry.schedule_block_id}-${entry.student_assistant_id}`;
            timeEntryMap.set(key, entry);
        }
        const scheduledShifts = todaysBlocks.flatMap((block) => {
            if (block.is_remote && !includeRemote)
                return [];
            const schedule = block.schedule_id != null ? scheduleMap.get(block.schedule_id) : undefined;
            if (!schedule?.student_assistant_id)
                return [];
            const term = schedule.academic_term_id != null
                ? termMap.get(schedule.academic_term_id)
                : undefined;
            if (term &&
                !(0, scheduleDateRange_1.isDateInEffectiveScheduleRange)(todayDate, schedule, term)) {
                return [];
            }
            const studentAssistant = studentAssistantMap.get(schedule.student_assistant_id);
            if (!studentAssistant || studentAssistant.is_active === false)
                return [];
            const timeEntryKey = `${block.id}-${schedule.student_assistant_id}`;
            const timeEntry = timeEntryMap.get(timeEntryKey) ?? null;
            const startTime = block.start_time ?? '00:00';
            return [{
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
                    status: block.is_remote
                        ? (0, shiftStatus_1.computeRemoteShiftStatus)(startTime, now)
                        : (0, shiftStatus_1.computeShiftStatus)(startTime, timeEntry?.clock_in ?? null, now),
                    isRemote: block.is_remote ?? false,
                }];
        });
        const unscheduledShifts = [];
        for (const entry of todaysTimeEntries) {
            if (entry.schedule_block_id != null ||
                entry.clock_out != null ||
                entry.student_assistant_id == null) {
                continue;
            }
            const studentAssistant = studentAssistantMap.get(entry.student_assistant_id);
            if (!studentAssistant || studentAssistant.is_active === false)
                continue;
            unscheduledShifts.push({
                scheduleBlockId: null,
                studentAssistantId: entry.student_assistant_id,
                firstName: studentAssistant.first_name ?? '',
                lastName: studentAssistant.last_name ?? '',
                role: (0, formatStudentRole_1.formatStudentRole)(studentAssistant.position),
                startTime: '',
                endTime: '',
                clockInActual: entry.clock_in ?? null,
                clockOutActual: null,
                timeEntryId: entry.id ?? null,
                status: 'on-time',
                isRemote: false,
            });
        }
        return {
            shifts: [...scheduledShifts, ...unscheduledShifts],
            remoteOnlyStudentIds,
        };
    },
};

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyticsService = void 0;
const shiftAnalytics_1 = require("../lib/shiftAnalytics");
const errorHandler_1 = require("../middleware/errorHandler");
const scheduleBlocksService_1 = require("./scheduleBlocksService");
const schedulesService_1 = require("./schedulesService");
const termService_1 = require("./termService");
const timeEntryService_1 = require("./timeEntryService");
exports.analyticsService = {
    async getTermAnalytics(termId) {
        const term = await termService_1.termService.getById(termId);
        if (!term) {
            throw new errorHandler_1.HttpError(404, 'Term not found');
        }
        const [schedules, scheduleBlocks, timeEntries] = await Promise.all([
            schedulesService_1.schedulesService.getAll(),
            scheduleBlocksService_1.scheduleBlocksService.getAll(),
            timeEntryService_1.timeEntryService.getAll(),
        ]);
        return (0, shiftAnalytics_1.buildTermAnalytics)(term, schedules, scheduleBlocks, timeEntries);
    },
    async getStudentAnalytics(studentAssistantId, termId) {
        const term = await termService_1.termService.getById(termId);
        if (!term) {
            throw new errorHandler_1.HttpError(404, 'Term not found');
        }
        const [schedules, scheduleBlocks, timeEntries] = await Promise.all([
            schedulesService_1.schedulesService.getAll(),
            scheduleBlocksService_1.scheduleBlocksService.getAll(),
            timeEntryService_1.timeEntryService.getAll(),
        ]);
        return (0, shiftAnalytics_1.buildStudentAnalytics)(term, studentAssistantId, schedules, scheduleBlocks, timeEntries);
    },
};

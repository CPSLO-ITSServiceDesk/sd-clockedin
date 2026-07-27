"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shiftNormalizationService = void 0;
const shiftNormalization_1 = require("../lib/shiftNormalization");
const shiftStatus_1 = require("../lib/shiftStatus");
const errorHandler_1 = require("../middleware/errorHandler");
const scheduleBlocksService_1 = require("./scheduleBlocksService");
const schedulesService_1 = require("./schedulesService");
const studentAssistantService_1 = require("./studentAssistantService");
const termService_1 = require("./termService");
const timeEntryService_1 = require("./timeEntryService");
async function loadContext(termId) {
    const term = await termService_1.termService.getById(termId);
    if (!term) {
        throw new errorHandler_1.HttpError(404, 'Term not found');
    }
    const [schedules, scheduleBlocks, timeEntries, students] = await Promise.all([
        schedulesService_1.schedulesService.getAll(),
        scheduleBlocksService_1.scheduleBlocksService.getAll(),
        timeEntryService_1.timeEntryService.getAll(),
        studentAssistantService_1.studentAssistantService.getAll(),
    ]);
    return { term, schedules, scheduleBlocks, timeEntries, students };
}
exports.shiftNormalizationService = {
    async getPreview(termId) {
        const context = await loadContext(termId);
        return (0, shiftNormalization_1.buildNormalizationPreview)(context.term, context.schedules, context.scheduleBlocks, context.timeEntries, context.students);
    },
    async applyMatches(termId, matches) {
        const context = await loadContext(termId);
        const skipped = [];
        let applied = 0;
        const appliedKeys = new Set();
        for (const match of matches) {
            const entry = context.timeEntries.find((e) => e.id === match.timeEntryId);
            if (!entry?.student_assistant_id) {
                skipped.push({ timeEntryId: match.timeEntryId, reason: 'Time entry not found' });
                continue;
            }
            const validation = (0, shiftNormalization_1.validateNormalizationMatch)(match, context);
            if (!validation.valid) {
                skipped.push({ timeEntryId: match.timeEntryId, reason: validation.reason });
                continue;
            }
            const entryDate = (0, shiftStatus_1.getClockInDate)(entry.clock_in);
            if (!entryDate) {
                skipped.push({ timeEntryId: match.timeEntryId, reason: 'Could not determine entry date' });
                continue;
            }
            const claimKey = `${match.scheduleBlockId}-${entry.student_assistant_id}-${entryDate}`;
            if (appliedKeys.has(claimKey)) {
                skipped.push({
                    timeEntryId: match.timeEntryId,
                    reason: 'Duplicate block claim in this batch',
                });
                continue;
            }
            const updated = await timeEntryService_1.timeEntryService.update(match.timeEntryId, {
                schedule_block_id: match.scheduleBlockId,
            });
            if (!updated) {
                skipped.push({ timeEntryId: match.timeEntryId, reason: 'Failed to update time entry' });
                continue;
            }
            appliedKeys.add(claimKey);
            applied += 1;
            const entryIndex = context.timeEntries.findIndex((e) => e.id === match.timeEntryId);
            if (entryIndex >= 0) {
                context.timeEntries[entryIndex] = updated;
            }
        }
        return { applied, skipped };
    },
};

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduleImportService = void 0;
const scheduleImportParser_1 = require("../lib/scheduleImportParser");
const scheduleImportTransform_1 = require("../lib/scheduleImportTransform");
const errorHandler_1 = require("../middleware/errorHandler");
const scheduleBlocksService_1 = require("./scheduleBlocksService");
const schedulesService_1 = require("./schedulesService");
const studentAssistantService_1 = require("./studentAssistantService");
const termService_1 = require("./termService");
async function upsertStudent(entry, dryRun) {
    const existing = await studentAssistantService_1.studentAssistantService.findByWorkEmail(entry.workEmail);
    if (existing) {
        if (!dryRun) {
            const updates = {};
            if (!existing.first_name?.trim() && entry.firstName) {
                updates.first_name = entry.firstName;
            }
            if (!existing.last_name?.trim() && entry.lastName) {
                updates.last_name = entry.lastName;
            }
            if (!existing.work_email) {
                updates.work_email = entry.workEmail;
            }
            if (Object.keys(updates).length > 0) {
                await studentAssistantService_1.studentAssistantService.update(existing.id, updates);
            }
        }
        return { student: existing, action: 'match' };
    }
    if (dryRun) {
        return { student: null, action: 'create' };
    }
    const created = await studentAssistantService_1.studentAssistantService.create({
        first_name: entry.firstName,
        last_name: entry.lastName,
        work_email: entry.workEmail,
        is_active: true,
        position: 'student_assistant',
    });
    return { student: created, action: 'create' };
}
async function replaceScheduleBlocks(studentId, termId, blocks, dryRun) {
    if (dryRun)
        return;
    let schedule = await schedulesService_1.schedulesService.getByStudentAndTerm(studentId, termId);
    if (!schedule) {
        schedule = await schedulesService_1.schedulesService.create({
            student_assistant_id: studentId,
            academic_term_id: termId,
        });
    }
    const existingBlocks = await scheduleBlocksService_1.scheduleBlocksService.getByScheduleId(schedule.id);
    await scheduleBlocksService_1.scheduleBlocksService.removeMany(existingBlocks.map((block) => block.id));
    await Promise.all(blocks.map((block) => scheduleBlocksService_1.scheduleBlocksService.create({
        schedule_id: schedule.id,
        days: block.day,
        start_time: block.start_time,
        end_time: block.end_time,
        is_remote: block.is_remote,
    })));
}
exports.scheduleImportService = {
    async importFromBuffer(buffer, filename, termId, dryRun) {
        const term = await termService_1.termService.getById(termId);
        if (!term) {
            throw new errorHandler_1.HttpError(404, 'Academic term not found');
        }
        if (!term.start_date || !term.end_date) {
            throw new errorHandler_1.HttpError(400, 'Selected term is missing start or end date');
        }
        const rows = (0, scheduleImportParser_1.parseScheduleSpreadsheet)(buffer, filename);
        const { students, warnings, skippedRows, remoteRowsSkipped } = (0, scheduleImportTransform_1.transformImportRows)(rows, term.start_date, term.end_date, term.remote_shifts_allowed ?? false);
        if (students.length === 0) {
            throw new errorHandler_1.HttpError(400, 'No valid schedule rows found for the selected term');
        }
        const previews = [];
        let studentsCreated = 0;
        let studentsMatched = 0;
        for (const entry of students) {
            const { student, action } = await upsertStudent(entry, dryRun);
            if (action === 'create') {
                studentsCreated += 1;
            }
            else {
                studentsMatched += 1;
            }
            if (!dryRun && student) {
                await replaceScheduleBlocks(student.id, termId, entry.blocks, dryRun);
            }
            previews.push({
                workEmail: entry.workEmail,
                member: entry.member,
                action,
                studentId: student?.id,
                blockCount: entry.blocks.length,
                remoteBlockCount: entry.blocks.filter((block) => block.is_remote).length,
                blocks: entry.blocks,
            });
        }
        const totalBlocks = previews.reduce((sum, preview) => sum + preview.blockCount, 0);
        const remoteBlocks = previews.reduce((sum, preview) => sum + preview.remoteBlockCount, 0);
        return {
            dryRun,
            termId,
            termName: term.name ?? `Term ${termId}`,
            summary: {
                studentsCreated,
                studentsMatched,
                schedulesUpdated: previews.length,
                totalBlocks,
                remoteBlocks,
                skippedRows,
                remoteRowsSkipped,
            },
            students: previews,
            warnings,
        };
    },
};

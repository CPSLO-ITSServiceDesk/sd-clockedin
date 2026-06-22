"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduleImportController = void 0;
const scheduleImportService_1 = require("../services/scheduleImportService");
exports.scheduleImportController = {
    async importSchedules(req, res, next) {
        try {
            const file = req.file;
            if (!file) {
                res.status(400).json({ success: false, error: 'File is required' });
                return;
            }
            const termId = Number(req.body.academic_term_id);
            if (!Number.isInteger(termId) || termId <= 0) {
                res.status(400).json({
                    success: false,
                    error: 'academic_term_id must be a positive integer',
                });
                return;
            }
            const dryRun = req.body.dry_run === undefined
                ? req.query.dry_run !== 'false'
                : String(req.body.dry_run) !== 'false';
            const result = await scheduleImportService_1.scheduleImportService.importFromBuffer(file.buffer, file.originalname, termId, dryRun);
            res.json({ success: true, data: result });
        }
        catch (err) {
            next(err);
        }
    },
};

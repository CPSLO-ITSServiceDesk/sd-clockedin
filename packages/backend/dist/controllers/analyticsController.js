"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyticsController = void 0;
const analyticsService_1 = require("../services/analyticsService");
exports.analyticsController = {
    async getTermAnalytics(req, res, next) {
        try {
            const termId = Number(req.params.termId);
            const data = await analyticsService_1.analyticsService.getTermAnalytics(termId);
            res.json({ success: true, data });
        }
        catch (err) {
            next(err);
        }
    },
    async getStudentAnalytics(req, res, next) {
        try {
            const studentAssistantId = Number(req.params.studentId);
            const termId = Number(req.query.termId);
            if (!termId || Number.isNaN(termId)) {
                res.status(400).json({
                    success: false,
                    error: 'termId query parameter is required',
                });
                return;
            }
            const data = await analyticsService_1.analyticsService.getStudentAnalytics(studentAssistantId, termId);
            res.json({ success: true, data });
        }
        catch (err) {
            next(err);
        }
    },
};

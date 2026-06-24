"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.timesheetController = void 0;
const timeEntryService_1 = require("../services/timeEntryService");
exports.timesheetController = {
    async getHoursByDay(req, res, next) {
        try {
            const { studentId, startDate, endDate } = req.query;
            if (!studentId || !startDate || !endDate) {
                res.status(400).json({
                    success: false,
                    error: 'studentId, startDate, and endDate are required'
                });
                return;
            }
            const hoursByDay = await timeEntryService_1.timeEntryService.getHoursByDay(Number(studentId), String(startDate), String(endDate));
            res.json({ success: true, data: hoursByDay });
        }
        catch (err) {
            next(err);
        }
    }
};

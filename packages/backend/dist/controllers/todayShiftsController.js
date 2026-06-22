"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.todayShiftsController = void 0;
const todayShiftsService_1 = require("../services/todayShiftsService");
exports.todayShiftsController = {
    async getToday(_req, res, next) {
        try {
            const shifts = await todayShiftsService_1.todayShiftsService.getTodayShifts();
            res.json({ success: true, data: shifts });
        }
        catch (err) {
            next(err);
        }
    },
};

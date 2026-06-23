"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.todayShiftsController = void 0;
const todayShiftsService_1 = require("../services/todayShiftsService");
exports.todayShiftsController = {
    async getToday(req, res, next) {
        try {
            const includeRemote = req.query.include_remote === '1' ||
                req.query.include_remote === 'true';
            const result = await todayShiftsService_1.todayShiftsService.getTodayShifts(new Date(), {
                includeRemote,
            });
            res.json({ success: true, data: result });
        }
        catch (err) {
            next(err);
        }
    },
};

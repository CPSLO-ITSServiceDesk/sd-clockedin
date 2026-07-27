"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.todayShiftsController = void 0;
const errorHandler_1 = require("../middleware/errorHandler");
const orgTime_1 = require("../lib/orgTime");
const todayShiftsService_1 = require("../services/todayShiftsService");
exports.todayShiftsController = {
    async getToday(req, res, next) {
        try {
            const includeRemote = req.query.include_remote === '1' ||
                req.query.include_remote === 'true';
            const rawDate = req.query.date;
            const dateParam = typeof rawDate === 'string' && rawDate.length > 0 ? rawDate : undefined;
            if (dateParam !== undefined && !(0, orgTime_1.isValidOrgLocalDateString)(dateParam)) {
                throw new errorHandler_1.HttpError(400, 'date must be a valid YYYY-MM-DD calendar date');
            }
            const referenceNow = (0, orgTime_1.resolveShiftsReferenceNow)(dateParam);
            const result = await todayShiftsService_1.todayShiftsService.getTodayShifts(referenceNow, {
                includeRemote,
            });
            res.json({ success: true, data: result });
        }
        catch (err) {
            next(err);
        }
    },
};

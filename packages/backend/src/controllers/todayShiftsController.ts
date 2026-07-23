import { Request, Response, NextFunction } from 'express';
import { HttpError } from '../middleware/errorHandler';
import {
  isValidOrgLocalDateString,
  resolveShiftsReferenceNow,
} from '../lib/orgTime';
import { todayShiftsService } from '../services/todayShiftsService';

export const todayShiftsController = {
  async getToday(req: Request, res: Response, next: NextFunction) {
    try {
      const includeRemote =
        req.query.include_remote === '1' ||
        req.query.include_remote === 'true';

      const rawDate = req.query.date;
      const dateParam =
        typeof rawDate === 'string' && rawDate.length > 0 ? rawDate : undefined;

      if (dateParam !== undefined && !isValidOrgLocalDateString(dateParam)) {
        throw new HttpError(400, 'date must be a valid YYYY-MM-DD calendar date');
      }

      const referenceNow = resolveShiftsReferenceNow(dateParam);
      const result = await todayShiftsService.getTodayShifts(referenceNow, {
        includeRemote,
      });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
};

import { Request, Response, NextFunction } from 'express';
import { todayShiftsService } from '../services/todayShiftsService';

export const todayShiftsController = {
  async getToday(req: Request, res: Response, next: NextFunction) {
    try {
      const includeRemote =
        req.query.include_remote === '1' ||
        req.query.include_remote === 'true';
      const result = await todayShiftsService.getTodayShifts(new Date(), {
        includeRemote,
      });
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
};

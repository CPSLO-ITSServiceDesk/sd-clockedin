import { Request, Response, NextFunction } from 'express';
import { todayShiftsService } from '../services/todayShiftsService';

export const todayShiftsController = {
  async getToday(_req: Request, res: Response, next: NextFunction) {
    try {
      const shifts = await todayShiftsService.getTodayShifts();
      res.json({ success: true, data: shifts });
    } catch (err) {
      next(err);
    }
  },
};

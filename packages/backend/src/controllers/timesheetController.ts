import { Request, Response, NextFunction } from 'express';
import { timeEntryService } from '../services/timeEntryService';
import { HttpError } from '../middleware/errorHandler';

export const timesheetController = {
  async getHoursByDay(req: Request, res: Response, next: NextFunction) {
    try {
      const { studentId, startDate, endDate } = req.query;

      if (!studentId || !startDate || !endDate) {
        res.status(400).json({
          success: false,
          error: 'studentId, startDate, and endDate are required'
        });
        return;
      }

      const hoursByDay = await timeEntryService.getHoursByDay(
        Number(studentId),
        String(startDate),
        String(endDate)
      );

      res.json({ success: true, data: hoursByDay });
    } catch (err) {
      next(err);
    }
  }
};
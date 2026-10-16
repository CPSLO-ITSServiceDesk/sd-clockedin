import { Request, Response, NextFunction } from 'express';
import { timeEntryService } from '../services/timeEntryService';
import { timesheetService } from '../services/timesheetService';

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
  },

  async getMonthSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const summary = await timesheetService.getMonthSummary(String(req.query.month));
      res.json({ success: true, data: summary });
    } catch (err) {
      next(err);
    }
  },

  async getStudentMonth(req: Request, res: Response, next: NextFunction) {
    try {
      const timesheet = await timesheetService.getStudentMonth(
        Number(req.params.studentId),
        String(req.query.month),
      );
      res.json({ success: true, data: timesheet });
    } catch (err) {
      next(err);
    }
  },

  async verify(req: Request, res: Response, next: NextFunction) {
    try {
      const verifiedBy = typeof req.body?.verified_by === 'string' ? req.body.verified_by : null;
      const verification = await timesheetService.verify(
        Number(req.params.studentId),
        String(req.params.month),
        verifiedBy,
      );
      res.json({ success: true, data: verification });
    } catch (err) {
      next(err);
    }
  },

  async unverify(req: Request, res: Response, next: NextFunction) {
    try {
      await timesheetService.unverify(Number(req.params.studentId), String(req.params.month));
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
};

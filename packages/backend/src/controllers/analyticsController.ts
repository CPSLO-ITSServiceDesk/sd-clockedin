import { Request, Response, NextFunction } from 'express';
import { analyticsService } from '../services/analyticsService';

export const analyticsController = {
  async getTermAnalytics(req: Request, res: Response, next: NextFunction) {
    try {
      const termId = Number(req.params.termId);
      const data = await analyticsService.getTermAnalytics(termId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async getStudentAnalytics(req: Request, res: Response, next: NextFunction) {
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

      const data = await analyticsService.getStudentAnalytics(
        studentAssistantId,
        termId,
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};

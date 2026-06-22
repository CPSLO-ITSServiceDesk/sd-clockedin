import { Request, Response, NextFunction } from 'express';
import { scheduleImportService } from '../services/scheduleImportService';

export const scheduleImportController = {
  async importSchedules(req: Request, res: Response, next: NextFunction) {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ success: false, error: 'File is required' });
        return;
      }

      const termId = Number(req.body.academic_term_id);
      if (!Number.isInteger(termId) || termId <= 0) {
        res.status(400).json({
          success: false,
          error: 'academic_term_id must be a positive integer',
        });
        return;
      }

      const dryRun =
        req.body.dry_run === undefined
          ? req.query.dry_run !== 'false'
          : String(req.body.dry_run) !== 'false';

      const result = await scheduleImportService.importFromBuffer(
        file.buffer,
        file.originalname,
        termId,
        dryRun,
      );

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
};

import { Request, Response, NextFunction } from 'express';
import { teamsSyncService } from '../services/teamsSyncService';

function parseOptionalTermId(value: unknown): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const id = Number(value);
  return Number.isInteger(id) ? id : undefined;
}

export const teamsSyncController = {
  async getStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const termId = parseOptionalTermId(req.query.academic_term_id);
      const status =
        termId != null
          ? await teamsSyncService.getStatus(termId)
          : await teamsSyncService.getActiveTermStatus();
      res.json({ success: true, data: status });
    } catch (err) {
      next(err);
    }
  },

  async syncNow(req: Request, res: Response, next: NextFunction) {
    try {
      const termId = parseOptionalTermId(req.body?.academic_term_id);
      const result =
        termId != null
          ? await teamsSyncService.syncTerm(termId)
          : await teamsSyncService.syncActiveTerm();

      if (!result) {
        res.status(404).json({ success: false, error: 'No active academic term' });
        return;
      }

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
};

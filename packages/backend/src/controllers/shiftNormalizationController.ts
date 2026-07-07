import { Request, Response, NextFunction } from 'express';
import { shiftNormalizationService } from '../services/shiftNormalizationService';

export const shiftNormalizationController = {
  async getPreview(req: Request, res: Response, next: NextFunction) {
    try {
      const termId = Number(req.params.termId);
      const data = await shiftNormalizationService.getPreview(termId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async applyMatches(req: Request, res: Response, next: NextFunction) {
    try {
      const termId = Number(req.params.termId);
      const { matches } = req.body;

      if (!Array.isArray(matches)) {
        res.status(400).json({
          success: false,
          error: 'matches must be an array',
        });
        return;
      }

      const data = await shiftNormalizationService.applyMatches(termId, matches);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};

import { Request, Response, NextFunction } from 'express';
import { scheduleDraftService } from '../services/scheduleDraftService';

export const scheduleDraftController = {
  async getLatest(req: Request, res: Response, next: NextFunction) {
    try {
      // Without a term, list the latest draft of every term (Schedules home).
      if (req.query.academic_term_id == null) {
        res.json({ success: true, data: await scheduleDraftService.listLatestPerTerm() });
        return;
      }
      const draft = await scheduleDraftService.getLatestForTerm(Number(req.query.academic_term_id));
      res.json({ success: true, data: draft });
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const draft = await scheduleDraftService.getById(Number(req.params.id));
      res.json({ success: true, data: draft });
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const copyFrom = req.body.copy_from_term_id;
      const draft = await scheduleDraftService.create(
        Number(req.body.academic_term_id),
        copyFrom == null ? undefined : Number(copyFrom),
      );
      res.status(201).json({ success: true, data: draft });
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { step, rules, people, unmatched, change_log } = req.body ?? {};
      const draft = await scheduleDraftService.update(Number(req.params.id), {
        step,
        rules,
        people,
        unmatched,
        change_log,
      });
      res.json({ success: true, data: draft });
    } catch (err) {
      next(err);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      await scheduleDraftService.remove(Number(req.params.id));
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },

  async importAvailability(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, error: 'File is required' });
        return;
      }
      const result = await scheduleDraftService.importAvailability(
        Number(req.params.id),
        req.file.buffer,
        req.file.originalname,
      );
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async generate(req: Request, res: Response, next: NextFunction) {
    try {
      const draft = await scheduleDraftService.generate(Number(req.params.id));
      res.json({ success: true, data: draft });
    } catch (err) {
      next(err);
    }
  },

  async publishPreview(req: Request, res: Response, next: NextFunction) {
    try {
      const preview = await scheduleDraftService.publishPreview(Number(req.params.id));
      res.json({ success: true, data: preview });
    } catch (err) {
      next(err);
    }
  },

  async publish(req: Request, res: Response, next: NextFunction) {
    try {
      const draft = await scheduleDraftService.publish(Number(req.params.id));
      res.json({ success: true, data: draft });
    } catch (err) {
      next(err);
    }
  },
};

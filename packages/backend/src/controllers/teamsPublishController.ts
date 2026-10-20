import { Request, Response, NextFunction } from 'express';
import { teamsPublishService, type PersonWeeklyShiftInput } from '../services/teamsPublishService';

const rangeOf = (req: Request) => ({
  fromDate: String(req.body.from_date),
  toDate: String(req.body.to_date),
});

export const teamsPublishController = {
  async previewDraft(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await teamsPublishService.previewDraft(Number(req.params.draftId), rangeOf(req));
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async publishDraft(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await teamsPublishService.publishDraft(Number(req.params.draftId), rangeOf(req));
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async previewPerson(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await teamsPublishService.previewPerson(
        Number(req.body.academic_term_id),
        Number(req.params.studentId),
        req.body.shifts as PersonWeeklyShiftInput[],
        rangeOf(req),
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async publishPerson(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await teamsPublishService.publishPerson(
        Number(req.body.academic_term_id),
        Number(req.params.studentId),
        req.body.shifts as PersonWeeklyShiftInput[],
        rangeOf(req),
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async personPattern(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await teamsPublishService.personPattern(
        Number(req.query.academic_term_id),
        Number(req.params.studentId),
        String(req.query.week),
      );
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async history(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await teamsPublishService.history(Number(req.params.termId));
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },
};

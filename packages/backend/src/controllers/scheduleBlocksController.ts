import { Request, Response, NextFunction } from 'express';
import { scheduleBlocksService } from '../services/scheduleBlocksService';

export const scheduleBlocksController = {
  async getAll(_req: Request, res: Response, next: NextFunction) {
    try {
      const blocks = await scheduleBlocksService.getAll();
      res.json({ success: true, data: blocks });
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const block = await scheduleBlocksService.getById(id);
      if (!block) {
        res.status(404).json({ success: false, error: 'Schedule block not found' });
        return;
      }
      res.json({ success: true, data: block });
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const block = await scheduleBlocksService.create(req.body);
      res.status(201).json({ success: true, data: block });
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const block = await scheduleBlocksService.update(id, req.body);
      if (!block) {
        res.status(404).json({ success: false, error: 'Schedule block not found' });
        return;
      }
      res.json({ success: true, data: block });
    } catch (err) {
      next(err);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      await scheduleBlocksService.remove(id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },

  async getByScheduleId(req: Request, res: Response, next: NextFunction) {
    try {
      const scheduleId = Number(req.params.id);
      const blocks = await scheduleBlocksService.getByScheduleId(scheduleId);
      res.json({ success: true, data: blocks });
    } catch (err) {
      next(err);
    }
  },
};
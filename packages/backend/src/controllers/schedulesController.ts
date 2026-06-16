import { Request, Response, NextFunction } from 'express';
import { schedulesService } from '../services/schedulesService';

export const schedulesController = {
  async getAll(_req: Request, res: Response, next: NextFunction) {
    try {
      const schedules = await schedulesService.getAll();
      res.json({ success: true, data: schedules });
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const schedule = await schedulesService.getById(id);
      if (!schedule) {
        res.status(404).json({ success: false, error: 'Schedule not found' });
        return;
      }
      res.json({ success: true, data: schedule });
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const schedule = await schedulesService.create(req.body);
      res.status(201).json({ success: true, data: schedule });
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const schedule = await schedulesService.update(id, req.body);
      if (!schedule) {
        res.status(404).json({ success: false, error: 'Schedule not found' });
        return;
      }
      res.json({ success: true, data: schedule });
    } catch (err) {
      next(err);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      await schedulesService.remove(id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
};
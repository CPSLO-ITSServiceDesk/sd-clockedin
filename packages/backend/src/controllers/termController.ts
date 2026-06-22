import { Request, Response, NextFunction } from 'express';
import { termService } from '../services/termService';

export const termController = {
  async getAll(_req: Request, res: Response, next: NextFunction) {
    try {
      const terms = await termService.getAll();
      res.json({ success: true, data: terms });
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const term = await termService.getById(id);
      if (!term) {
        res.status(404).json({ success: false, error: 'Term not found' });
        return;
      }
      res.json({ success: true, data: term });
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const term = await termService.create(req.body);
      res.status(201).json({ success: true, data: term });
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const term = await termService.update(id, req.body);
      if (!term) {
        res.status(404).json({ success: false, error: 'Term not found' });
        return;
      }
      res.json({ success: true, data: term });
    } catch (err) {
      next(err);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      await termService.remove(id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
};

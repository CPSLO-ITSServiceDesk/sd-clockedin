import { Request, Response, NextFunction } from 'express';
import { adminService } from '../services/adminService';

export const adminController = {
  async getAll(_req: Request, res: Response, next: NextFunction) {
    try {
      const admins = await adminService.getAll();
      res.json({ success: true, data: admins });
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const admin = await adminService.getById(id);
      if (!admin) {
        res.status(404).json({ success: false, error: 'Admin not found' });
        return;
      }
      res.json({ success: true, data: admin });
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const admin = await adminService.create(req.body);
      res.status(201).json({ success: true, data: admin });
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const admin = await adminService.update(id, req.body);
      if (!admin) {
        res.status(404).json({ success: false, error: 'Admin not found' });
        return;
      }
      res.json({ success: true, data: admin });
    } catch (err) {
      next(err);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      await adminService.remove(id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
};

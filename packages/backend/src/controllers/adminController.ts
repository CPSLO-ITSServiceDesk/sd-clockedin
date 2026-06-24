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

  async authorize(req: Request, res: Response, next: NextFunction) {
    try {
      const email = req.body.email as string | undefined;
      const name = req.body.name as string | undefined;

      console.info('[sd-clockin/auth] Authorize request', { email, name });

      const result = await adminService.authorize(email ?? '', name);

      if (!result.allowed) {
        console.warn('[sd-clockin/auth] Authorize denied', {
          email,
          message: result.message,
        });
        res.status(403).json({
          allowed: false,
          message: result.message ?? 'User is not an active admin',
        });
        return;
      }

      console.info('[sd-clockin/auth] Authorize granted', {
        email,
        adminId: result.admin?.id,
      });

      res.json({
        allowed: true,
        admin: result.admin,
      });
    } catch (err) {
      console.error('[sd-clockin/auth] Authorize error', err);
      next(err);
    }
  },
};

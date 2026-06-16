import { Request, Response, NextFunction } from 'express';
import { studentAssistantService } from '../services/studentAssistantService';

export const studentAssistantController = {
  async getAll(_req: Request, res: Response, next: NextFunction) {
    try {
      const assistants = await studentAssistantService.getAll();
      res.json({ success: true, data: assistants });
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const assistant = await studentAssistantService.getById(id);
      if (!assistant) {
        res.status(404).json({ success: false, error: 'Student assistant not found' });
        return;
      }
      res.json({ success: true, data: assistant });
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const assistant = await studentAssistantService.create(req.body);
      res.status(201).json({ success: true, data: assistant });
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const assistant = await studentAssistantService.update(id, req.body);
      if (!assistant) {
        res.status(404).json({ success: false, error: 'Student assistant not found' });
        return;
      }
      res.json({ success: true, data: assistant });
    } catch (err) {
      next(err);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      await studentAssistantService.remove(id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
};
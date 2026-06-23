import { Request, Response, NextFunction } from 'express';
import { timeEntryService } from '../services/timeEntryService';

export const timeEntryController = {
  async getAll(_req: Request, res: Response, next: NextFunction) {
    try {
      const timeEntries = await timeEntryService.getAll();
      res.json({ success: true, data: timeEntries });
    } catch (err) {
      next(err);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const timeEntry = await timeEntryService.getById(id);
      if (!timeEntry) {
        res.status(404).json({ success: false, error: 'Time entry not found' });
        return;
      }
      res.json({ success: true, data: timeEntry });
    } catch (err) {
      next(err);
    }
  },

  async create(req: Request, res: Response, next: NextFunction) {
    try {
      const timeEntry = await timeEntryService.create(req.body);
      res.status(201).json({ success: true, data: timeEntry });
    } catch (err) {
      next(err);
    }
  },

  async clockIn(req: Request, res: Response, next: NextFunction) {
    try {
      const { student_assistant_id, clock_in } = req.body;
      const result = await timeEntryService.clockIn({
        student_assistant_id: Number(student_assistant_id),
        clock_in,
      });
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async update(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      const timeEntry = await timeEntryService.update(id, req.body);
      if (!timeEntry) {
        res.status(404).json({ success: false, error: 'Time entry not found' });
        return;
      }
      res.json({ success: true, data: timeEntry });
    } catch (err) {
      next(err);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const id = Number(req.params.id);
      await timeEntryService.remove(id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },

  async closeOpen(req: Request, res: Response, next: NextFunction) {
    try {
      const { schedule_block_id, student_assistant_id } = req.body;
      if (schedule_block_id === undefined || student_assistant_id === undefined) {
        res.status(400).json({ success: false, error: 'schedule_block_id and student_assistant_id required' });
        return;
      }
      const openEntry = await timeEntryService.getOpenByScheduleAndAssistant(Number(schedule_block_id), Number(student_assistant_id));
      if (!openEntry) {
        res.status(404).json({ success: false, error: 'No open time entry found for the given schedule block and student assistant' });
        return;
      }
      const updated = await timeEntryService.update(openEntry.id, { clock_out: new Date().toISOString() });
      if (!updated) {
        res.status(500).json({ success: false, error: 'Failed to update time entry' });
        return;
      }
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  },

  async closeOpenByAssistant(req: Request, res: Response, next: NextFunction) {
    try {
      const { student_assistant_id } = req.body;
      const updated = await timeEntryService.closeOpenByAssistant(Number(student_assistant_id));
      res.json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  },
};

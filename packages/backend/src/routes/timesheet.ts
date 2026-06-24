import { Router } from 'express';
import { timesheetController } from '../controllers/timesheetController';

const router = Router();

router.get('/hours-by-day', timesheetController.getHoursByDay);

export default router;
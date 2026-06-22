import { Router } from 'express';
import { todayShiftsController } from '../controllers/todayShiftsController';

const router = Router();

router.get('/today', todayShiftsController.getToday);

export default router;

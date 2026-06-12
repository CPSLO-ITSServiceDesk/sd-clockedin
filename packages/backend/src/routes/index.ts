import { Router, Application } from 'express';
import termRoutes from './terms';
import scheduleRoutes from './schedules';
import timeEntryRoutes from './timeEntries';
import studentAssistantRoutes from './studentAssistants';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

router.use('/terms', termRoutes);
router.use('/schedules', scheduleRoutes);
router.use('/time-entries', timeEntryRoutes);
router.use('/student-assistants', studentAssistantRoutes);

/** Mounts all API routes under the /api prefix. */
export function registerRoutes(app: Application): void {
  app.use('/api', router);
}

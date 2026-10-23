import { Router, Application } from 'express';
import termRoutes from './terms';
import scheduleRoutes from './schedules';
import timeEntryRoutes from './timeEntries';
import studentAssistantRoutes from './studentAssistants';
import scheduleBlocksRoutes from './scheduleBlocks';
import importRoutes from './import';
import teamsSyncRoutes from './teamsSync';
import todayShiftsRoutes from './todayShifts';
import analyticsRoutes from './analytics';
import shiftNormalizationRoutes from './shiftNormalization';
import timesheetRoutes from './timesheet';
import adminRoutes from './admins';
import scheduleDraftRoutes from './scheduleDrafts';
import teamsPublishRoutes from './teamsPublish';
import jobsRoutes from './jobs';

const router = Router();

/**
 * @openapi
 * /health:
 *   get:
 *     tags: [System]
 *     summary: Liveness check
 *     responses:
 *       200:
 *         description: Service is up
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: OK }
 *                 timestamp: { type: string, format: date-time }
 */
router.get('/health', (_req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

router.use('/terms', termRoutes);
router.use('/schedules', scheduleRoutes);
router.use('/time-entries', timeEntryRoutes);
router.use('/student-assistants', studentAssistantRoutes);
router.use('/schedule-blocks', scheduleBlocksRoutes);
router.use('/import', importRoutes);
router.use('/teams-sync', teamsSyncRoutes);
router.use('/shifts', todayShiftsRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/normalization', shiftNormalizationRoutes);
router.use('/timesheet', timesheetRoutes);
router.use('/admins', adminRoutes);
router.use('/schedule-drafts', scheduleDraftRoutes);
router.use('/teams-publish', teamsPublishRoutes);
router.use('/jobs', jobsRoutes);

/** Mounts all API routes under the /api prefix. */
export function registerRoutes(app: Application): void {
  app.use('/api', router);
}
import { Router } from 'express';
import { jobsController } from '../controllers/jobsController';

const router = Router();

/**
 * @openapi
 * /jobs/auto-clock-out:
 *   get:
 *     tags: [Jobs]
 *     summary: Close every open time entry at the daily cutoff
 *     description: >
 *       Vercel Cron calls this with `Authorization: Bearer $CRON_SECRET`.
 *       The same handler accepts POST. When auto clock-out is disabled, or
 *       the org-local time is still before AUTO_CLOCK_OUT_TIME, the response
 *       is skipped and no entries are closed. A missing CRON_SECRET refuses
 *       every request.
 *     parameters:
 *       - in: header
 *         name: Authorization
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Clock-out ran, or was skipped before the cutoff
 *       401:
 *         description: Missing or invalid CRON_SECRET
 *       500: { $ref: '#/components/responses/ServerError' }
 *   post:
 *     tags: [Jobs]
 *     summary: Close every open time entry at the daily cutoff
 *     description: Same as GET. Vercel Cron uses GET.
 *     parameters:
 *       - in: header
 *         name: Authorization
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Clock-out ran, or was skipped before the cutoff
 *       401:
 *         description: Missing or invalid CRON_SECRET
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.get('/auto-clock-out', jobsController.autoClockOut);
router.post('/auto-clock-out', jobsController.autoClockOut);

export default router;

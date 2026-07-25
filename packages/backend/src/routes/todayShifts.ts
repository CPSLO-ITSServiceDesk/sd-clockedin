import { Router } from 'express';
import { todayShiftsController } from '../controllers/todayShiftsController';

const router = Router();

/**
 * @openapi
 * /shifts/today:
 *   get:
 *     tags: [Shifts]
 *     summary: Get the shift board for a day
 *     description: >
 *       Returns each scheduled shift with its live status, plus any open time
 *       entries that have no matching block. Weekends have no scheduled
 *       shifts, so only unscheduled entries come back. Statuses are computed
 *       against the organization timezone.
 *     parameters:
 *       - in: query
 *         name: date
 *         description: Day to report on as YYYY-MM-DD. Defaults to today.
 *         schema: { type: string, format: date, example: '2026-06-22' }
 *       - in: query
 *         name: include_remote
 *         description: >
 *           Include remote shifts in the board. Off by default; remote-only
 *           students are always listed separately in remoteOnlyStudentIds.
 *         schema: { type: string, enum: ['1', 'true'] }
 *     responses:
 *       200: { $ref: '#/components/responses/TodayShifts' }
 *       400:
 *         description: date is not a valid calendar date
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.get('/today', todayShiftsController.getToday);

export default router;

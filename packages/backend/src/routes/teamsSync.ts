import { Router } from 'express';
import { body, query } from 'express-validator';
import { teamsSyncController } from '../controllers/teamsSyncController';
import { validate } from '../middleware/validate';

const router = Router();

/**
 * @openapi
 * /teams-sync/status:
 *   get:
 *     tags: [Teams Sync]
 *     summary: Get the last Teams Shifts sync status
 *     description: >
 *       Returns the latest sync outcome for the given term, or the active
 *       term when academic_term_id is omitted. graph_configured reflects live
 *       Microsoft Graph env, not the stored row. status is null when Graph is
 *       configured but this term has never been synced.
 *     parameters:
 *       - in: query
 *         name: academic_term_id
 *         schema: { type: integer, example: 1 }
 *         description: Term to read. Defaults to the active term.
 *     responses:
 *       200: { $ref: '#/components/responses/TeamsSyncStatus' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.get(
  '/status',
  query('academic_term_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('academic_term_id must be a positive integer'),
  validate,
  teamsSyncController.getStatus,
);

/**
 * @openapi
 * /teams-sync/sync-now:
 *   post:
 *     tags: [Teams Sync]
 *     summary: Sync roster, weekly blocks, and time off from Teams Shifts
 *     description: >
 *       Pulls published Teams Shifts members, shifts, and time off for the
 *       term window and writes ClockedIn. Uses the active term when
 *       academic_term_id is omitted. If Graph is not configured, records
 *       status not_configured and returns it without calling Microsoft.
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/TeamsSyncNowInput' }
 *     responses:
 *       200: { $ref: '#/components/responses/TeamsSyncStatus' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.post(
  '/sync-now',
  body('academic_term_id')
    .optional()
    .isInt({ min: 1 })
    .withMessage('academic_term_id must be a positive integer'),
  validate,
  teamsSyncController.syncNow,
);

export default router;

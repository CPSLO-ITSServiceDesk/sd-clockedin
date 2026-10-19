import { Router } from 'express';
import { body, param } from 'express-validator';
import { shiftNormalizationController } from '../controllers/shiftNormalizationController';
import { validate } from '../middleware/validate';

const router = Router();

/**
 * @openapi
 * /normalization/terms/{termId}/preview:
 *   get:
 *     tags: [Normalization]
 *     summary: Propose schedule blocks for orphaned time entries
 *     description: >
 *       Finds time entries in the term with no schedule_block_id and suggests
 *       the block each one most likely belongs to. Read-only; call the apply
 *       endpoint with the accepted subset to commit.
 *     parameters:
 *       - in: path
 *         name: termId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { $ref: '#/components/responses/NormalizationPreview' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.get(
  '/terms/:termId/preview',
  param('termId').isInt().withMessage('termId must be an integer'),
  validate,
  shiftNormalizationController.getPreview,
);

/**
 * @openapi
 * /normalization/terms/{termId}/apply:
 *   post:
 *     tags: [Normalization]
 *     summary: Attach time entries to the given schedule blocks
 *     description: >
 *       Each match is re-validated before it is written, so a proposal that
 *       has gone stale is reported under skipped rather than failing the
 *       whole batch.
 *     parameters:
 *       - in: path
 *         name: termId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/NormalizationApplyRequest' }
 *     responses:
 *       200: { $ref: '#/components/responses/NormalizationApplyResult' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.post(
  '/terms/:termId/apply',
  param('termId').isInt().withMessage('termId must be an integer'),
  body('matches').isArray().withMessage('matches must be an array'),
  body('matches.*.timeEntryId').isInt().withMessage('timeEntryId must be an integer'),
  body('matches.*.scheduleBlockId').isInt().withMessage('scheduleBlockId must be an integer'),
  validate,
  shiftNormalizationController.applyMatches,
);

/**
 * @openapi
 * /normalization/terms/{termId}/clock-outs:
 *   post:
 *     tags: [Normalization]
 *     summary: Set odd clock-outs to the shift's scheduled end
 *     description: >
 *       For the given time entries (from clockOutFixes in the preview), sets
 *       clock_out to the linked shift's scheduled end on the clock-in date.
 *       Fixes are recomputed first; entries that no longer look wrong (never
 *       clocked out on a past day, closed by auto clock-out after the shift
 *       ended, closed on a later day, more than 30 minutes past the shift end,
 *       or before the clock-in) are reported under skipped.
 *     parameters:
 *       - in: path
 *         name: termId
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [timeEntryIds]
 *             properties:
 *               timeEntryIds: { type: array, items: { type: integer } }
 *     responses:
 *       200: { description: Count applied plus skipped entries with reasons }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.post(
  '/terms/:termId/clock-outs',
  param('termId').isInt().withMessage('termId must be an integer'),
  body('timeEntryIds').isArray({ min: 1 }).withMessage('timeEntryIds must be a non-empty array'),
  body('timeEntryIds.*').isInt().withMessage('timeEntryIds must be integers'),
  validate,
  shiftNormalizationController.applyClockOutFixes,
);

export default router;

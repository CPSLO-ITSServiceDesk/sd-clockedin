import { Router } from 'express';
import { body, param } from 'express-validator';
import { scheduleBlocksController } from '../controllers/scheduleBlocksController';
import { validate } from '../middleware/validate';

const router = Router();

/**
 * @openapi
 * /schedule-blocks:
 *   get:
 *     tags: [Schedule Blocks]
 *     summary: List all schedule blocks
 *     responses:
 *       200: { $ref: '#/components/responses/ScheduleBlockList' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.get('/', scheduleBlocksController.getAll);

/**
 * @openapi
 * /schedule-blocks/{id}:
 *   get:
 *     tags: [Schedule Blocks]
 *     summary: Get a single schedule block
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { $ref: '#/components/responses/ScheduleBlock' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.get(
  '/:id',
  param('id').isInt().withMessage('id must be an integer'),
  validate,
  scheduleBlocksController.getById,
);

/**
 * @openapi
 * /schedule-blocks:
 *   post:
 *     tags: [Schedule Blocks]
 *     summary: Create a schedule block
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ScheduleBlockInput' }
 *     responses:
 *       201: { $ref: '#/components/responses/ScheduleBlockCreated' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.post(
  '/',
  body('created_at').optional().isString(),
  body('days')
    .optional()
    .isIn(['monday', 'tuesday', 'wednesday', 'thursday', 'friday'])
    .withMessage('days must be a valid day of week'),
  body('end_time').optional().isString(),
  body('schedule_id').optional().isInt(),
  body('start_time').optional().isString(),
  body('is_remote').optional().isBoolean(),
  // id is optional but typically not provided on create; still validate if present
  body('id').optional().isInt(),
  validate,
  scheduleBlocksController.create,
);

/**
 * @openapi
 * /schedule-blocks/{id}:
 *   put:
 *     tags: [Schedule Blocks]
 *     summary: Update a schedule block
 *     description: Only the supplied fields are changed.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ScheduleBlockInput' }
 *     responses:
 *       200: { $ref: '#/components/responses/ScheduleBlock' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.put(
  '/:id',
  param('id').isInt().withMessage('id must be an integer'),
  body('created_at').optional().isString(),
  body('days')
    .optional()
    .isIn(['monday', 'tuesday', 'wednesday', 'thursday', 'friday'])
    .withMessage('days must be a valid day of week'),
  body('end_time').optional().isString(),
  body('schedule_id').optional().isInt(),
  body('start_time').optional().isString(),
  body('is_remote').optional().isBoolean(),
  body('id').optional().isInt(),
  validate,
  scheduleBlocksController.update,
);

/**
 * @openapi
 * /schedule-blocks/{id}:
 *   delete:
 *     tags: [Schedule Blocks]
 *     summary: Delete a schedule block
 *     description: >
 *       Time entries that referenced the block are kept; their
 *       schedule_block_id is nulled out so worked hours are not lost.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       204: { $ref: '#/components/responses/NoContent' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.delete(
  '/:id',
  param('id').isInt().withMessage('id must be an integer'),
  validate,
  scheduleBlocksController.remove,
);

export default router;

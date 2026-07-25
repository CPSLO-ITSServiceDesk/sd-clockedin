import { Router } from 'express';
import { body, param } from 'express-validator';
import { schedulesController } from '../controllers/schedulesController';
import { scheduleBlocksController } from '../controllers/scheduleBlocksController';
import { validate } from '../middleware/validate';

const router = Router();

/**
 * @openapi
 * /schedules:
 *   get:
 *     tags: [Schedules]
 *     summary: List all schedules
 *     responses:
 *       200: { $ref: '#/components/responses/ScheduleList' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.get('/', schedulesController.getAll);

/**
 * @openapi
 * /schedules/{id}:
 *   get:
 *     tags: [Schedules]
 *     summary: Get a single schedule
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { $ref: '#/components/responses/Schedule' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.get(
  '/:id',
  param('id').isInt().withMessage('id must be an integer'),
  validate,
  schedulesController.getById,
);

/**
 * @openapi
 * /schedules/{id}/blocks:
 *   get:
 *     tags: [Schedules]
 *     summary: List the shift blocks belonging to a schedule
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { $ref: '#/components/responses/ScheduleBlockList' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.get(
  '/:id/blocks',
  param('id').isInt().withMessage('schedule_id must be an integer'),
  validate,
  scheduleBlocksController.getByScheduleId,
);

/**
 * @openapi
 * /schedules:
 *   post:
 *     tags: [Schedules]
 *     summary: Create a schedule
 *     description: >
 *       Leave the dates null to cover the whole term; set them to restrict
 *       the schedule to a window inside it.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ScheduleInput' }
 *     responses:
 *       201: { $ref: '#/components/responses/ScheduleCreated' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.post(
  '/',
  body('academic_term_id').optional().isInt(),
  body('student_assistant_id').optional().isInt(),
  body('start_date').optional({ nullable: true }).isISO8601(),
  body('end_date').optional({ nullable: true }).isISO8601(),
  body('created_at').optional().isString(),
  validate,
  schedulesController.create,
);

/**
 * @openapi
 * /schedules/{id}:
 *   put:
 *     tags: [Schedules]
 *     summary: Update a schedule
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
 *           schema: { $ref: '#/components/schemas/ScheduleInput' }
 *     responses:
 *       200: { $ref: '#/components/responses/Schedule' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.put(
  '/:id',
  param('id').isInt().withMessage('id must be an integer'),
  body('academic_term_id').optional().isInt(),
  body('student_assistant_id').optional().isInt(),
  body('start_date').optional({ nullable: true }).isISO8601(),
  body('end_date').optional({ nullable: true }).isISO8601(),
  body('created_at').optional().isString(),
  validate,
  schedulesController.update,
);

/**
 * @openapi
 * /schedules/{id}:
 *   delete:
 *     tags: [Schedules]
 *     summary: Delete a schedule
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
  schedulesController.remove,
);

export default router;

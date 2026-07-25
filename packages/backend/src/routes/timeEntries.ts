import { Router } from 'express';
import { body, param, ValidationChain } from 'express-validator';
import { timeEntryController } from '../controllers/timeEntryController';
import { validate } from '../middleware/validate';

const router = Router();

const nullableTimeEntryFields: ValidationChain[] = [
  body('clock_in').optional({ values: 'null' }).isString(),
  body('clock_out').optional({ values: 'null' }).isString(),
  body('created_at').optional({ values: 'null' }).isString(),
  body('schedule_block_id').optional({ values: 'null' }).isInt(),
  body('student_assistant_id').optional({ values: 'null' }).isInt(),
];

/**
 * @openapi
 * /time-entries:
 *   get:
 *     tags: [Time Entries]
 *     summary: List all time entries
 *     responses:
 *       200: { $ref: '#/components/responses/TimeEntryList' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.get('/', timeEntryController.getAll);

/**
 * @openapi
 * /time-entries/clock-in:
 *   post:
 *     tags: [Time Entries]
 *     summary: Clock a student in
 *     description: >
 *       Creates an open time entry and attributes it to the student's nearest
 *       shift today, if one exists. A student with an already-open entry is
 *       rejected rather than double-clocked.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ClockInRequest' }
 *     responses:
 *       201: { $ref: '#/components/responses/ClockInResult' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       404:
 *         description: Student assistant not found or inactive
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       409:
 *         description: Student is already clocked in
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.post(
  '/clock-in',
  body('student_assistant_id').isInt().withMessage('student_assistant_id must be an integer'),
  body('clock_in').optional().isString(),
  validate,
  timeEntryController.clockIn,
);

/**
 * @openapi
 * /time-entries/close-open:
 *   patch:
 *     tags: [Time Entries]
 *     summary: Clock out of a specific shift
 *     description: >
 *       Sets clock_out to now on the open entry for the given block and
 *       student.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CloseOpenRequest' }
 *     responses:
 *       200: { $ref: '#/components/responses/TimeEntry' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       404:
 *         description: No open time entry for that block and student
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.patch(
  '/close-open',
  body('schedule_block_id').isInt().withMessage('schedule_block_id must be an integer'),
  body('student_assistant_id').isInt().withMessage('student_assistant_id must be an integer'),
  validate,
  timeEntryController.closeOpen,
);

/**
 * @openapi
 * /time-entries/close-open-by-assistant:
 *   patch:
 *     tags: [Time Entries]
 *     summary: Clock a student out of whatever shift they are on
 *     description: >
 *       Used by the kiosk, where the student taps their card without picking
 *       a shift.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/CloseOpenByAssistantRequest' }
 *     responses:
 *       200: { $ref: '#/components/responses/TimeEntry' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       404:
 *         description: No open time entry for that student
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.patch(
  '/close-open-by-assistant',
  body('student_assistant_id').isInt().withMessage('student_assistant_id must be an integer'),
  validate,
  timeEntryController.closeOpenByAssistant,
);

/**
 * @openapi
 * /time-entries/{id}:
 *   get:
 *     tags: [Time Entries]
 *     summary: Get a single time entry
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { $ref: '#/components/responses/TimeEntry' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.get(
  '/:id',
  param('id').isInt().withMessage('id must be an integer'),
  validate,
  timeEntryController.getById,
);

/**
 * @openapi
 * /time-entries:
 *   post:
 *     tags: [Time Entries]
 *     summary: Create a time entry directly
 *     description: >
 *       Admin correction path. Prefer /time-entries/clock-in for normal
 *       clock-ins, which also matches the entry to a schedule block.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/TimeEntryInput' }
 *     responses:
 *       201: { $ref: '#/components/responses/TimeEntryCreated' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.post(
  '/',
  ...nullableTimeEntryFields,
  validate,
  timeEntryController.create,
);

/**
 * @openapi
 * /time-entries/{id}:
 *   put:
 *     tags: [Time Entries]
 *     summary: Update a time entry
 *     description: Identical to PATCH on the same path.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/TimeEntryInput' }
 *     responses:
 *       200: { $ref: '#/components/responses/TimeEntry' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.put(
  '/:id',
  param('id').isInt().withMessage('id must be an integer'),
  ...nullableTimeEntryFields,
  validate,
  timeEntryController.update,
);

/**
 * @openapi
 * /time-entries/{id}:
 *   patch:
 *     tags: [Time Entries]
 *     summary: Partially update a time entry
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/TimeEntryInput' }
 *     responses:
 *       200: { $ref: '#/components/responses/TimeEntry' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.patch(
  '/:id',
  param('id').isInt().withMessage('id must be an integer'),
  ...nullableTimeEntryFields,
  validate,
  timeEntryController.update,
);

/**
 * @openapi
 * /time-entries/{id}:
 *   delete:
 *     tags: [Time Entries]
 *     summary: Delete a time entry
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
  timeEntryController.remove,
);

export default router;

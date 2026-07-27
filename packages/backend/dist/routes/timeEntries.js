"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const timeEntryController_1 = require("../controllers/timeEntryController");
const validate_1 = require("../middleware/validate");
const router = (0, express_1.Router)();
const nullableTimeEntryFields = [
    (0, express_validator_1.body)('clock_in').optional({ values: 'null' }).isString(),
    (0, express_validator_1.body)('clock_out').optional({ values: 'null' }).isString(),
    (0, express_validator_1.body)('created_at').optional({ values: 'null' }).isString(),
    (0, express_validator_1.body)('schedule_block_id').optional({ values: 'null' }).isInt(),
    (0, express_validator_1.body)('student_assistant_id').optional({ values: 'null' }).isInt(),
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
router.get('/', timeEntryController_1.timeEntryController.getAll);
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
router.post('/clock-in', (0, express_validator_1.body)('student_assistant_id').isInt().withMessage('student_assistant_id must be an integer'), (0, express_validator_1.body)('clock_in').optional().isString(), validate_1.validate, timeEntryController_1.timeEntryController.clockIn);
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
router.patch('/close-open', (0, express_validator_1.body)('schedule_block_id').isInt().withMessage('schedule_block_id must be an integer'), (0, express_validator_1.body)('student_assistant_id').isInt().withMessage('student_assistant_id must be an integer'), validate_1.validate, timeEntryController_1.timeEntryController.closeOpen);
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
router.patch('/close-open-by-assistant', (0, express_validator_1.body)('student_assistant_id').isInt().withMessage('student_assistant_id must be an integer'), validate_1.validate, timeEntryController_1.timeEntryController.closeOpenByAssistant);
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
router.get('/:id', (0, express_validator_1.param)('id').isInt().withMessage('id must be an integer'), validate_1.validate, timeEntryController_1.timeEntryController.getById);
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
router.post('/', ...nullableTimeEntryFields, validate_1.validate, timeEntryController_1.timeEntryController.create);
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
router.put('/:id', (0, express_validator_1.param)('id').isInt().withMessage('id must be an integer'), ...nullableTimeEntryFields, validate_1.validate, timeEntryController_1.timeEntryController.update);
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
router.patch('/:id', (0, express_validator_1.param)('id').isInt().withMessage('id must be an integer'), ...nullableTimeEntryFields, validate_1.validate, timeEntryController_1.timeEntryController.update);
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
router.delete('/:id', (0, express_validator_1.param)('id').isInt().withMessage('id must be an integer'), validate_1.validate, timeEntryController_1.timeEntryController.remove);
exports.default = router;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const schedulesController_1 = require("../controllers/schedulesController");
const scheduleBlocksController_1 = require("../controllers/scheduleBlocksController");
const validate_1 = require("../middleware/validate");
const router = (0, express_1.Router)();
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
router.get('/', schedulesController_1.schedulesController.getAll);
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
router.get('/:id', (0, express_validator_1.param)('id').isInt().withMessage('id must be an integer'), validate_1.validate, schedulesController_1.schedulesController.getById);
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
router.get('/:id/blocks', (0, express_validator_1.param)('id').isInt().withMessage('schedule_id must be an integer'), validate_1.validate, scheduleBlocksController_1.scheduleBlocksController.getByScheduleId);
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
router.post('/', (0, express_validator_1.body)('academic_term_id').optional().isInt(), (0, express_validator_1.body)('student_assistant_id').optional().isInt(), (0, express_validator_1.body)('start_date').optional({ nullable: true }).isISO8601(), (0, express_validator_1.body)('end_date').optional({ nullable: true }).isISO8601(), (0, express_validator_1.body)('created_at').optional().isString(), validate_1.validate, schedulesController_1.schedulesController.create);
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
router.put('/:id', (0, express_validator_1.param)('id').isInt().withMessage('id must be an integer'), (0, express_validator_1.body)('academic_term_id').optional().isInt(), (0, express_validator_1.body)('student_assistant_id').optional().isInt(), (0, express_validator_1.body)('start_date').optional({ nullable: true }).isISO8601(), (0, express_validator_1.body)('end_date').optional({ nullable: true }).isISO8601(), (0, express_validator_1.body)('created_at').optional().isString(), validate_1.validate, schedulesController_1.schedulesController.update);
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
router.delete('/:id', (0, express_validator_1.param)('id').isInt().withMessage('id must be an integer'), validate_1.validate, schedulesController_1.schedulesController.remove);
exports.default = router;

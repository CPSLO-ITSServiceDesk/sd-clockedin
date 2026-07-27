"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const scheduleBlocksController_1 = require("../controllers/scheduleBlocksController");
const validate_1 = require("../middleware/validate");
const router = (0, express_1.Router)();
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
router.get('/', scheduleBlocksController_1.scheduleBlocksController.getAll);
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
router.get('/:id', (0, express_validator_1.param)('id').isInt().withMessage('id must be an integer'), validate_1.validate, scheduleBlocksController_1.scheduleBlocksController.getById);
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
router.post('/', (0, express_validator_1.body)('created_at').optional().isString(), (0, express_validator_1.body)('days')
    .optional()
    .isIn(['monday', 'tuesday', 'wednesday', 'thursday', 'friday'])
    .withMessage('days must be a valid day of week'), (0, express_validator_1.body)('end_time').optional().isString(), (0, express_validator_1.body)('schedule_id').optional().isInt(), (0, express_validator_1.body)('start_time').optional().isString(), (0, express_validator_1.body)('is_remote').optional().isBoolean(), 
// id is optional but typically not provided on create; still validate if present
(0, express_validator_1.body)('id').optional().isInt(), validate_1.validate, scheduleBlocksController_1.scheduleBlocksController.create);
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
router.put('/:id', (0, express_validator_1.param)('id').isInt().withMessage('id must be an integer'), (0, express_validator_1.body)('created_at').optional().isString(), (0, express_validator_1.body)('days')
    .optional()
    .isIn(['monday', 'tuesday', 'wednesday', 'thursday', 'friday'])
    .withMessage('days must be a valid day of week'), (0, express_validator_1.body)('end_time').optional().isString(), (0, express_validator_1.body)('schedule_id').optional().isInt(), (0, express_validator_1.body)('start_time').optional().isString(), (0, express_validator_1.body)('is_remote').optional().isBoolean(), (0, express_validator_1.body)('id').optional().isInt(), validate_1.validate, scheduleBlocksController_1.scheduleBlocksController.update);
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
router.delete('/:id', (0, express_validator_1.param)('id').isInt().withMessage('id must be an integer'), validate_1.validate, scheduleBlocksController_1.scheduleBlocksController.remove);
exports.default = router;

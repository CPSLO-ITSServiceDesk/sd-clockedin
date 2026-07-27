"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const termController_1 = require("../controllers/termController");
const validate_1 = require("../middleware/validate");
const router = (0, express_1.Router)();
/**
 * @openapi
 * /terms:
 *   get:
 *     tags: [Terms]
 *     summary: List all academic terms
 *     description: Returns every term, newest start date first.
 *     responses:
 *       200: { $ref: '#/components/responses/TermList' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.get('/', termController_1.termController.getAll);
/**
 * @openapi
 * /terms/{id}:
 *   get:
 *     tags: [Terms]
 *     summary: Get a single term
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { $ref: '#/components/responses/Term' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.get('/:id', (0, express_validator_1.param)('id').isInt().withMessage('id must be an integer'), validate_1.validate, termController_1.termController.getById);
/**
 * @openapi
 * /terms:
 *   post:
 *     tags: [Terms]
 *     summary: Create a term
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/TermInput' }
 *     responses:
 *       201: { $ref: '#/components/responses/TermCreated' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.post('/', (0, express_validator_1.body)('name').optional().isString(), (0, express_validator_1.body)('start_date').optional().isISO8601(), (0, express_validator_1.body)('end_date').optional().isISO8601(), (0, express_validator_1.body)('is_active').optional().isBoolean(), (0, express_validator_1.body)('off_days').optional().isObject(), (0, express_validator_1.body)('remote_shifts_allowed').optional().isBoolean(), validate_1.validate, termController_1.termController.create);
/**
 * @openapi
 * /terms/{id}:
 *   put:
 *     tags: [Terms]
 *     summary: Update a term
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
 *           schema: { $ref: '#/components/schemas/TermInput' }
 *     responses:
 *       200: { $ref: '#/components/responses/Term' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.put('/:id', (0, express_validator_1.param)('id').isInt().withMessage('id must be an integer'), (0, express_validator_1.body)('name').optional().isString(), (0, express_validator_1.body)('start_date').optional().isISO8601(), (0, express_validator_1.body)('end_date').optional().isISO8601(), (0, express_validator_1.body)('is_active').optional().isBoolean(), (0, express_validator_1.body)('off_days').optional().isObject(), (0, express_validator_1.body)('remote_shifts_allowed').optional().isBoolean(), validate_1.validate, termController_1.termController.update);
/**
 * @openapi
 * /terms/{id}:
 *   delete:
 *     tags: [Terms]
 *     summary: Delete a term
 *     description: Also deletes the term's schedules and their schedule blocks.
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
router.delete('/:id', (0, express_validator_1.param)('id').isInt().withMessage('id must be an integer'), validate_1.validate, termController_1.termController.remove);
exports.default = router;

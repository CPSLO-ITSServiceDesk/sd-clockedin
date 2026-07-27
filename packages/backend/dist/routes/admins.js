"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const adminController_1 = require("../controllers/adminController");
const validate_1 = require("../middleware/validate");
const router = (0, express_1.Router)();
/**
 * @openapi
 * /admins:
 *   get:
 *     tags: [Admins]
 *     summary: List all admins
 *     responses:
 *       200: { $ref: '#/components/responses/AdminList' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.get('/', adminController_1.adminController.getAll);
/**
 * @openapi
 * /admins/authorize:
 *   post:
 *     tags: [Admins]
 *     summary: Check whether an email belongs to an active admin
 *     description: >
 *       Called by the frontend after Supabase auth to gate access to the
 *       admin UI. Unlike every other endpoint, the response is a bare object
 *       with no success/data envelope.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/AuthorizeRequest' }
 *     responses:
 *       200:
 *         description: Email belongs to an active admin
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthorizeGranted' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       403:
 *         description: Email is unknown or the admin is inactive
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthorizeDenied' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.post('/authorize', (0, express_validator_1.body)('email').isEmail().withMessage('email must be a valid email'), (0, express_validator_1.body)('name').optional().isString(), validate_1.validate, adminController_1.adminController.authorize);
/**
 * @openapi
 * /admins/{id}:
 *   get:
 *     tags: [Admins]
 *     summary: Get a single admin
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { $ref: '#/components/responses/Admin' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.get('/:id', (0, express_validator_1.param)('id').isInt().withMessage('id must be an integer'), validate_1.validate, adminController_1.adminController.getById);
/**
 * @openapi
 * /admins:
 *   post:
 *     tags: [Admins]
 *     summary: Create an admin
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/AdminInput' }
 *     responses:
 *       201: { $ref: '#/components/responses/AdminCreated' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.post('/', (0, express_validator_1.body)('email').isEmail().withMessage('email must be a valid email'), (0, express_validator_1.body)('first_name').optional({ values: 'null' }).isString(), (0, express_validator_1.body)('last_name').optional({ values: 'null' }).isString(), (0, express_validator_1.body)('isactive').optional().isBoolean(), validate_1.validate, adminController_1.adminController.create);
/**
 * @openapi
 * /admins/{id}:
 *   put:
 *     tags: [Admins]
 *     summary: Update an admin
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
 *           schema: { $ref: '#/components/schemas/AdminUpdate' }
 *     responses:
 *       200: { $ref: '#/components/responses/Admin' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.put('/:id', (0, express_validator_1.param)('id').isInt().withMessage('id must be an integer'), (0, express_validator_1.body)('email').optional().isEmail().withMessage('email must be a valid email'), (0, express_validator_1.body)('first_name').optional({ values: 'null' }).isString(), (0, express_validator_1.body)('last_name').optional({ values: 'null' }).isString(), (0, express_validator_1.body)('isactive').optional().isBoolean(), (0, express_validator_1.body)('last_login').optional({ values: 'null' }).isISO8601(), validate_1.validate, adminController_1.adminController.update);
/**
 * @openapi
 * /admins/{id}:
 *   delete:
 *     tags: [Admins]
 *     summary: Delete an admin
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
router.delete('/:id', (0, express_validator_1.param)('id').isInt().withMessage('id must be an integer'), validate_1.validate, adminController_1.adminController.remove);
exports.default = router;

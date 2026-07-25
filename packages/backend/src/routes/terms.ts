import { Router } from 'express';
import { body, param } from 'express-validator';
import { termController } from '../controllers/termController';
import { validate } from '../middleware/validate';

const router = Router();

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
router.get('/', termController.getAll);

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
router.get(
  '/:id',
  param('id').isInt().withMessage('id must be an integer'),
  validate,
  termController.getById,
);

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
router.post(
  '/',
  body('name').optional().isString(),
  body('start_date').optional().isISO8601(),
  body('end_date').optional().isISO8601(),
  body('is_active').optional().isBoolean(),
  body('off_days').optional().isObject(),
  body('remote_shifts_allowed').optional().isBoolean(),
  validate,
  termController.create,
);

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
router.put(
  '/:id',
  param('id').isInt().withMessage('id must be an integer'),
  body('name').optional().isString(),
  body('start_date').optional().isISO8601(),
  body('end_date').optional().isISO8601(),
  body('is_active').optional().isBoolean(),
  body('off_days').optional().isObject(),
  body('remote_shifts_allowed').optional().isBoolean(),
  validate,
  termController.update,
);

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
router.delete(
  '/:id',
  param('id').isInt().withMessage('id must be an integer'),
  validate,
  termController.remove,
);

export default router;

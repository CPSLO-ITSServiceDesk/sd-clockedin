import { Router } from 'express';
import { body, param } from 'express-validator';
import { studentAssistantController } from '../controllers/studentAssistantController';
import { validate } from '../middleware/validate';

const router = Router();

/**
 * @openapi
 * /student-assistants:
 *   get:
 *     tags: [Student Assistants]
 *     summary: List all student assistants
 *     description: Includes inactive students.
 *     responses:
 *       200: { $ref: '#/components/responses/StudentAssistantList' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.get('/', studentAssistantController.getAll);

/**
 * @openapi
 * /student-assistants/{id}:
 *   get:
 *     tags: [Student Assistants]
 *     summary: Get a single student assistant
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { $ref: '#/components/responses/StudentAssistant' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.get(
  '/:id',
  param('id').isInt().withMessage('id must be an integer'),
  validate,
  studentAssistantController.getById,
);

/**
 * @openapi
 * /student-assistants:
 *   post:
 *     tags: [Student Assistants]
 *     summary: Create a student assistant
 *     description: position is the only required field.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/StudentAssistantInput' }
 *     responses:
 *       201: { $ref: '#/components/responses/StudentAssistantCreated' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.post(
  '/',
  body('first_name').optional().isString(),
  body('last_name').optional().isString(),
  body('is_active').optional().isBoolean(),
  body('polycard_id').optional().isInt(),
  body('work_email').optional({ values: 'null' }).isEmail().withMessage('work_email must be a valid email'),
  body('position')
    .isIn(['student_lead', 'student_assistant'])
    .withMessage('position must be a valid student role'),
  validate,
  studentAssistantController.create,
);

/**
 * @openapi
 * /student-assistants/{id}:
 *   put:
 *     tags: [Student Assistants]
 *     summary: Update a student assistant
 *     description: >
 *       Only the supplied fields are changed. Setting is_active to false
 *       removes the student from the shift board without deleting history.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: integer }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/StudentAssistantUpdate' }
 *     responses:
 *       200: { $ref: '#/components/responses/StudentAssistant' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.put(
  '/:id',
  param('id').isInt().withMessage('id must be an integer'),
  body('first_name').optional().isString(),
  body('last_name').optional().isString(),
  body('is_active').optional().isBoolean(),
  body('polycard_id').optional().isInt(),
  body('work_email').optional({ values: 'null' }).isEmail().withMessage('work_email must be a valid email'),
  body('position').optional().isIn(['student_lead', 'student_assistant']).withMessage('position must be a valid student role'),
  validate,
  studentAssistantController.update,
);

/**
 * @openapi
 * /student-assistants/{id}:
 *   delete:
 *     tags: [Student Assistants]
 *     summary: Delete a student assistant
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
  studentAssistantController.remove,
);

export default router;

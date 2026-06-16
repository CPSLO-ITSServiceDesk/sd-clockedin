import { Router } from 'express';
import { body, param } from 'express-validator';
import { studentAssistantController } from '../controllers/studentAssistantController';
import { validate } from '../middleware/validate';

const router = Router();

router.get('/', studentAssistantController.getAll);

router.get(
  '/:id',
  param('id').isInt().withMessage('id must be an integer'),
  validate,
  studentAssistantController.getById,
);

router.post(
  '/',
  body('first_name').optional().isString(),
  body('last_name').optional().isString(),
  body('is_active').optional().isBoolean(),
  body('polycard_id').optional().isInt(),
  body('position')
    .isIn(['student lead, student assistant'])
    .withMessage('position must be a valid student role'),
  validate,
  studentAssistantController.create,
);

router.put(
  '/:id',
  param('id').isInt().withMessage('id must be an integer'),
  body('first_name').optional().isString(),
  body('last_name').optional().isString(),
  body('is_active').optional().isBoolean(),
  body('polycard_id').optional().isInt(),
  body('position').optional().isIn(['student lead, student assistant']).withMessage('position must be a valid student role'),
  validate,
  studentAssistantController.update,
);

router.delete(
  '/:id',
  param('id').isInt().withMessage('id must be an integer'),
  validate,
  studentAssistantController.remove,
);

export default router;
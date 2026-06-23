import { Router } from 'express';
import { body, param } from 'express-validator';
import { termController } from '../controllers/termController';
import { validate } from '../middleware/validate';

const router = Router();

router.get('/', termController.getAll);

router.get(
  '/:id',
  param('id').isInt().withMessage('id must be an integer'),
  validate,
  termController.getById,
);

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

router.delete(
  '/:id',
  param('id').isInt().withMessage('id must be an integer'),
  validate,
  termController.remove,
);

export default router;

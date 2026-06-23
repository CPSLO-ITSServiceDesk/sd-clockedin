import { Router } from 'express';
import { body, param } from 'express-validator';
import { scheduleBlocksController } from '../controllers/scheduleBlocksController';
import { validate } from '../middleware/validate';

const router = Router();

router.get('/', scheduleBlocksController.getAll);

router.get(
  '/:id',
  param('id').isInt().withMessage('id must be an integer'),
  validate,
  scheduleBlocksController.getById,
);

router.post(
  '/',
  body('created_at').optional().isString(),
  body('days')
    .optional()
    .isIn(['monday', 'tuesday', 'wednesday', 'thursday', 'friday'])
    .withMessage('days must be a valid day of week'),
  body('end_time').optional().isString(),
  body('schedule_id').optional().isInt(),
  body('start_time').optional().isString(),
  body('is_remote').optional().isBoolean(),
  // id is optional but typically not provided on create; still validate if present
  body('id').optional().isInt(),
  validate,
  scheduleBlocksController.create,
);

router.put(
  '/:id',
  param('id').isInt().withMessage('id must be an integer'),
  body('created_at').optional().isString(),
  body('days')
    .optional()
    .isIn(['monday', 'tuesday', 'wednesday', 'thursday', 'friday'])
    .withMessage('days must be a valid day of week'),
  body('end_time').optional().isString(),
  body('schedule_id').optional().isInt(),
  body('start_time').optional().isString(),
  body('is_remote').optional().isBoolean(),
  body('id').optional().isInt(),
  validate,
  scheduleBlocksController.update,
);

router.delete(
  '/:id',
  param('id').isInt().withMessage('id must be an integer'),
  validate,
  scheduleBlocksController.remove,
);

export default router;
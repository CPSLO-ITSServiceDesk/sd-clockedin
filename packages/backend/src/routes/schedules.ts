import { Router } from 'express';
import { body, param } from 'express-validator';
import { schedulesController } from '../controllers/schedulesController';
import { scheduleBlocksController } from '../controllers/scheduleBlocksController';
import { validate } from '../middleware/validate';

const router = Router();

router.get('/', schedulesController.getAll);

router.get(
  '/:id',
  param('id').isInt().withMessage('id must be an integer'),
  validate,
  schedulesController.getById,
);

router.get(
  '/:id/blocks',
  param('id').isInt().withMessage('schedule_id must be an integer'),
  validate,
  scheduleBlocksController.getByScheduleId,
);

router.post(
  '/',
  body('academic_term_id').optional().isInt(),
  body('student_assistant_id').optional().isInt(),
  body('created_at').optional().isString(),
  validate,
  schedulesController.create,
);

router.put(
  '/:id',
  param('id').isInt().withMessage('id must be an integer'),
  body('academic_term_id').optional().isInt(),
  body('student_assistant_id').optional().isInt(),
  body('created_at').optional().isString(),
  validate,
  schedulesController.update,
);

router.delete(
  '/:id',
  param('id').isInt().withMessage('id must be an integer'),
  validate,
  schedulesController.remove,
);

export default router;
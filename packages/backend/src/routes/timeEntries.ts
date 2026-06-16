import { Router } from 'express';
import { body, param } from 'express-validator';
import { timeEntryController } from '../controllers/timeEntryController';
import { validate } from '../middleware/validate';

const router = Router();

router.get('/', timeEntryController.getAll);

router.get(
  '/:id',
  param('id').isInt().withMessage('id must be an integer'),
  validate,
  timeEntryController.getById,
);

router.post(
  '/',
  body('clock_in').optional().isString(),
  body('clock_out').optional().isString(),
  body('created_at').optional().isString(),
  body('schedule_block_id').optional().isInt(),
  body('student_assistant_id').optional().isInt(),
  validate,
  timeEntryController.create,
);

router.put(
  '/:id',
  param('id').isInt().withMessage('id must be an integer'),
  body('clock_in').optional().isString(),
  body('clock_out').optional().isString(),
  body('created_at').optional().isString(),
  body('schedule_block_id').optional().isInt(),
  body('student_assistant_id').optional().isInt(),
  validate,
  timeEntryController.update,
);

router.delete(
  '/:id',
  param('id').isInt().withMessage('id must be an integer'),
  validate,
  timeEntryController.remove,
);

// Custom route to close an open time entry for a schedule block and student assistant
router.patch(
  '/close-open',
  body('schedule_block_id').isInt().withMessage('schedule_block_id must be an integer'),
  body('student_assistant_id').isInt().withMessage('student_assistant_id must be an integer'),
  validate,
  timeEntryController.closeOpen,
);

export default router;
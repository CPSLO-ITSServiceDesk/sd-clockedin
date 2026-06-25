import { Router } from 'express';
import { body, param, ValidationChain } from 'express-validator';
import { timeEntryController } from '../controllers/timeEntryController';
import { validate } from '../middleware/validate';

const router = Router();

const nullableTimeEntryFields: ValidationChain[] = [
  body('clock_in').optional({ values: 'null' }).isString(),
  body('clock_out').optional({ values: 'null' }).isString(),
  body('created_at').optional({ values: 'null' }).isString(),
  body('schedule_block_id').optional({ values: 'null' }).isInt(),
  body('student_assistant_id').optional({ values: 'null' }).isInt(),
];

router.get('/', timeEntryController.getAll);

router.post(
  '/clock-in',
  body('student_assistant_id').isInt().withMessage('student_assistant_id must be an integer'),
  body('clock_in').optional().isString(),
  validate,
  timeEntryController.clockIn,
);

router.patch(
  '/close-open',
  body('schedule_block_id').isInt().withMessage('schedule_block_id must be an integer'),
  body('student_assistant_id').isInt().withMessage('student_assistant_id must be an integer'),
  validate,
  timeEntryController.closeOpen,
);

router.patch(
  '/close-open-by-assistant',
  body('student_assistant_id').isInt().withMessage('student_assistant_id must be an integer'),
  validate,
  timeEntryController.closeOpenByAssistant,
);

router.get(
  '/:id',
  param('id').isInt().withMessage('id must be an integer'),
  validate,
  timeEntryController.getById,
);

router.post(
  '/',
  ...nullableTimeEntryFields,
  validate,
  timeEntryController.create,
);

router.put(
  '/:id',
  param('id').isInt().withMessage('id must be an integer'),
  ...nullableTimeEntryFields,
  validate,
  timeEntryController.update,
);

router.patch(
  '/:id',
  param('id').isInt().withMessage('id must be an integer'),
  ...nullableTimeEntryFields,
  validate,
  timeEntryController.update,
);

router.delete(
  '/:id',
  param('id').isInt().withMessage('id must be an integer'),
  validate,
  timeEntryController.remove,
);

export default router;
import { Router } from 'express';
import { body, param } from 'express-validator';
import { shiftNormalizationController } from '../controllers/shiftNormalizationController';
import { validate } from '../middleware/validate';

const router = Router();

router.get(
  '/terms/:termId/preview',
  param('termId').isInt().withMessage('termId must be an integer'),
  validate,
  shiftNormalizationController.getPreview,
);

router.post(
  '/terms/:termId/apply',
  param('termId').isInt().withMessage('termId must be an integer'),
  body('matches').isArray().withMessage('matches must be an array'),
  body('matches.*.timeEntryId').isInt().withMessage('timeEntryId must be an integer'),
  body('matches.*.scheduleBlockId').isInt().withMessage('scheduleBlockId must be an integer'),
  validate,
  shiftNormalizationController.applyMatches,
);

export default router;

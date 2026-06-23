import { Router } from 'express';
import { param, query } from 'express-validator';
import { analyticsController } from '../controllers/analyticsController';
import { validate } from '../middleware/validate';

const router = Router();

router.get(
  '/terms/:termId',
  param('termId').isInt().withMessage('termId must be an integer'),
  validate,
  analyticsController.getTermAnalytics,
);

router.get(
  '/students/:studentId',
  param('studentId').isInt().withMessage('studentId must be an integer'),
  query('termId').isInt().withMessage('termId must be an integer'),
  validate,
  analyticsController.getStudentAnalytics,
);

export default router;

import { Router } from 'express';
import multer from 'multer';
import { body } from 'express-validator';
import { scheduleImportController } from '../controllers/scheduleImportController';
import { validate } from '../middleware/validate';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = file.originalname.toLowerCase();
    if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.csv')) {
      cb(null, true);
      return;
    }
    cb(new Error('Only .xlsx, .xls, and .csv files are allowed'));
  },
});

const router = Router();

router.post(
  '/schedules',
  upload.single('file'),
  body('academic_term_id').isInt({ min: 1 }).withMessage('academic_term_id is required'),
  validate,
  scheduleImportController.importSchedules,
);

export default router;

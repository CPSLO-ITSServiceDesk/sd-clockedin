import { Router } from 'express';
import { body, param } from 'express-validator';
import { adminController } from '../controllers/adminController';
import { validate } from '../middleware/validate';

const router = Router();

router.get('/', adminController.getAll);

router.get(
  '/:id',
  param('id').isInt().withMessage('id must be an integer'),
  validate,
  adminController.getById,
);

router.post(
  '/',
  body('email').isEmail().withMessage('email must be a valid email'),
  body('first_name').optional({ values: 'null' }).isString(),
  body('last_name').optional({ values: 'null' }).isString(),
  body('isactive').optional().isBoolean(),
  validate,
  adminController.create,
);

router.put(
  '/:id',
  param('id').isInt().withMessage('id must be an integer'),
  body('email').optional().isEmail().withMessage('email must be a valid email'),
  body('first_name').optional({ values: 'null' }).isString(),
  body('last_name').optional({ values: 'null' }).isString(),
  body('isactive').optional().isBoolean(),
  body('last_login').optional({ values: 'null' }).isISO8601(),
  validate,
  adminController.update,
);

router.delete(
  '/:id',
  param('id').isInt().withMessage('id must be an integer'),
  validate,
  adminController.remove,
);

export default router;

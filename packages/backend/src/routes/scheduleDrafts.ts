import { Router } from 'express';
import multer from 'multer';
import { body, param, query } from 'express-validator';
import { scheduleDraftController } from '../controllers/scheduleDraftController';
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
const idParam = param('id').isInt({ min: 1 }).withMessage('id must be a positive integer');

/**
 * @openapi
 * /schedule-drafts:
 *   get:
 *     tags: [Schedule Builder]
 *     summary: Latest schedule draft for a term, or for every term
 *     description: >
 *       With academic_term_id, returns that term's latest draft (or null);
 *       active students missing from it are added. Without it, returns the
 *       latest draft of every term that has one (Schedules home).
 *     parameters:
 *       - in: query
 *         name: academic_term_id
 *         required: false
 *         schema: { type: integer }
 *     responses:
 *       200: { description: The draft, or null }
 *       503: { description: The schedule_draft migration has not been applied }
 *   post:
 *     tags: [Schedule Builder]
 *     summary: Start a schedule draft for a term
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [academic_term_id]
 *             properties:
 *               academic_term_id: { type: integer }
 *               copy_from_term_id:
 *                 type: integer
 *                 description: Seed shifts from this term's weekly schedules (as a starting point)
 *     responses:
 *       201: { description: The new draft, seeded with every active student }
 */
router.get(
  '/',
  query('academic_term_id').optional().isInt({ min: 1 }).withMessage('academic_term_id must be a positive integer'),
  validate,
  scheduleDraftController.getLatest,
);

router.post(
  '/',
  body('academic_term_id').isInt({ min: 1 }).withMessage('academic_term_id is required'),
  body('copy_from_term_id').optional({ values: 'null' }).isInt({ min: 1 }),
  validate,
  scheduleDraftController.create,
);

/**
 * @openapi
 * /schedule-drafts/{id}:
 *   get:
 *     tags: [Schedule Builder]
 *     summary: Get a schedule draft
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: The draft }
 *       404: { $ref: '#/components/responses/NotFound' }
 *   put:
 *     tags: [Schedule Builder]
 *     summary: Save draft progress
 *     description: Only the supplied fields (step, rules, people, unmatched, change_log) are replaced.
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: The saved draft }
 *   delete:
 *     tags: [Schedule Builder]
 *     summary: Discard a draft
 *     description: Published schedules are not affected.
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     responses:
 *       204: { description: Deleted }
 */
router.get('/:id', idParam, validate, scheduleDraftController.getById);

router.put(
  '/:id',
  idParam,
  body('step').optional().isInt({ min: 1, max: 4 }),
  body('rules').optional().isObject(),
  body('people').optional().isArray(),
  body('unmatched').optional().isArray(),
  body('change_log').optional().isArray(),
  validate,
  scheduleDraftController.update,
);

router.delete('/:id', idParam, validate, scheduleDraftController.remove);

/**
 * @openapi
 * /schedule-drafts/{id}/import:
 *   post:
 *     tags: [Schedule Builder]
 *     summary: Import a Microsoft Forms availability export
 *     description: >
 *       Accepts .csv, .xlsx or .xls up to 5 MB with Name, Email, one
 *       "What times are you available on <day>?" column per weekday,
 *       min/ideal/max hours and notes. Rows are matched to students by work
 *       email, then by name; the rest come back as unmatched.
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file: { type: string, format: binary }
 *     responses:
 *       200: { description: The updated draft plus the column mapping and match counts }
 *       400: { description: File missing or not a Forms availability export }
 */
router.post('/:id/import', idParam, validate, upload.single('file'), scheduleDraftController.importAvailability);

/**
 * @openapi
 * /schedule-drafts/{id}/generate:
 *   post:
 *     tags: [Schedule Builder]
 *     summary: Generate shifts from availability and desk rules
 *     description: Replaces every assignment in the draft. Nothing is published.
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: The draft with generated assignments }
 */
router.post('/:id/generate', idParam, validate, scheduleDraftController.generate);

/**
 * @openapi
 * /schedule-drafts/{id}/publish-preview:
 *   get:
 *     tags: [Schedule Builder]
 *     summary: Compare the draft with the term's current schedules
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: Shift counts that would be added, removed and kept }
 * /schedule-drafts/{id}/publish:
 *   post:
 *     tags: [Schedule Builder]
 *     summary: Write the draft to the term's schedules
 *     description: >
 *       Replaces each student's weekly blocks for the term. Unchanged blocks
 *       keep their ids, so linked time entries stay linked.
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: The published draft }
 */
router.get('/:id/publish-preview', idParam, validate, scheduleDraftController.publishPreview);
router.post('/:id/publish', idParam, validate, scheduleDraftController.publish);

export default router;

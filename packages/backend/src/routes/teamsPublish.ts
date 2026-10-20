import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { teamsPublishController } from '../controllers/teamsPublishController';
import { validate } from '../middleware/validate';

const router = Router();

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const rangeRules = [
  body('from_date').matches(DATE).withMessage('from_date must be YYYY-MM-DD'),
  body('to_date')
    .matches(DATE)
    .withMessage('to_date must be YYYY-MM-DD')
    .custom((to, { req }) => to >= req.body.from_date)
    .withMessage('to_date must be on or after from_date'),
];
const personRules = [
  param('studentId').isInt({ min: 1 }).withMessage('studentId must be a positive integer'),
  body('academic_term_id').isInt({ min: 1 }).withMessage('academic_term_id is required'),
  body('shifts').isArray().withMessage('shifts must be an array'),
  body('shifts.*.day').isIn(['monday', 'tuesday', 'wednesday', 'thursday', 'friday']),
  body('shifts.*.start_time').matches(/^\d{2}:\d{2}$/),
  body('shifts.*.end_time').matches(/^\d{2}:\d{2}$/),
  body('shifts.*.role').optional().isIn(['L', 'm', 't']),
  ...rangeRules,
];
const draftRules = [param('draftId').isInt({ min: 1 }).withMessage('draftId must be a positive integer'), ...rangeRules];

/**
 * @openapi
 * /teams-publish/drafts/{draftId}/preview:
 *   post:
 *     tags: [Teams Publish]
 *     summary: Compare a schedule draft with Teams Shifts for the chosen weeks
 *     description: >
 *       Lays each person's weekly pattern over from_date–to_date (inside the
 *       term, skipping vacation days, running swap days) and diffs it against
 *       their Teams shifts in the scheduling group. Read-only.
 *     parameters:
 *       - { in: path, name: draftId, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [from_date, to_date]
 *             properties:
 *               from_date: { type: string, format: date }
 *               to_date: { type: string, format: date }
 *     responses:
 *       200: { description: Shifts to create, keep, remove and restore }
 *       400: { description: Teams not configured, or dates outside the term }
 * /teams-publish/drafts/{draftId}/publish:
 *   post:
 *     tags: [Teams Publish]
 *     summary: Send a schedule draft to Teams Shifts as drafts
 *     description: >
 *       Creates missing shifts as unshared drafts, stages unwanted shared
 *       shifts for deletion and deletes unwanted unshared drafts. Nothing is
 *       visible to students until a manager shares the schedule in Teams;
 *       ClockedIn picks shared shifts up on the next sync.
 *     parameters:
 *       - { in: path, name: draftId, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: Counts plus any failed Graph calls }
 */
router.post('/drafts/:draftId/preview', draftRules, validate, teamsPublishController.previewDraft);
router.post('/drafts/:draftId/publish', draftRules, validate, teamsPublishController.publishDraft);

/**
 * @openapi
 * /teams-publish/students/{studentId}/preview:
 *   post:
 *     tags: [Teams Publish]
 *     summary: Compare one person's new weekly shifts with Teams for the chosen weeks
 *     parameters:
 *       - { in: path, name: studentId, required: true, schema: { type: integer } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [academic_term_id, from_date, to_date, shifts]
 *             properties:
 *               academic_term_id: { type: integer }
 *               from_date: { type: string, format: date }
 *               to_date: { type: string, format: date }
 *               shifts:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     day: { type: string, enum: [monday, tuesday, wednesday, thursday, friday] }
 *                     start_time: { type: string, example: '09:00' }
 *                     end_time: { type: string, example: '12:30' }
 *                     role: { type: string, enum: [L, m, t] }
 *     responses:
 *       200: { description: Shifts to create, keep, remove and restore for that person }
 * /teams-publish/students/{studentId}/publish:
 *   post:
 *     tags: [Teams Publish]
 *     summary: Send one person's shift change to Teams Shifts as drafts
 *     description: Only that person's shifts in the chosen weeks change.
 *     parameters:
 *       - { in: path, name: studentId, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: Counts plus any failed Graph calls }
 */
router.post('/students/:studentId/preview', personRules, validate, teamsPublishController.previewPerson);
router.post('/students/:studentId/publish', personRules, validate, teamsPublishController.publishPerson);

/**
 * @openapi
 * /teams-publish/students/{studentId}/pattern:
 *   get:
 *     tags: [Teams Publish]
 *     summary: A person's weekly shifts as they are in Teams
 *     description: >
 *       Read from the week containing `week` (pending drafts included, staged
 *       deletions excluded), or the latest of the previous four weeks that has
 *       shifts. Used to start the 14.5 editor from what's really in Teams.
 *     parameters:
 *       - { in: path, name: studentId, required: true, schema: { type: integer } }
 *       - { in: query, name: academic_term_id, required: true, schema: { type: integer } }
 *       - { in: query, name: week, required: true, schema: { type: string, format: date } }
 *     responses:
 *       200: { description: 'Weekly shifts, the week they came from, and whether the student is linked to Teams' }
 */
router.get(
  '/students/:studentId/pattern',
  param('studentId').isInt({ min: 1 }),
  query('academic_term_id').isInt({ min: 1 }),
  query('week').matches(DATE),
  validate,
  teamsPublishController.personPattern,
);

/**
 * @openapi
 * /teams-publish/terms/{termId}/history:
 *   get:
 *     tags: [Teams Publish]
 *     summary: Recent sends to Teams for a term (newest first)
 *     parameters:
 *       - { in: path, name: termId, required: true, schema: { type: integer } }
 *     responses:
 *       200: { description: Versions list; empty until the teams_schedule_publish migration is applied }
 */
router.get(
  '/terms/:termId/history',
  param('termId').isInt({ min: 1 }).withMessage('termId must be a positive integer'),
  validate,
  teamsPublishController.history,
);

export default router;

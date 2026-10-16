import { Router } from 'express';
import { body, param, query } from 'express-validator';
import { timesheetController } from '../controllers/timesheetController';
import { isValidMonth } from '../lib/timesheetMonth';
import { validate } from '../middleware/validate';

const router = Router();

/**
 * @openapi
 * /timesheet/hours-by-day:
 *   get:
 *     tags: [Timesheet]
 *     summary: Total hours worked per day for one student
 *     description: >
 *       Sums completed time entries between the two dates, inclusive. Entries
 *       still open (no clock_out) contribute nothing. Days with no hours are
 *       omitted from the response rather than returned as zero.
 *     parameters:
 *       - in: query
 *         name: studentId
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: startDate
 *         required: true
 *         schema: { type: string, format: date, example: '2026-06-01' }
 *       - in: query
 *         name: endDate
 *         required: true
 *         schema: { type: string, format: date, example: '2026-06-30' }
 *     responses:
 *       200: { $ref: '#/components/responses/HoursByDay' }
 *       400:
 *         description: studentId, startDate, or endDate is missing
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.get('/hours-by-day', timesheetController.getHoursByDay);

const monthMessage = 'month must be YYYY-MM';

/**
 * @openapi
 * /timesheet/months:
 *   get:
 *     tags: [Timesheet]
 *     summary: Worked vs scheduled hours for every student in a month
 *     description: >
 *       Compares closed time entries (by org-local clock-in date) with
 *       scheduled blocks. Campus vacation days are skipped, Teams time off
 *       marks a day excused, and remote blocks never need a clock-in.
 *       Scheduled hours only count days up to yesterday; today and later are
 *       not judged yet. Includes each student's verification for the month.
 *     parameters:
 *       - in: query
 *         name: month
 *         required: true
 *         schema: { type: string, example: '2026-09' }
 *     responses:
 *       200: { $ref: '#/components/responses/MonthTimesheetSummary' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.get(
  '/months',
  query('month').custom(isValidMonth).withMessage(monthMessage),
  validate,
  timesheetController.getMonthSummary,
);

/**
 * @openapi
 * /timesheet/students/{studentId}/months:
 *   get:
 *     tags: [Timesheet]
 *     summary: One student's day-by-day timesheet for a month
 *     description: >
 *       Same comparison as /timesheet/months, with each day's scheduled blocks,
 *       time entries and status.
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: month
 *         required: true
 *         schema: { type: string, example: '2026-09' }
 *     responses:
 *       200: { $ref: '#/components/responses/StudentMonthTimesheet' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.get(
  '/students/:studentId/months',
  param('studentId').isInt().withMessage('studentId must be an integer'),
  query('month').custom(isValidMonth).withMessage(monthMessage),
  validate,
  timesheetController.getStudentMonth,
);

/**
 * @openapi
 * /timesheet/students/{studentId}/months/{month}/verification:
 *   put:
 *     tags: [Timesheet]
 *     summary: Mark a student's month verified
 *     description: Idempotent; re-verifying updates verified_at and verified_by.
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: month
 *         required: true
 *         schema: { type: string, example: '2026-09' }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               verified_by: { type: string, description: 'Admin email', example: 'admin@example.edu' }
 *     responses:
 *       200: { $ref: '#/components/responses/TimesheetVerification' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       503:
 *         description: The timesheet_verification migration has not been applied
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       500: { $ref: '#/components/responses/ServerError' }
 *   delete:
 *     tags: [Timesheet]
 *     summary: Remove a month's verification
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema: { type: integer }
 *       - in: path
 *         name: month
 *         required: true
 *         schema: { type: string, example: '2026-09' }
 *     responses:
 *       204: { description: Verification removed (or there was none) }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.put(
  '/students/:studentId/months/:month/verification',
  param('studentId').isInt().withMessage('studentId must be an integer'),
  param('month').custom(isValidMonth).withMessage(monthMessage),
  body('verified_by').optional({ values: 'null' }).isString().isLength({ max: 320 }),
  validate,
  timesheetController.verify,
);

router.delete(
  '/students/:studentId/months/:month/verification',
  param('studentId').isInt().withMessage('studentId must be an integer'),
  param('month').custom(isValidMonth).withMessage(monthMessage),
  validate,
  timesheetController.unverify,
);

export default router;

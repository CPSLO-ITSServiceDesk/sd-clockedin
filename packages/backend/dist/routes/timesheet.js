"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const timesheetController_1 = require("../controllers/timesheetController");
const router = (0, express_1.Router)();
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
router.get('/hours-by-day', timesheetController_1.timesheetController.getHoursByDay);
exports.default = router;

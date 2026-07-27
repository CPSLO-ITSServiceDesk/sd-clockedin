"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const analyticsController_1 = require("../controllers/analyticsController");
const validate_1 = require("../middleware/validate");
const router = (0, express_1.Router)();
/**
 * @openapi
 * /analytics/terms/{termId}:
 *   get:
 *     tags: [Analytics]
 *     summary: Punctuality metrics across a whole term
 *     description: >
 *       Evaluates every scheduled shift in the term against its time entry.
 *       Vacation days and weekday swaps from the term's off_days are excluded.
 *     parameters:
 *       - in: path
 *         name: termId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200: { $ref: '#/components/responses/TermAnalytics' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.get('/terms/:termId', (0, express_validator_1.param)('termId').isInt().withMessage('termId must be an integer'), validate_1.validate, analyticsController_1.analyticsController.getTermAnalytics);
/**
 * @openapi
 * /analytics/students/{studentId}:
 *   get:
 *     tags: [Analytics]
 *     summary: Punctuality metrics for one student within a term
 *     parameters:
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema: { type: integer }
 *       - in: query
 *         name: termId
 *         required: true
 *         description: Metrics are always scoped to a single term.
 *         schema: { type: integer }
 *     responses:
 *       200: { $ref: '#/components/responses/StudentAnalytics' }
 *       400: { $ref: '#/components/responses/ValidationError' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.get('/students/:studentId', (0, express_validator_1.param)('studentId').isInt().withMessage('studentId must be an integer'), (0, express_validator_1.query)('termId').isInt().withMessage('termId must be an integer'), validate_1.validate, analyticsController_1.analyticsController.getStudentAnalytics);
exports.default = router;

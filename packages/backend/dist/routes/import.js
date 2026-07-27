"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const express_validator_1 = require("express-validator");
const scheduleImportController_1 = require("../controllers/scheduleImportController");
const validate_1 = require("../middleware/validate");
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
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
const router = (0, express_1.Router)();
/**
 * @openapi
 * /import/schedules:
 *   post:
 *     tags: [Import]
 *     summary: Import student schedules from a spreadsheet
 *     description: >
 *       Accepts .xlsx, .xls, or .csv up to 5 MB. Runs as a dry run by
 *       default, returning the students and blocks it would create or update
 *       so the result can be reviewed before committing. Students are matched
 *       to existing records by work email.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file, academic_term_id]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               academic_term_id:
 *                 type: integer
 *                 example: 1
 *               dry_run:
 *                 type: string
 *                 description: Send "false" to write the import to the database.
 *                 enum: ['true', 'false']
 *     parameters:
 *       - in: query
 *         name: dry_run
 *         description: Alternative to the form field; the form field wins.
 *         schema: { type: string, enum: ['true', 'false'] }
 *     responses:
 *       200: { $ref: '#/components/responses/ScheduleImportResult' }
 *       400:
 *         description: File missing, wrong type, or invalid academic_term_id
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorResponse' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */
router.post('/schedules', upload.single('file'), (0, express_validator_1.body)('academic_term_id').isInt({ min: 1 }).withMessage('academic_term_id is required'), validate_1.validate, scheduleImportController_1.scheduleImportController.importSchedules);
exports.default = router;

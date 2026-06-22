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
router.post('/schedules', upload.single('file'), (0, express_validator_1.body)('academic_term_id').isInt({ min: 1 }).withMessage('academic_term_id is required'), validate_1.validate, scheduleImportController_1.scheduleImportController.importSchedules);
exports.default = router;

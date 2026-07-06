"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const timeEntryController_1 = require("../controllers/timeEntryController");
const validate_1 = require("../middleware/validate");
const router = (0, express_1.Router)();
const nullableTimeEntryFields = [
    (0, express_validator_1.body)('clock_in').optional({ values: 'null' }).isString(),
    (0, express_validator_1.body)('clock_out').optional({ values: 'null' }).isString(),
    (0, express_validator_1.body)('created_at').optional({ values: 'null' }).isString(),
    (0, express_validator_1.body)('schedule_block_id').optional({ values: 'null' }).isInt(),
    (0, express_validator_1.body)('student_assistant_id').optional({ values: 'null' }).isInt(),
];
router.get('/', timeEntryController_1.timeEntryController.getAll);
router.post('/clock-in', (0, express_validator_1.body)('student_assistant_id').isInt().withMessage('student_assistant_id must be an integer'), (0, express_validator_1.body)('clock_in').optional().isString(), validate_1.validate, timeEntryController_1.timeEntryController.clockIn);
router.patch('/close-open', (0, express_validator_1.body)('schedule_block_id').isInt().withMessage('schedule_block_id must be an integer'), (0, express_validator_1.body)('student_assistant_id').isInt().withMessage('student_assistant_id must be an integer'), validate_1.validate, timeEntryController_1.timeEntryController.closeOpen);
router.patch('/close-open-by-assistant', (0, express_validator_1.body)('student_assistant_id').isInt().withMessage('student_assistant_id must be an integer'), validate_1.validate, timeEntryController_1.timeEntryController.closeOpenByAssistant);
router.get('/:id', (0, express_validator_1.param)('id').isInt().withMessage('id must be an integer'), validate_1.validate, timeEntryController_1.timeEntryController.getById);
router.post('/', ...nullableTimeEntryFields, validate_1.validate, timeEntryController_1.timeEntryController.create);
router.put('/:id', (0, express_validator_1.param)('id').isInt().withMessage('id must be an integer'), ...nullableTimeEntryFields, validate_1.validate, timeEntryController_1.timeEntryController.update);
router.patch('/:id', (0, express_validator_1.param)('id').isInt().withMessage('id must be an integer'), ...nullableTimeEntryFields, validate_1.validate, timeEntryController_1.timeEntryController.update);
router.delete('/:id', (0, express_validator_1.param)('id').isInt().withMessage('id must be an integer'), validate_1.validate, timeEntryController_1.timeEntryController.remove);
exports.default = router;

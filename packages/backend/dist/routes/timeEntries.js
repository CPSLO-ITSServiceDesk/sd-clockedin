"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const timeEntryController_1 = require("../controllers/timeEntryController");
const validate_1 = require("../middleware/validate");
const router = (0, express_1.Router)();
router.get('/', timeEntryController_1.timeEntryController.getAll);
router.post('/clock-in', (0, express_validator_1.body)('student_assistant_id').isInt().withMessage('student_assistant_id must be an integer'), (0, express_validator_1.body)('clock_in').optional().isString(), validate_1.validate, timeEntryController_1.timeEntryController.clockIn);
router.get('/:id', (0, express_validator_1.param)('id').isInt().withMessage('id must be an integer'), validate_1.validate, timeEntryController_1.timeEntryController.getById);
router.post('/', (0, express_validator_1.body)('clock_in').optional().isString(), (0, express_validator_1.body)('clock_out').optional().isString(), (0, express_validator_1.body)('created_at').optional().isString(), (0, express_validator_1.body)('schedule_block_id').optional().isInt(), (0, express_validator_1.body)('student_assistant_id').optional().isInt(), validate_1.validate, timeEntryController_1.timeEntryController.create);
router.put('/:id', (0, express_validator_1.param)('id').isInt().withMessage('id must be an integer'), (0, express_validator_1.body)('clock_in').optional().isString(), (0, express_validator_1.body)('clock_out').optional().isString(), (0, express_validator_1.body)('created_at').optional().isString(), (0, express_validator_1.body)('schedule_block_id').optional().isInt(), (0, express_validator_1.body)('student_assistant_id').optional().isInt(), validate_1.validate, timeEntryController_1.timeEntryController.update);
router.delete('/:id', (0, express_validator_1.param)('id').isInt().withMessage('id must be an integer'), validate_1.validate, timeEntryController_1.timeEntryController.remove);
// Custom route to close an open time entry for a schedule block and student assistant
router.patch('/close-open', (0, express_validator_1.body)('schedule_block_id').isInt().withMessage('schedule_block_id must be an integer'), (0, express_validator_1.body)('student_assistant_id').isInt().withMessage('student_assistant_id must be an integer'), validate_1.validate, timeEntryController_1.timeEntryController.closeOpen);
router.patch('/close-open-by-assistant', (0, express_validator_1.body)('student_assistant_id').isInt().withMessage('student_assistant_id must be an integer'), validate_1.validate, timeEntryController_1.timeEntryController.closeOpenByAssistant);
exports.default = router;

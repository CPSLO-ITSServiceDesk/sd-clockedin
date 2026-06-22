"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const scheduleBlocksController_1 = require("../controllers/scheduleBlocksController");
const validate_1 = require("../middleware/validate");
const router = (0, express_1.Router)();
router.get('/', scheduleBlocksController_1.scheduleBlocksController.getAll);
router.get('/:id', (0, express_validator_1.param)('id').isInt().withMessage('id must be an integer'), validate_1.validate, scheduleBlocksController_1.scheduleBlocksController.getById);
router.post('/', (0, express_validator_1.body)('created_at').optional().isString(), (0, express_validator_1.body)('days')
    .optional()
    .isIn(['monday', 'tuesday', 'wednesday', 'thursday', 'friday'])
    .withMessage('days must be a valid day of week'), (0, express_validator_1.body)('end_time').optional().isString(), (0, express_validator_1.body)('schedule_id').optional().isInt(), (0, express_validator_1.body)('start_time').optional().isString(), 
// id is optional but typically not provided on create; still validate if present
(0, express_validator_1.body)('id').optional().isInt(), validate_1.validate, scheduleBlocksController_1.scheduleBlocksController.create);
router.put('/:id', (0, express_validator_1.param)('id').isInt().withMessage('id must be an integer'), (0, express_validator_1.body)('created_at').optional().isString(), (0, express_validator_1.body)('days')
    .optional()
    .isIn(['monday', 'tuesday', 'wednesday', 'thursday', 'friday'])
    .withMessage('days must be a valid day of week'), (0, express_validator_1.body)('end_time').optional().isString(), (0, express_validator_1.body)('schedule_id').optional().isInt(), (0, express_validator_1.body)('start_time').optional().isString(), (0, express_validator_1.body)('id').optional().isInt(), validate_1.validate, scheduleBlocksController_1.scheduleBlocksController.update);
router.delete('/:id', (0, express_validator_1.param)('id').isInt().withMessage('id must be an integer'), validate_1.validate, scheduleBlocksController_1.scheduleBlocksController.remove);
exports.default = router;

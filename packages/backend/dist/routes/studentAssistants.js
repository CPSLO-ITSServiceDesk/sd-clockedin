"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_validator_1 = require("express-validator");
const studentAssistantController_1 = require("../controllers/studentAssistantController");
const validate_1 = require("../middleware/validate");
const router = (0, express_1.Router)();
router.get('/', studentAssistantController_1.studentAssistantController.getAll);
router.get('/:id', (0, express_validator_1.param)('id').isInt().withMessage('id must be an integer'), validate_1.validate, studentAssistantController_1.studentAssistantController.getById);
router.post('/', (0, express_validator_1.body)('first_name').optional().isString(), (0, express_validator_1.body)('last_name').optional().isString(), (0, express_validator_1.body)('is_active').optional().isBoolean(), (0, express_validator_1.body)('polycard_id').optional().isInt(), (0, express_validator_1.body)('work_email').optional({ values: 'null' }).isEmail().withMessage('work_email must be a valid email'), (0, express_validator_1.body)('position')
    .isIn(['student lead, student assistant'])
    .withMessage('position must be a valid student role'), validate_1.validate, studentAssistantController_1.studentAssistantController.create);
router.put('/:id', (0, express_validator_1.param)('id').isInt().withMessage('id must be an integer'), (0, express_validator_1.body)('first_name').optional().isString(), (0, express_validator_1.body)('last_name').optional().isString(), (0, express_validator_1.body)('is_active').optional().isBoolean(), (0, express_validator_1.body)('polycard_id').optional().isInt(), (0, express_validator_1.body)('work_email').optional({ values: 'null' }).isEmail().withMessage('work_email must be a valid email'), (0, express_validator_1.body)('position').optional().isIn(['student lead, student assistant']).withMessage('position must be a valid student role'), validate_1.validate, studentAssistantController_1.studentAssistantController.update);
router.delete('/:id', (0, express_validator_1.param)('id').isInt().withMessage('id must be an integer'), validate_1.validate, studentAssistantController_1.studentAssistantController.remove);
exports.default = router;

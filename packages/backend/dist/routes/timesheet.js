"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const timesheetController_1 = require("../controllers/timesheetController");
const router = (0, express_1.Router)();
router.get('/hours-by-day', timesheetController_1.timesheetController.getHoursByDay);
exports.default = router;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const todayShiftsController_1 = require("../controllers/todayShiftsController");
const router = (0, express_1.Router)();
router.get('/today', todayShiftsController_1.todayShiftsController.getToday);
exports.default = router;

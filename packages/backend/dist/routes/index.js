"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerRoutes = registerRoutes;
const express_1 = require("express");
const terms_1 = __importDefault(require("./terms"));
const schedules_1 = __importDefault(require("./schedules"));
const timeEntries_1 = __importDefault(require("./timeEntries"));
const studentAssistants_1 = __importDefault(require("./studentAssistants"));
const scheduleBlocks_1 = __importDefault(require("./scheduleBlocks"));
const import_1 = __importDefault(require("./import"));
const todayShifts_1 = __importDefault(require("./todayShifts"));
const analytics_1 = __importDefault(require("./analytics"));
const router = (0, express_1.Router)();
router.get('/health', (_req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});
router.use('/terms', terms_1.default);
router.use('/schedules', schedules_1.default);
router.use('/time-entries', timeEntries_1.default);
router.use('/student-assistants', studentAssistants_1.default);
router.use('/schedule-blocks', scheduleBlocks_1.default);
router.use('/import', import_1.default);
router.use('/shifts', todayShifts_1.default);
router.use('/analytics', analytics_1.default);
/** Mounts all API routes under the /api prefix. */
function registerRoutes(app) {
    app.use('/api', router);
}

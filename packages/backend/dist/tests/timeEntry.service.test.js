"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const clearScheduleBlockReferences_1 = require("../lib/clearScheduleBlockReferences");
const timeEntryService_1 = require("../services/timeEntryService");
(0, vitest_1.describe)('clearScheduleBlockReferences', () => {
    (0, vitest_1.it)('is exported as a function', () => {
        (0, vitest_1.expect)(typeof clearScheduleBlockReferences_1.clearScheduleBlockReferences).toBe('function');
    });
});
(0, vitest_1.describe)('timeEntryService - basic existence', () => {
    (0, vitest_1.it)('should have all expected methods', () => {
        (0, vitest_1.expect)(timeEntryService_1.timeEntryService).toBeDefined();
        (0, vitest_1.expect)(typeof timeEntryService_1.timeEntryService.getAll).toBe('function');
        (0, vitest_1.expect)(typeof timeEntryService_1.timeEntryService.getById).toBe('function');
        (0, vitest_1.expect)(typeof timeEntryService_1.timeEntryService.create).toBe('function');
        (0, vitest_1.expect)(typeof timeEntryService_1.timeEntryService.update).toBe('function');
        (0, vitest_1.expect)(typeof timeEntryService_1.timeEntryService.remove).toBe('function');
        (0, vitest_1.expect)(typeof timeEntryService_1.timeEntryService.getOpenByScheduleAndAssistant).toBe('function');
        (0, vitest_1.expect)(typeof timeEntryService_1.timeEntryService.getOpenByAssistant).toBe('function');
        (0, vitest_1.expect)(typeof timeEntryService_1.timeEntryService.clockIn).toBe('function');
        (0, vitest_1.expect)(typeof timeEntryService_1.timeEntryService.closeOpenByAssistant).toBe('function');
    });
});

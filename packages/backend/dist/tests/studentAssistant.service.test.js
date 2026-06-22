"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const studentAssistantService_1 = require("../services/studentAssistantService");
(0, vitest_1.describe)('studentAssistantService - basic existence', () => {
    (0, vitest_1.it)('should have all expected methods', () => {
        (0, vitest_1.expect)(studentAssistantService_1.studentAssistantService).toBeDefined();
        (0, vitest_1.expect)(typeof studentAssistantService_1.studentAssistantService.getAll).toBe('function');
        (0, vitest_1.expect)(typeof studentAssistantService_1.studentAssistantService.getById).toBe('function');
        (0, vitest_1.expect)(typeof studentAssistantService_1.studentAssistantService.create).toBe('function');
        (0, vitest_1.expect)(typeof studentAssistantService_1.studentAssistantService.update).toBe('function');
        (0, vitest_1.expect)(typeof studentAssistantService_1.studentAssistantService.remove).toBe('function');
    });
});

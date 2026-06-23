"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const resolveNearestBlock_1 = require("../lib/resolveNearestBlock");
function block(id, startTime, endTime, clockInActual = null) {
    return { scheduleBlockId: id, startTime, endTime, clockInActual };
}
(0, vitest_1.describe)('resolveNearestBlock', () => {
    const morning = block(1, '09:00', '12:00');
    const afternoon = block(2, '13:00', '16:00');
    (0, vitest_1.it)('returns the only pending block', () => {
        const now = new Date(2026, 5, 23, 10, 0);
        (0, vitest_1.expect)((0, resolveNearestBlock_1.resolveNearestBlock)([morning], now)).toEqual(morning);
    });
    (0, vitest_1.it)('picks the in-window block when inside morning shift', () => {
        const now = new Date(2026, 5, 23, 10, 30);
        (0, vitest_1.expect)((0, resolveNearestBlock_1.resolveNearestBlock)([morning, afternoon], now)).toEqual(morning);
    });
    (0, vitest_1.it)('picks the in-window block when inside afternoon shift', () => {
        const now = new Date(2026, 5, 23, 15, 0);
        (0, vitest_1.expect)((0, resolveNearestBlock_1.resolveNearestBlock)([morning, afternoon], now)).toEqual(afternoon);
    });
    (0, vitest_1.it)('picks closest start when between shifts', () => {
        const now = new Date(2026, 5, 23, 12, 30);
        (0, vitest_1.expect)((0, resolveNearestBlock_1.resolveNearestBlock)([morning, afternoon], now)).toEqual(afternoon);
    });
    (0, vitest_1.it)('picks closest start when arriving early', () => {
        const now = new Date(2026, 5, 23, 8, 45);
        (0, vitest_1.expect)((0, resolveNearestBlock_1.resolveNearestBlock)([morning, afternoon], now)).toEqual(morning);
    });
    (0, vitest_1.it)('returns null when all blocks are already clocked in', () => {
        const now = new Date(2026, 5, 23, 10, 0);
        const clockedIn = block(1, '09:00', '12:00', '2026-06-23T09:00:00');
        (0, vitest_1.expect)((0, resolveNearestBlock_1.resolveNearestBlock)([clockedIn], now)).toBeNull();
    });
    (0, vitest_1.it)('returns null for empty input', () => {
        (0, vitest_1.expect)((0, resolveNearestBlock_1.resolveNearestBlock)([])).toBeNull();
    });
});

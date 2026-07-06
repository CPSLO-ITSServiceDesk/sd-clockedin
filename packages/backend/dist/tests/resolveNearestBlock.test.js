"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const resolveNearestBlock_1 = require("../lib/resolveNearestBlock");
function block(id, startTime, endTime, clockInActual = null) {
    return { scheduleBlockId: id, startTime, endTime, clockInActual };
}
/** Pacific wall-clock instants in June (PDT, UTC-7). */
const PT = {
    jun23_845am: new Date('2026-06-23T15:45:00.000Z'),
    jun23_10am: new Date('2026-06-23T17:00:00.000Z'),
    jun23_1030am: new Date('2026-06-23T17:30:00.000Z'),
    jun23_1230pm: new Date('2026-06-23T19:30:00.000Z'),
    jun23_3pm: new Date('2026-06-23T22:00:00.000Z'),
    jun25_820am: new Date('2026-06-25T15:20:00.000Z'),
    jun25_11am: new Date('2026-06-25T18:00:00.000Z'),
};
(0, vitest_1.describe)('resolveNearestBlock', () => {
    const morning = block(1, '09:00', '12:00');
    const afternoon = block(2, '13:00', '16:00');
    const thursdayMorning = block(350, '08:00:00+00', '11:00:00+00');
    const thursdayAfternoon = block(357, '12:00:00+00', '17:00:00+00');
    (0, vitest_1.it)('returns the only pending block', () => {
        (0, vitest_1.expect)((0, resolveNearestBlock_1.resolveNearestBlock)([morning], PT.jun23_10am)).toEqual(morning);
    });
    (0, vitest_1.it)('picks the in-window block when inside morning shift', () => {
        (0, vitest_1.expect)((0, resolveNearestBlock_1.resolveNearestBlock)([morning, afternoon], PT.jun23_1030am)).toEqual(morning);
    });
    (0, vitest_1.it)('picks the in-window block when inside afternoon shift', () => {
        (0, vitest_1.expect)((0, resolveNearestBlock_1.resolveNearestBlock)([morning, afternoon], PT.jun23_3pm)).toEqual(afternoon);
    });
    (0, vitest_1.it)('picks closest start when between shifts', () => {
        (0, vitest_1.expect)((0, resolveNearestBlock_1.resolveNearestBlock)([morning, afternoon], PT.jun23_1230pm)).toEqual(afternoon);
    });
    (0, vitest_1.it)('picks closest start when arriving early', () => {
        (0, vitest_1.expect)((0, resolveNearestBlock_1.resolveNearestBlock)([morning, afternoon], PT.jun23_845am)).toEqual(morning);
    });
    (0, vitest_1.it)('returns null when all blocks are already clocked in', () => {
        const clockedIn = block(1, '09:00', '12:00', '2026-06-23T16:00:00.000Z');
        (0, vitest_1.expect)((0, resolveNearestBlock_1.resolveNearestBlock)([clockedIn], PT.jun23_10am)).toBeNull();
    });
    (0, vitest_1.it)('returns null for empty input', () => {
        (0, vitest_1.expect)((0, resolveNearestBlock_1.resolveNearestBlock)([])).toBeNull();
    });
    (0, vitest_1.it)('returns null when clocking in too early for the only block', () => {
        const afternoonOnly = block(1, '12:00', '17:00');
        (0, vitest_1.expect)((0, resolveNearestBlock_1.resolveNearestBlock)([afternoonOnly], PT.jun25_820am)).toBeNull();
    });
    (0, vitest_1.it)('matches an afternoon block when within the early-arrival window', () => {
        const afternoonOnly = block(1, '12:00', '17:00');
        (0, vitest_1.expect)((0, resolveNearestBlock_1.resolveNearestBlock)([afternoonOnly], PT.jun25_11am)).toEqual(afternoonOnly);
    });
    (0, vitest_1.it)('picks morning 8-11 at 8:20 Pacific when student also has a 12-5 shift', () => {
        (0, vitest_1.expect)((0, resolveNearestBlock_1.resolveNearestBlock)([thursdayMorning, thursdayAfternoon], PT.jun25_820am)).toEqual(thursdayMorning);
    });
});

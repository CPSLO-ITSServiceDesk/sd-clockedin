"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EARLY_CLOCK_IN_WINDOW_MINUTES = void 0;
exports.resolveNearestBlock = resolveNearestBlock;
const orgTime_1 = require("./orgTime");
const time_1 = require("./time");
/** Max minutes before shift start that still auto-match a schedule block on clock-in. */
exports.EARLY_CLOCK_IN_WINDOW_MINUTES = 60;
function resolveNearestBlock(blocks, now = new Date()) {
    const nowMin = (0, orgTime_1.getOrgLocalMinutes)(now);
    const pending = blocks.filter((block) => !block.clockInActual);
    if (pending.length === 0)
        return null;
    const eligible = pending.filter((block) => {
        const start = (0, time_1.timeToMinutes)(block.startTime);
        const end = (0, time_1.timeToMinutes)(block.endTime);
        if (Number.isNaN(start) || Number.isNaN(end))
            return false;
        return (nowMin >= start - exports.EARLY_CLOCK_IN_WINDOW_MINUTES &&
            nowMin < end);
    });
    if (eligible.length === 0)
        return null;
    const inWindow = eligible.filter((block) => {
        const start = (0, time_1.timeToMinutes)(block.startTime);
        return nowMin >= start;
    });
    const pool = inWindow.length > 0 ? inWindow : eligible;
    const useStartTieBreak = inWindow.length > 0;
    return pool.reduce((best, block) => {
        const start = (0, time_1.timeToMinutes)(block.startTime);
        if (Number.isNaN(start))
            return best;
        const dist = useStartTieBreak ? start : Math.abs(nowMin - start);
        if (best === null)
            return block;
        const bestStart = (0, time_1.timeToMinutes)(best.startTime);
        const bestDist = useStartTieBreak ? bestStart : Math.abs(nowMin - bestStart);
        return dist < bestDist ? block : best;
    }, null);
}

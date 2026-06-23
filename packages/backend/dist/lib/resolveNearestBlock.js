"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveNearestBlock = resolveNearestBlock;
const time_1 = require("./time");
function resolveNearestBlock(blocks, now = new Date()) {
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const pending = blocks.filter((block) => !block.clockInActual);
    if (pending.length === 0)
        return null;
    const inWindow = pending.filter((block) => {
        const start = (0, time_1.timeToMinutes)(block.startTime);
        const end = (0, time_1.timeToMinutes)(block.endTime);
        if (Number.isNaN(start) || Number.isNaN(end))
            return false;
        return nowMin >= start && nowMin <= end;
    });
    const pool = inWindow.length > 0 ? inWindow : pending;
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

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearScheduleBlockReferences = clearScheduleBlockReferences;
const supabase_1 = require("./supabase");
const errorHandler_1 = require("../middleware/errorHandler");
/** Preserve time entries when schedule blocks are replaced or deleted. */
async function clearScheduleBlockReferences(blockIds) {
    if (blockIds.length === 0)
        return;
    const { error } = await supabase_1.supabase
        .from('time_entry')
        .update({ schedule_block_id: null })
        .in('schedule_block_id', blockIds);
    if (error)
        throw new errorHandler_1.HttpError(500, error.message);
}

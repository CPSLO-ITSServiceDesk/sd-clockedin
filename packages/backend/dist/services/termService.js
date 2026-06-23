"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.termService = void 0;
const supabase_1 = require("../lib/supabase");
const errorHandler_1 = require("../middleware/errorHandler");
const scheduleBlocksService_1 = require("./scheduleBlocksService");
// PostgREST returns this code when .single() finds no matching row.
const NO_ROWS = 'PGRST116';
exports.termService = {
    // get all terms
    async getAll() {
        const { data, error } = await supabase_1.supabase
            .from('academic_term')
            .select('*')
            .order('start_date', { ascending: false });
        if (error)
            throw new errorHandler_1.HttpError(500, error.message);
        return data ?? [];
    },
    // get a single term by id
    async getById(id) {
        const { data, error } = await supabase_1.supabase
            .from('academic_term')
            .select('*')
            .eq('id', id)
            .single();
        if (error) {
            if (error.code === NO_ROWS)
                return null;
            throw new errorHandler_1.HttpError(500, error.message);
        }
        return data;
    },
    // create a new term
    async create(payload) {
        const { data, error } = await supabase_1.supabase
            .from('academic_term')
            .insert(payload)
            .select()
            .single();
        if (error)
            throw new errorHandler_1.HttpError(500, error.message);
        return data;
    },
    // update a term by id
    async update(id, payload) {
        const { data, error } = await supabase_1.supabase
            .from('academic_term')
            .update(payload)
            .eq('id', id)
            .select()
            .single();
        if (error) {
            if (error.code === NO_ROWS)
                return null;
            throw new errorHandler_1.HttpError(500, error.message);
        }
        return data;
    },
    // delete a term by id and its schedules + schedule blocks
    async remove(id) {
        const { data: schedules, error: schedulesError } = await supabase_1.supabase
            .from('schedules')
            .select('id')
            .eq('academic_term_id', id);
        if (schedulesError)
            throw new errorHandler_1.HttpError(500, schedulesError.message);
        const scheduleIds = (schedules ?? []).map((schedule) => schedule.id);
        if (scheduleIds.length > 0) {
            const { data: blocks, error: blocksError } = await supabase_1.supabase
                .from('schedule_blocks')
                .select('id')
                .in('schedule_id', scheduleIds);
            if (blocksError)
                throw new errorHandler_1.HttpError(500, blocksError.message);
            const blockIds = (blocks ?? []).map((block) => block.id);
            await scheduleBlocksService_1.scheduleBlocksService.removeMany(blockIds);
            const { error: deleteSchedulesError } = await supabase_1.supabase
                .from('schedules')
                .delete()
                .in('id', scheduleIds);
            if (deleteSchedulesError) {
                throw new errorHandler_1.HttpError(500, deleteSchedulesError.message);
            }
        }
        const { error } = await supabase_1.supabase
            .from('academic_term')
            .delete()
            .eq('id', id);
        if (error)
            throw new errorHandler_1.HttpError(500, error.message);
    },
};

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.timeEntryService = void 0;
const supabase_1 = require("../lib/supabase");
const errorHandler_1 = require("../middleware/errorHandler");
// PostgREST returns this code when .single() finds no matching row.
const NO_ROWS = 'PGRST116';
exports.timeEntryService = {
    async getAll() {
        const { data, error } = await supabase_1.supabase
            .from('time_entry')
            .select('*')
            .order('created_at', { ascending: false });
        if (error)
            throw new errorHandler_1.HttpError(500, error.message);
        return data ?? [];
    },
    async getById(id) {
        const { data, error } = await supabase_1.supabase
            .from('time_entry')
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
    async getOpenByScheduleAndAssistant(schedule_block_id, student_assistant_id) {
        const { data, error } = await supabase_1.supabase
            .from('time_entry')
            .select('*')
            .eq('schedule_block_id', schedule_block_id)
            .eq('student_assistant_id', student_assistant_id)
            .is('clock_out', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
        if (error) {
            if (error.code === NO_ROWS)
                return null;
            throw new errorHandler_1.HttpError(500, error.message);
        }
        return data;
    },
    async create(payload) {
        const { data, error } = await supabase_1.supabase
            .from('time_entry')
            .insert(payload)
            .select()
            .single();
        if (error)
            throw new errorHandler_1.HttpError(500, error.message);
        return data;
    },
    async update(id, payload) {
        const { data, error } = await supabase_1.supabase
            .from('time_entry')
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
    async remove(id) {
        const { error } = await supabase_1.supabase
            .from('time_entry')
            .delete()
            .eq('id', id);
        if (error)
            throw new errorHandler_1.HttpError(500, error.message);
    },
};

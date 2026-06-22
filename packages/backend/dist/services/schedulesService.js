"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.schedulesService = void 0;
const supabase_1 = require("../lib/supabase");
const errorHandler_1 = require("../middleware/errorHandler");
// PostgREST returns this code when .single() finds no matching row.
const NO_ROWS = 'PGRST116';
exports.schedulesService = {
    async getAll() {
        const { data, error } = await supabase_1.supabase
            .from('schedules')
            .select('*')
            .order('created_at', { ascending: false });
        if (error)
            throw new errorHandler_1.HttpError(500, error.message);
        return data ?? [];
    },
    async getById(id) {
        const { data, error } = await supabase_1.supabase
            .from('schedules')
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
    async getByStudentAndTerm(studentAssistantId, academicTermId) {
        const { data, error } = await supabase_1.supabase
            .from('schedules')
            .select('*')
            .eq('student_assistant_id', studentAssistantId)
            .eq('academic_term_id', academicTermId)
            .maybeSingle();
        if (error)
            throw new errorHandler_1.HttpError(500, error.message);
        return data;
    },
    async create(payload) {
        const { data, error } = await supabase_1.supabase
            .from('schedules')
            .insert(payload)
            .select()
            .single();
        if (error)
            throw new errorHandler_1.HttpError(500, error.message);
        return data;
    },
    async update(id, payload) {
        const { data, error } = await supabase_1.supabase
            .from('schedules')
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
            .from('schedules')
            .delete()
            .eq('id', id);
        if (error)
            throw new errorHandler_1.HttpError(500, error.message);
    },
};

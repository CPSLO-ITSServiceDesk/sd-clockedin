"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.studentAssistantService = void 0;
const supabase_1 = require("../lib/supabase");
const errorHandler_1 = require("../middleware/errorHandler");
// PostgREST returns this code when .single() finds no matching row.
const NO_ROWS = 'PGRST116';
exports.studentAssistantService = {
    // get all student assistants
    async getAll() {
        const { data, error } = await supabase_1.supabase
            .from('student_assistant')
            .select('*')
            .order('created_at', { ascending: false });
        if (error)
            throw new errorHandler_1.HttpError(500, error.message);
        return data ?? [];
    },
    // get a single student assistant by id
    async getById(id) {
        const { data, error } = await supabase_1.supabase
            .from('student_assistant')
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
    async findByWorkEmail(workEmail) {
        const normalized = workEmail.trim().toLowerCase();
        const { data, error } = await supabase_1.supabase
            .from('student_assistant')
            .select('*')
            .ilike('work_email', normalized)
            .maybeSingle();
        if (error)
            throw new errorHandler_1.HttpError(500, error.message);
        return data;
    },
    // create a new student assistant
    async create(payload) {
        const { data, error } = await supabase_1.supabase
            .from('student_assistant')
            .insert(payload)
            .select()
            .single();
        if (error)
            throw new errorHandler_1.HttpError(500, error.message);
        return data;
    },
    // update a student assistant by id
    async update(id, payload) {
        const { data, error } = await supabase_1.supabase
            .from('student_assistant')
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
    // delete a student assistant by id, including related schedules and time entries
    async remove(id) {
        const existing = await this.getById(id);
        if (!existing) {
            throw new errorHandler_1.HttpError(404, 'Student assistant not found');
        }
        const { data: schedules, error: schedulesError } = await supabase_1.supabase
            .from('schedules')
            .select('id')
            .eq('student_assistant_id', id);
        if (schedulesError)
            throw new errorHandler_1.HttpError(500, schedulesError.message);
        const scheduleIds = (schedules ?? []).map((schedule) => schedule.id);
        let blockIds = [];
        if (scheduleIds.length > 0) {
            const { data: blocks, error: blocksError } = await supabase_1.supabase
                .from('schedule_blocks')
                .select('id')
                .in('schedule_id', scheduleIds);
            if (blocksError)
                throw new errorHandler_1.HttpError(500, blocksError.message);
            blockIds = (blocks ?? []).map((block) => block.id);
        }
        const { error: timeByStudentError } = await supabase_1.supabase
            .from('time_entry')
            .delete()
            .eq('student_assistant_id', id);
        if (timeByStudentError)
            throw new errorHandler_1.HttpError(500, timeByStudentError.message);
        if (blockIds.length > 0) {
            const { error: timeByBlockError } = await supabase_1.supabase
                .from('time_entry')
                .delete()
                .in('schedule_block_id', blockIds);
            if (timeByBlockError)
                throw new errorHandler_1.HttpError(500, timeByBlockError.message);
            const { error: blocksDeleteError } = await supabase_1.supabase
                .from('schedule_blocks')
                .delete()
                .in('id', blockIds);
            if (blocksDeleteError)
                throw new errorHandler_1.HttpError(500, blocksDeleteError.message);
        }
        if (scheduleIds.length > 0) {
            const { error: schedulesDeleteError } = await supabase_1.supabase
                .from('schedules')
                .delete()
                .in('id', scheduleIds);
            if (schedulesDeleteError) {
                throw new errorHandler_1.HttpError(500, schedulesDeleteError.message);
            }
        }
        const { error } = await supabase_1.supabase
            .from('student_assistant')
            .delete()
            .eq('id', id);
        if (error)
            throw new errorHandler_1.HttpError(500, error.message);
    },
};

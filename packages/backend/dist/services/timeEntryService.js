"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.timeEntryService = void 0;
const resolveNearestBlock_1 = require("../lib/resolveNearestBlock");
const shiftStatus_1 = require("../lib/shiftStatus");
const supabase_1 = require("../lib/supabase");
const errorHandler_1 = require("../middleware/errorHandler");
const scheduleBlocksService_1 = require("./scheduleBlocksService");
const schedulesService_1 = require("./schedulesService");
const studentAssistantService_1 = require("./studentAssistantService");
const todayShiftsService_1 = require("./todayShiftsService");
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
    async getOpenByAssistant(student_assistant_id) {
        const { data, error } = await supabase_1.supabase
            .from('time_entry')
            .select('*')
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
    async clockIn(params, now = new Date()) {
        const { student_assistant_id, clock_in } = params;
        const studentAssistant = await studentAssistantService_1.studentAssistantService.getById(student_assistant_id);
        if (!studentAssistant || studentAssistant.is_active === false) {
            throw new errorHandler_1.HttpError(404, 'Student assistant not found or inactive');
        }
        const openEntry = await this.getOpenByAssistant(student_assistant_id);
        if (openEntry) {
            throw new errorHandler_1.HttpError(409, 'Student is already clocked in');
        }
        const todayDay = (0, todayShiftsService_1.getTodayDay)(now);
        const todayDate = (0, todayShiftsService_1.getTodayDateString)(now);
        const [schedules, scheduleBlocks, timeEntries] = await Promise.all([
            schedulesService_1.schedulesService.getAll(),
            scheduleBlocksService_1.scheduleBlocksService.getAll(),
            this.getAll(),
        ]);
        const studentScheduleIds = new Set(schedules
            .filter((schedule) => schedule.student_assistant_id === student_assistant_id)
            .map((schedule) => schedule.id));
        const todaysBlocks = todayDay
            ? scheduleBlocks.filter((block) => block.days === todayDay &&
                block.schedule_id != null &&
                studentScheduleIds.has(block.schedule_id))
            : [];
        const todaysTimeEntries = timeEntries.filter((entry) => entry.created_at?.startsWith(todayDate) &&
            entry.student_assistant_id === student_assistant_id);
        const timeEntryMap = new Map();
        for (const entry of todaysTimeEntries) {
            const key = `${entry.schedule_block_id}-${entry.student_assistant_id}`;
            timeEntryMap.set(key, entry);
        }
        const candidates = todaysBlocks.map((block) => {
            const timeEntryKey = `${block.id}-${student_assistant_id}`;
            const timeEntry = timeEntryMap.get(timeEntryKey) ?? null;
            return {
                scheduleBlockId: block.id,
                startTime: block.start_time ?? '00:00',
                endTime: block.end_time ?? '00:00',
                clockInActual: timeEntry?.clock_in ?? null,
            };
        });
        const matched = (0, resolveNearestBlock_1.resolveNearestBlock)(candidates, now);
        const clockInTime = clock_in ?? new Date().toISOString();
        const timeEntry = await this.create({
            schedule_block_id: matched?.scheduleBlockId ?? null,
            student_assistant_id,
            clock_in: clockInTime,
        });
        return {
            timeEntry,
            matchedBlock: matched
                ? {
                    id: matched.scheduleBlockId,
                    startTime: matched.startTime,
                    endTime: matched.endTime,
                }
                : null,
        };
    },
    async closeOpenByAssistant(student_assistant_id) {
        const openEntry = await this.getOpenByAssistant(student_assistant_id);
        if (!openEntry) {
            throw new errorHandler_1.HttpError(404, 'No open time entry found for this student');
        }
        const updated = await this.update(openEntry.id, {
            clock_out: new Date().toISOString(),
        });
        if (!updated) {
            throw new errorHandler_1.HttpError(500, 'Failed to update time entry');
        }
        return updated;
    },
    async getHoursByDay(studentAssistantId, startDate, endDate) {
        // Widen the query so entries near month boundaries are not missed due to UTC storage.
        const queryStart = (0, shiftStatus_1.addLocalDays)(startDate, -1);
        const queryEnd = (0, shiftStatus_1.addLocalDays)(endDate, 1);
        const { data, error } = await supabase_1.supabase
            .from('time_entry')
            .select('clock_in, clock_out')
            .eq('student_assistant_id', studentAssistantId)
            .gte('clock_in', queryStart)
            .lt('clock_in', queryEnd)
            .order('clock_in');
        if (error)
            throw new errorHandler_1.HttpError(500, error.message);
        const hoursByDay = {};
        (data || []).forEach(entry => {
            if (!entry.clock_in || !entry.clock_out)
                return;
            const dateStr = (0, shiftStatus_1.getClockInDate)(entry.clock_in);
            if (!dateStr || !(0, shiftStatus_1.isLocalDateInRange)(dateStr, startDate, endDate))
                return;
            const start = new Date(entry.clock_in);
            const end = new Date(entry.clock_out);
            if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()))
                return;
            const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
            hoursByDay[dateStr] = (hoursByDay[dateStr] || 0) + hours;
        });
        return hoursByDay;
    },
};

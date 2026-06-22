"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduleBlocksController = void 0;
const scheduleBlocksService_1 = require("../services/scheduleBlocksService");
exports.scheduleBlocksController = {
    async getAll(_req, res, next) {
        try {
            const blocks = await scheduleBlocksService_1.scheduleBlocksService.getAll();
            res.json({ success: true, data: blocks });
        }
        catch (err) {
            next(err);
        }
    },
    async getById(req, res, next) {
        try {
            const id = Number(req.params.id);
            const block = await scheduleBlocksService_1.scheduleBlocksService.getById(id);
            if (!block) {
                res.status(404).json({ success: false, error: 'Schedule block not found' });
                return;
            }
            res.json({ success: true, data: block });
        }
        catch (err) {
            next(err);
        }
    },
    async create(req, res, next) {
        try {
            const block = await scheduleBlocksService_1.scheduleBlocksService.create(req.body);
            res.status(201).json({ success: true, data: block });
        }
        catch (err) {
            next(err);
        }
    },
    async update(req, res, next) {
        try {
            const id = Number(req.params.id);
            const block = await scheduleBlocksService_1.scheduleBlocksService.update(id, req.body);
            if (!block) {
                res.status(404).json({ success: false, error: 'Schedule block not found' });
                return;
            }
            res.json({ success: true, data: block });
        }
        catch (err) {
            next(err);
        }
    },
    async remove(req, res, next) {
        try {
            const id = Number(req.params.id);
            await scheduleBlocksService_1.scheduleBlocksService.remove(id);
            res.status(204).send();
        }
        catch (err) {
            next(err);
        }
    },
    async getByScheduleId(req, res, next) {
        try {
            const scheduleId = Number(req.params.id);
            const blocks = await scheduleBlocksService_1.scheduleBlocksService.getByScheduleId(scheduleId);
            res.json({ success: true, data: blocks });
        }
        catch (err) {
            next(err);
        }
    },
};

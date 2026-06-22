"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.schedulesController = void 0;
const schedulesService_1 = require("../services/schedulesService");
exports.schedulesController = {
    async getAll(_req, res, next) {
        try {
            const schedules = await schedulesService_1.schedulesService.getAll();
            res.json({ success: true, data: schedules });
        }
        catch (err) {
            next(err);
        }
    },
    async getById(req, res, next) {
        try {
            const id = Number(req.params.id);
            const schedule = await schedulesService_1.schedulesService.getById(id);
            if (!schedule) {
                res.status(404).json({ success: false, error: 'Schedule not found' });
                return;
            }
            res.json({ success: true, data: schedule });
        }
        catch (err) {
            next(err);
        }
    },
    async create(req, res, next) {
        try {
            const schedule = await schedulesService_1.schedulesService.create(req.body);
            res.status(201).json({ success: true, data: schedule });
        }
        catch (err) {
            next(err);
        }
    },
    async update(req, res, next) {
        try {
            const id = Number(req.params.id);
            const schedule = await schedulesService_1.schedulesService.update(id, req.body);
            if (!schedule) {
                res.status(404).json({ success: false, error: 'Schedule not found' });
                return;
            }
            res.json({ success: true, data: schedule });
        }
        catch (err) {
            next(err);
        }
    },
    async remove(req, res, next) {
        try {
            const id = Number(req.params.id);
            await schedulesService_1.schedulesService.remove(id);
            res.status(204).send();
        }
        catch (err) {
            next(err);
        }
    },
};

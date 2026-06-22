"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.termController = void 0;
const termService_1 = require("../services/termService");
exports.termController = {
    async getAll(_req, res, next) {
        try {
            const terms = await termService_1.termService.getAll();
            res.json({ success: true, data: terms });
        }
        catch (err) {
            next(err);
        }
    },
    async getById(req, res, next) {
        try {
            const id = Number(req.params.id);
            const term = await termService_1.termService.getById(id);
            if (!term) {
                res.status(404).json({ success: false, error: 'Term not found' });
                return;
            }
            res.json({ success: true, data: term });
        }
        catch (err) {
            next(err);
        }
    },
    async create(req, res, next) {
        try {
            const term = await termService_1.termService.create(req.body);
            res.status(201).json({ success: true, data: term });
        }
        catch (err) {
            next(err);
        }
    },
    async update(req, res, next) {
        try {
            const id = Number(req.params.id);
            const term = await termService_1.termService.update(id, req.body);
            if (!term) {
                res.status(404).json({ success: false, error: 'Term not found' });
                return;
            }
            res.json({ success: true, data: term });
        }
        catch (err) {
            next(err);
        }
    },
    async remove(req, res, next) {
        try {
            const id = Number(req.params.id);
            await termService_1.termService.remove(id);
            res.status(204).send();
        }
        catch (err) {
            next(err);
        }
    },
};

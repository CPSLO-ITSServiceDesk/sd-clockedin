"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.studentAssistantController = void 0;
const studentAssistantService_1 = require("../services/studentAssistantService");
exports.studentAssistantController = {
    async getAll(_req, res, next) {
        try {
            const assistants = await studentAssistantService_1.studentAssistantService.getAll();
            res.json({ success: true, data: assistants });
        }
        catch (err) {
            next(err);
        }
    },
    async getById(req, res, next) {
        try {
            const id = Number(req.params.id);
            const assistant = await studentAssistantService_1.studentAssistantService.getById(id);
            if (!assistant) {
                res.status(404).json({ success: false, error: 'Student assistant not found' });
                return;
            }
            res.json({ success: true, data: assistant });
        }
        catch (err) {
            next(err);
        }
    },
    async create(req, res, next) {
        try {
            const assistant = await studentAssistantService_1.studentAssistantService.create(req.body);
            res.status(201).json({ success: true, data: assistant });
        }
        catch (err) {
            next(err);
        }
    },
    async update(req, res, next) {
        try {
            const id = Number(req.params.id);
            const assistant = await studentAssistantService_1.studentAssistantService.update(id, req.body);
            if (!assistant) {
                res.status(404).json({ success: false, error: 'Student assistant not found' });
                return;
            }
            res.json({ success: true, data: assistant });
        }
        catch (err) {
            next(err);
        }
    },
    async remove(req, res, next) {
        try {
            const id = Number(req.params.id);
            await studentAssistantService_1.studentAssistantService.remove(id);
            res.status(204).send();
        }
        catch (err) {
            next(err);
        }
    },
};

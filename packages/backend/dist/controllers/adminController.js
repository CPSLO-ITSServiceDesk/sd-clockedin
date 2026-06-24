"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminController = void 0;
const adminService_1 = require("../services/adminService");
exports.adminController = {
    async getAll(_req, res, next) {
        try {
            const admins = await adminService_1.adminService.getAll();
            res.json({ success: true, data: admins });
        }
        catch (err) {
            next(err);
        }
    },
    async getById(req, res, next) {
        try {
            const id = Number(req.params.id);
            const admin = await adminService_1.adminService.getById(id);
            if (!admin) {
                res.status(404).json({ success: false, error: 'Admin not found' });
                return;
            }
            res.json({ success: true, data: admin });
        }
        catch (err) {
            next(err);
        }
    },
    async create(req, res, next) {
        try {
            const admin = await adminService_1.adminService.create(req.body);
            res.status(201).json({ success: true, data: admin });
        }
        catch (err) {
            next(err);
        }
    },
    async update(req, res, next) {
        try {
            const id = Number(req.params.id);
            const admin = await adminService_1.adminService.update(id, req.body);
            if (!admin) {
                res.status(404).json({ success: false, error: 'Admin not found' });
                return;
            }
            res.json({ success: true, data: admin });
        }
        catch (err) {
            next(err);
        }
    },
    async remove(req, res, next) {
        try {
            const id = Number(req.params.id);
            await adminService_1.adminService.remove(id);
            res.status(204).send();
        }
        catch (err) {
            next(err);
        }
    },
    async authorize(req, res, next) {
        try {
            const email = req.body.email;
            const name = req.body.name;
            console.info('[sd-clockin/auth] Authorize request', { email, name });
            const result = await adminService_1.adminService.authorize(email ?? '', name);
            if (!result.allowed) {
                console.warn('[sd-clockin/auth] Authorize denied', {
                    email,
                    message: result.message,
                });
                res.status(403).json({
                    allowed: false,
                    message: result.message ?? 'User is not an active admin',
                });
                return;
            }
            console.info('[sd-clockin/auth] Authorize granted', {
                email,
                adminId: result.admin?.id,
            });
            res.json({
                allowed: true,
                admin: result.admin,
            });
        }
        catch (err) {
            console.error('[sd-clockin/auth] Authorize error', err);
            next(err);
        }
    },
};

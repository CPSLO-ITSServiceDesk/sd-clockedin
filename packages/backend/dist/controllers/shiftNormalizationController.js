"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shiftNormalizationController = void 0;
const shiftNormalizationService_1 = require("../services/shiftNormalizationService");
exports.shiftNormalizationController = {
    async getPreview(req, res, next) {
        try {
            const termId = Number(req.params.termId);
            const data = await shiftNormalizationService_1.shiftNormalizationService.getPreview(termId);
            res.json({ success: true, data });
        }
        catch (err) {
            next(err);
        }
    },
    async applyMatches(req, res, next) {
        try {
            const termId = Number(req.params.termId);
            const { matches } = req.body;
            if (!Array.isArray(matches)) {
                res.status(400).json({
                    success: false,
                    error: 'matches must be an array',
                });
                return;
            }
            const data = await shiftNormalizationService_1.shiftNormalizationService.applyMatches(termId, matches);
            res.json({ success: true, data });
        }
        catch (err) {
            next(err);
        }
    },
};

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCorsMiddleware = createCorsMiddleware;
const cors_1 = __importDefault(require("cors"));
const environment_1 = require("../config/environment");
const LOCAL_DEV_ORIGIN_PATTERN = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
function isOriginAllowed(origin) {
    if (environment_1.config.allowedOrigins.includes(origin)) {
        return true;
    }
    if (environment_1.config.nodeEnv === 'development' && LOCAL_DEV_ORIGIN_PATTERN.test(origin)) {
        return true;
    }
    return false;
}
function createCorsMiddleware() {
    const options = {
        origin(origin, callback) {
            if (!origin || isOriginAllowed(origin)) {
                callback(null, true);
                return;
            }
            callback(null, false);
        },
        credentials: true,
    };
    return (0, cors_1.default)(options);
}

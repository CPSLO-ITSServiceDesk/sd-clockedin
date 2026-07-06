"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.loadEnvironment = loadEnvironment;
require("dotenv/config");
/**
 * Validates that all required environment variables are present.
 * Call this once at startup, before the server begins listening.
 */
function loadEnvironment() {
    const requiredVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
    const missing = requiredVars.filter((name) => !process.env[name]);
    if (missing.length > 0) {
        throw new Error(`Missing required environment variable(s): ${missing.join(', ')}`);
    }
}
function parseAllowedOrigins() {
    const raw = process.env.FRONTEND_URL ?? 'http://localhost:3000';
    return raw
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);
}
function parseAutoClockOutTime() {
    const raw = process.env.AUTO_CLOCK_OUT_TIME ?? '17:00';
    const match = /^(\d{1,2}):(\d{2})$/.exec(raw.trim());
    if (!match) {
        throw new Error(`Invalid AUTO_CLOCK_OUT_TIME: ${raw} (expected HH:mm)`);
    }
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour > 23 || minute > 59) {
        throw new Error(`Invalid AUTO_CLOCK_OUT_TIME: ${raw}`);
    }
    return { hour, minute };
}
function parseAutoClockOutEnabled() {
    const raw = process.env.AUTO_CLOCK_OUT_ENABLED;
    if (raw === undefined)
        return true;
    return raw !== 'false' && raw !== '0';
}
exports.config = {
    port: Number(process.env.PORT) || 3001,
    allowedOrigins: parseAllowedOrigins(),
    nodeEnv: process.env.NODE_ENV || 'development',
    autoClockOut: {
        enabled: parseAutoClockOutEnabled(),
        ...parseAutoClockOutTime(),
    },
};

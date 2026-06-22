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
    const requiredVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
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
exports.config = {
    port: Number(process.env.PORT) || 3001,
    allowedOrigins: parseAllowedOrigins(),
    nodeEnv: process.env.NODE_ENV || 'development',
};

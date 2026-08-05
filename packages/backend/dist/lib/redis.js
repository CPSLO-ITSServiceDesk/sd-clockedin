"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isRedisEnabled = exports.redis = void 0;
require("dotenv/config");
const redis_1 = require("@upstash/redis");
const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;
/**
 * `null` when Upstash credentials are not configured. Callers must treat
 * caching as optional and fall back to computing values directly, so local
 * dev and tests work without Redis.
 */
exports.redis = url && token ? new redis_1.Redis({ url, token }) : null;
exports.isRedisEnabled = exports.redis !== null;
if (exports.isRedisEnabled) {
    console.log('Upstash Redis caching enabled');
}
else {
    console.warn('Redis not configured (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN missing) — caching disabled.');
}

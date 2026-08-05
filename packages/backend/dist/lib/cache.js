"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withCache = withCache;
exports.invalidateCache = invalidateCache;
const redis_1 = require("./redis");
/**
 * Returns the cached value for `key` when present; otherwise computes it via
 * `fn`, stores it with the given TTL, and returns the fresh value.
 *
 * A no-op passthrough (always calls `fn`) when Redis isn't configured, so
 * caching is strictly a performance layer and never a hard dependency.
 */
async function withCache(key, ttlSeconds, fn) {
    if (!redis_1.isRedisEnabled)
        return fn();
    try {
        const cached = await redis_1.redis.get(key);
        if (cached !== null && cached !== undefined)
            return cached;
    }
    catch (err) {
        console.error(`Redis GET failed for key "${key}":`, err);
    }
    const fresh = await fn();
    try {
        await redis_1.redis.set(key, fresh, { ex: ttlSeconds });
    }
    catch (err) {
        console.error(`Redis SET failed for key "${key}":`, err);
    }
    return fresh;
}
/** Best-effort cache invalidation; failures are logged, never thrown. */
async function invalidateCache(...keys) {
    if (!redis_1.isRedisEnabled || keys.length === 0)
        return;
    try {
        await redis_1.redis.del(...keys);
    }
    catch (err) {
        console.error(`Redis DEL failed for key(s) "${keys.join(', ')}":`, err);
    }
}

import 'dotenv/config';
import { Redis } from '@upstash/redis';

/**
 * Supports both Upstash-native and Vercel KV env names (with CLOCKEDIN_ prefix):
 *   CLOCKEDIN_UPSTASH_REDIS_REST_URL / CLOCKEDIN_UPSTASH_REDIS_REST_TOKEN
 *   CLOCKEDIN_KV_REST_API_URL / CLOCKEDIN_KV_REST_API_TOKEN
 */
const url =
  process.env.CLOCKEDIN_UPSTASH_REDIS_REST_URL || process.env.CLOCKEDIN_KV_REST_API_URL;
const token =
  process.env.CLOCKEDIN_UPSTASH_REDIS_REST_TOKEN || process.env.CLOCKEDIN_KV_REST_API_TOKEN;

/**
 * `null` when Redis REST credentials are not configured. Callers must treat
 * caching as optional and fall back to computing values directly, so local
 * dev and tests work without Redis.
 *
 * `KV_URL` / `REDIS_URL` are TCP connection strings and are intentionally
 * ignored — `@upstash/redis` needs the REST URL + token pair.
 */
export const redis = url && token ? new Redis({ url, token }) : null;

export const isRedisEnabled = redis !== null;

if (isRedisEnabled) {
  console.log('Upstash Redis caching enabled');
} else {
  console.warn(
    'Redis not configured (set CLOCKEDIN_UPSTASH_REDIS_REST_URL + CLOCKEDIN_UPSTASH_REDIS_REST_TOKEN, or CLOCKEDIN_KV_REST_API_URL + CLOCKEDIN_KV_REST_API_TOKEN) — caching disabled.',
  );
}

import 'dotenv/config';
import { Redis } from '@upstash/redis';

/**
 * Supports both Upstash-native and Vercel KV env names:
 *   UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
 *   KV_REST_API_URL / KV_REST_API_TOKEN
 */
const url =
  process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token =
  process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

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
    'Redis not configured (set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN, or KV_REST_API_URL + KV_REST_API_TOKEN) — caching disabled.',
  );
}

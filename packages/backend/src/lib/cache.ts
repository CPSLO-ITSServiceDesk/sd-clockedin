import { isRedisEnabled, redis } from './redis';

/**
 * Returns the cached value for `key` when present; otherwise computes it via
 * `fn`, stores it with the given TTL, and returns the fresh value.
 *
 * A no-op passthrough (always calls `fn`) when Redis isn't configured, so
 * caching is strictly a performance layer and never a hard dependency.
 */
export async function withCache<T>(
  key: string,
  ttlSeconds: number,
  fn: () => Promise<T>,
): Promise<T> {
  if (!isRedisEnabled) return fn();

  try {
    const cached = await redis!.get<T>(key);
    if (cached !== null && cached !== undefined) return cached;
  } catch (err) {
    console.error(`Redis GET failed for key "${key}":`, err);
  }

  const fresh = await fn();

  try {
    await redis!.set(key, fresh, { ex: ttlSeconds });
  } catch (err) {
    console.error(`Redis SET failed for key "${key}":`, err);
  }

  return fresh;
}

/** Best-effort cache invalidation; failures are logged, never thrown. */
export async function invalidateCache(...keys: string[]): Promise<void> {
  if (!isRedisEnabled || keys.length === 0) return;

  try {
    await redis!.del(...keys);
  } catch (err) {
    console.error(`Redis DEL failed for key(s) "${keys.join(', ')}":`, err);
  }
}

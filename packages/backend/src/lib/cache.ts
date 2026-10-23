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
  if (!isRedisEnabled) {
    console.log(`[CACHE] DISABLED - calling fn directly for ${key}`);
    return fn();
  }

  console.log(`[CACHE] GET ${key}`);
  try {
    const cached = await redis!.get<T>(key);
    if (cached !== null && cached !== undefined) {
      console.log(`[CACHE] HIT ${key}`);
      return cached;
    }
    console.log(`[CACHE] MISS ${key}`);
  } catch (err) {
    console.error(`[CACHE] Redis GET error for ${key}:`, err);
  }

  const fresh = await fn();

  try {
    await redis!.set(key, fresh, { ex: ttlSeconds });
    console.log(`[CACHE] SET ${key} (TTL: ${ttlSeconds}s)`);
  } catch (err) {
    console.error(`[CACHE] Redis SET error for ${key}:`, err);
  }

  return fresh;
}

function asGeneration(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return 0;
}

/**
 * Reads a monotonic generation, then caches `fn` under the key for that
 * generation. Bumping the generation orphans every key that includes it, so
 * callers don't have to know which ids were cached.
 *
 * When the generation can't be read, `fn` still runs and the result is not
 * stored — a write under a guessed generation could outlive the next bump.
 */
export async function withVersionedCache<T>(
  generationKey: string,
  cacheKey: (generation: number) => string,
  ttlSeconds: number,
  fn: () => Promise<T>,
): Promise<T> {
  if (!isRedisEnabled) return fn();

  let generation: number;
  try {
    generation = asGeneration(await redis!.get(generationKey));
  } catch (err) {
    console.error(`[CACHE] Redis GET error for ${generationKey}:`, err);
    return fn();
  }

  return withCache(cacheKey(generation), ttlSeconds, fn);
}

/** Best-effort generation bump; failures are logged, never thrown. */
export async function bumpCacheGeneration(generationKey: string): Promise<void> {
  if (!isRedisEnabled) return;

  try {
    await redis!.incr(generationKey);
    console.log(`[CACHE] BUMP ${generationKey}`);
  } catch (err) {
    console.error(`[CACHE] Redis INCR error for ${generationKey}:`, err);
  }
}

/** Best-effort cache invalidation; failures are logged, never thrown. */
export async function invalidateCache(...keys: string[]): Promise<void> {
  if (!isRedisEnabled || keys.length === 0) {
    console.log(`[CACHE] INVALIDATE skipped (disabled or no keys):`, keys);
    return;
  }

  console.log(`[CACHE] INVALIDATE ${keys.join(', ')}`);
  try {
    await redis!.del(...keys);
    console.log(`[CACHE] INVALIDATED ${keys.join(', ')}`);
  } catch (err) {
    console.error(`[CACHE] Redis DEL error for ${keys.join(', ')}:`, err);
  }
}

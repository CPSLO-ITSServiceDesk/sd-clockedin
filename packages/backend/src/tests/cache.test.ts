import { beforeEach, describe, expect, it, vi } from 'vitest';

const redisMock = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
  incr: vi.fn(),
};

vi.mock('../lib/redis', () => ({
  redis: redisMock,
  isRedisEnabled: true,
}));

describe('withCache / invalidateCache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns cached value on hit without calling fn', async () => {
    const { withCache } = await import('../lib/cache');
    redisMock.get.mockResolvedValue({ shifts: [] });
    const fn = vi.fn().mockResolvedValue({ shifts: ['fresh'] });

    const result = await withCache('k', 15, fn);

    expect(result).toEqual({ shifts: [] });
    expect(fn).not.toHaveBeenCalled();
    expect(redisMock.set).not.toHaveBeenCalled();
  });

  it('computes, stores, and returns value on miss', async () => {
    const { withCache } = await import('../lib/cache');
    redisMock.get.mockResolvedValue(null);
    const fn = vi.fn().mockResolvedValue({ shifts: ['fresh'] });

    const result = await withCache('k', 15, fn);

    expect(result).toEqual({ shifts: ['fresh'] });
    expect(fn).toHaveBeenCalledOnce();
    expect(redisMock.set).toHaveBeenCalledWith('k', { shifts: ['fresh'] }, { ex: 15 });
  });

  it('falls through to fn when Redis GET fails', async () => {
    const { withCache } = await import('../lib/cache');
    redisMock.get.mockRejectedValue(new Error('network'));
    const fn = vi.fn().mockResolvedValue('ok');

    await expect(withCache('k', 15, fn)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledOnce();
  });

  it('deletes provided keys on invalidate', async () => {
    const { invalidateCache } = await import('../lib/cache');
    redisMock.del.mockResolvedValue(2);

    await invalidateCache('a', 'b');

    expect(redisMock.del).toHaveBeenCalledWith('a', 'b');
  });
});

describe('withVersionedCache / bumpCacheGeneration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('caches under the generation read before computing', async () => {
    const { withVersionedCache } = await import('../lib/cache');
    redisMock.get.mockResolvedValueOnce(3).mockResolvedValueOnce(null);
    const fn = vi.fn().mockResolvedValue({ summary: 1 });

    const result = await withVersionedCache('analytics:gen', (generation) => `analytics:term:7:v${generation}`, 300, fn);

    expect(result).toEqual({ summary: 1 });
    expect(fn).toHaveBeenCalledOnce();
    expect(redisMock.set).toHaveBeenCalledWith('analytics:term:7:v3', { summary: 1 }, { ex: 300 });
  });

  it('returns the cached value for the current generation', async () => {
    const { withVersionedCache } = await import('../lib/cache');
    redisMock.get.mockResolvedValueOnce(3).mockResolvedValueOnce({ summary: 1 });
    const fn = vi.fn();

    await expect(
      withVersionedCache('analytics:gen', (generation) => `analytics:term:7:v${generation}`, 300, fn),
    ).resolves.toEqual({ summary: 1 });
    expect(fn).not.toHaveBeenCalled();
    expect(redisMock.set).not.toHaveBeenCalled();
  });

  it('does not store a result when the generation cannot be read', async () => {
    const { withVersionedCache } = await import('../lib/cache');
    redisMock.get.mockRejectedValueOnce(new Error('network'));
    const fn = vi.fn().mockResolvedValue('ok');

    await expect(withVersionedCache('analytics:gen', (generation) => `k:${generation}`, 10, fn)).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledOnce();
    expect(redisMock.set).not.toHaveBeenCalled();
  });

  it('bumps a generation key', async () => {
    const { bumpCacheGeneration } = await import('../lib/cache');
    redisMock.incr.mockResolvedValue(1);

    await bumpCacheGeneration('analytics:gen');

    expect(redisMock.incr).toHaveBeenCalledWith('analytics:gen');
  });

  it('swallows a failed generation bump', async () => {
    const { bumpCacheGeneration } = await import('../lib/cache');
    redisMock.incr.mockRejectedValue(new Error('network'));

    await expect(bumpCacheGeneration('analytics:gen')).resolves.toBeUndefined();
  });
});

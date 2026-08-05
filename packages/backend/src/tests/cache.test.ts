import { beforeEach, describe, expect, it, vi } from 'vitest';

const redisMock = {
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
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

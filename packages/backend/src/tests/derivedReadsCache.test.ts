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

describe('derived read TTLs', () => {
  it('keeps a finished term and a closed month for a day', async () => {
    const { STABLE_READ_TTL_SECONDS, analyticsTtlSeconds, timesheetTtlSeconds } = await import(
      '../lib/derivedReadsCache'
    );
    expect(analyticsTtlSeconds('2026-05-01', '2026-10-23')).toBe(STABLE_READ_TTL_SECONDS);
    expect(timesheetTtlSeconds('2026-09', '2026-10-23')).toBe(STABLE_READ_TTL_SECONDS);
  });

  it('refreshes a live term and the current month within minutes', async () => {
    const { DERIVED_READ_TTL_SECONDS, analyticsTtlSeconds, timesheetTtlSeconds } = await import(
      '../lib/derivedReadsCache'
    );
    expect(analyticsTtlSeconds('2026-12-01', '2026-10-23')).toBe(DERIVED_READ_TTL_SECONDS);
    expect(analyticsTtlSeconds('2026-10-23', '2026-10-23')).toBe(DERIVED_READ_TTL_SECONDS);
    expect(analyticsTtlSeconds(null, '2026-10-23')).toBe(DERIVED_READ_TTL_SECONDS);
    expect(timesheetTtlSeconds('2026-10', '2026-10-23')).toBe(DERIVED_READ_TTL_SECONDS);
    expect(timesheetTtlSeconds('2026-11', '2026-10-23')).toBe(DERIVED_READ_TTL_SECONDS);
  });
});

describe('invalidateLiveReads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redisMock.del.mockResolvedValue(2);
    redisMock.incr.mockResolvedValue(1);
  });

  it('drops today\'s shift board and bumps analytics and timesheet generations', async () => {
    const { invalidateLiveReads } = await import('../lib/derivedReadsCache');

    await invalidateLiveReads();

    expect(redisMock.del).toHaveBeenCalledOnce();
    const [withoutRemote, withRemote] = redisMock.del.mock.calls[0];
    expect(withoutRemote).toMatch(/^today-shifts:\d{4}-\d{2}-\d{2}:0$/);
    expect(withRemote).toMatch(/^today-shifts:\d{4}-\d{2}-\d{2}:1$/);
    expect(redisMock.incr).toHaveBeenCalledWith('analytics:gen');
    expect(redisMock.incr).toHaveBeenCalledWith('timesheet:gen');
  });

  it('shares one generation bump across overlapping invalidations', async () => {
    const { invalidateDerivedReads } = await import('../lib/derivedReadsCache');
    redisMock.incr.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(1), 20)),
    );

    await Promise.all([invalidateDerivedReads(), invalidateDerivedReads()]);

    expect(redisMock.incr).toHaveBeenCalledTimes(2);
  });

  it('bumps again after the previous invalidation finishes', async () => {
    const { invalidateDerivedReads } = await import('../lib/derivedReadsCache');

    await invalidateDerivedReads();
    await invalidateDerivedReads();

    expect(redisMock.incr).toHaveBeenCalledTimes(4);
  });
});

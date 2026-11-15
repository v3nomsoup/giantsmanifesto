import { describe, expect, it } from 'vitest';
import { RateLimiter } from '../../src/lib/security/rate-limit';

describe('RateLimiter', () => {
  it('blocks the hit over the limit and allows again after the window', () => {
    const limiter = new RateLimiter(2, 1000);
    expect(limiter.hit('a', 0)).toBe(true);
    expect(limiter.hit('a', 10)).toBe(true);
    expect(limiter.hit('a', 20)).toBe(false);
    expect(limiter.hit('a', 1001)).toBe(true);
  });

  it('keeps keys independent', () => {
    const limiter = new RateLimiter(1, 1000);
    expect(limiter.hit('a', 0)).toBe(true);
    expect(limiter.hit('a', 1)).toBe(false);
    expect(limiter.hit('b', 1)).toBe(true);
  });

  it('drops expired keys so memory stays bounded', () => {
    const limiter = new RateLimiter(1, 1000);
    for (let i = 0; i < 50; i++) limiter.hit(`k${i}`, 0);
    limiter.hit('fresh', 5000);
    expect(limiter.size).toBe(1);
  });
});

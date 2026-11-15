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

  it('prunes oldest windows first and stays correct across windows', () => {
    const limiter = new RateLimiter(1, 1000);
    limiter.hit('a', 0);
    limiter.hit('b', 600);
    // a expired, b still live: b keeps its count, a starts fresh at the end of the order.
    expect(limiter.hit('a', 1100)).toBe(true);
    expect(limiter.hit('b', 1200)).toBe(false);
    expect(limiter.hit('a', 1300)).toBe(false);
    expect(limiter.size).toBe(2);
    // b's window (start 600) ends at 1600, a's (start 1100) at 2100.
    expect(limiter.hit('b', 1700)).toBe(true);
    expect(limiter.hit('a', 1700)).toBe(false);
    expect(limiter.hit('a', 2200)).toBe(true);
  });

  it('refuses new keys when the table is full but still serves known ones', () => {
    const limiter = new RateLimiter(5, 1000, 2);
    expect(limiter.hit('a', 0)).toBe(true);
    expect(limiter.hit('b', 0)).toBe(true);
    expect(limiter.hit('c', 0)).toBe(false);
    expect(limiter.size).toBe(2);
    expect(limiter.hit('a', 1)).toBe(true);
    expect(limiter.hit('c', 1001)).toBe(true);
  });

  it('drops expired keys so memory stays bounded', () => {
    const limiter = new RateLimiter(1, 1000);
    for (let i = 0; i < 50; i++) limiter.hit(`k${i}`, 0);
    limiter.hit('fresh', 5000);
    expect(limiter.size).toBe(1);
  });
});

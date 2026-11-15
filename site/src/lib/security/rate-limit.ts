/** Fixed-window counter per key, in process memory. */
export class RateLimiter {
  private readonly windows = new Map<string, { start: number; count: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  get size(): number {
    return this.windows.size;
  }

  /** Counts a hit; true means allowed, false means over the limit. */
  hit(key: string, now: number = Date.now()): boolean {
    // Expired keys are dropped while counting, so memory stays bounded by active clients.
    for (const [k, w] of this.windows) {
      if (now - w.start >= this.windowMs) this.windows.delete(k);
    }
    const current = this.windows.get(key);
    if (!current) {
      this.windows.set(key, { start: now, count: 1 });
      return this.limit >= 1;
    }
    current.count += 1;
    return current.count <= this.limit;
  }
}

export const FORM_WINDOW_MS = 15 * 60 * 1000;

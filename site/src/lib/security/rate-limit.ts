export const FORM_WINDOW_MS = 15 * 60 * 1000;
export const MAX_TRACKED_KEYS = 50_000;

/** Fixed-window counter per key, in process memory, bounded in size and pruning cost. */
export class RateLimiter {
  // Insertion order equals window-start order (expired keys are deleted and re-added at the end).
  private readonly windows = new Map<string, { start: number; count: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly maxKeys: number = MAX_TRACKED_KEYS,
  ) {}

  get size(): number {
    return this.windows.size;
  }

  /** Counts a hit; true means allowed, false means over the limit (or table full). */
  hit(key: string, now: number = Date.now()): boolean {
    // Oldest windows first; stop at the first live one, so pruning is amortized O(1).
    for (const [k, w] of this.windows) {
      if (now - w.start < this.windowMs) break;
      this.windows.delete(k);
    }
    const current = this.windows.get(key);
    if (!current) {
      // Under a flood of distinct keys, refuse new ones rather than grow without bound.
      if (this.windows.size >= this.maxKeys) return false;
      this.windows.set(key, { start: now, count: 1 });
      return this.limit >= 1;
    }
    current.count += 1;
    return current.count <= this.limit;
  }
}

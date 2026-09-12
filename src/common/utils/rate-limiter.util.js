'use strict';

/**
 * Sliding Window In-Memory Rate Limiter.
 * Tracks requests within a sliding window interval to mitigate burst spikes
 * and API resource starvation.
 */
class RateLimiter {
  /**
   * @param {Object} options
   * @param {number} [options.windowMs=60000] - Window duration in milliseconds (default 1 min)
   * @param {number} [options.maxRequests=100] - Max requests allowed per window
   */
  constructor(options = {}) {
    this.windowMs = options.windowMs || 60000;
    this.maxRequests = options.maxRequests || 100;
    this.hits = new Map();
  }

  /**
   * Check if a request for a key is allowed under the current sliding window.
   * @param {string} key - Unique identifier (e.g. IP address or user ID)
   * @returns {{ allowed: boolean, remaining: number, resetTimeMs: number, total: number }}
   */
  check(key) {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    let timestamps = this.hits.get(key) || [];
    // Filter timestamps falling outside current sliding window
    timestamps = timestamps.filter((t) => t > windowStart);

    if (timestamps.length >= this.maxRequests) {
      const oldest = timestamps[0];
      const resetTimeMs = oldest + this.windowMs;
      this.hits.set(key, timestamps);
      return {
        allowed: false,
        remaining: 0,
        resetTimeMs,
        total: timestamps.length,
      };
    }

    timestamps.push(now);
    this.hits.set(key, timestamps);

    const resetTimeMs = timestamps[0] + this.windowMs;
    return {
      allowed: true,
      remaining: Math.max(0, this.maxRequests - timestamps.length),
      resetTimeMs,
      total: timestamps.length,
    };
  }

  /**
   * Reset rate limit counts for a specific key.
   * @param {string} key
   */
  reset(key) {
    this.hits.delete(key);
  }

  /**
   * Clear all tracked keys.
   */
  clear() {
    this.hits.clear();
  }
}

module.exports = { RateLimiter };

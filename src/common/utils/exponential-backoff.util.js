'use strict';

class ExponentialBackoff {
  constructor(options = {}) {
    this.baseDelayMs = options.baseDelayMs || 100;
    this.maxDelayMs = options.maxDelayMs || 5000;
    this.factor = options.factor || 2;
    this.jitter = options.jitter !== undefined ? options.jitter : true;
  }

  calculateDelay(attempt) {
    if (attempt < 0) attempt = 0;
    const exponential = Math.min(this.maxDelayMs, this.baseDelayMs * Math.pow(this.factor, attempt));
    if (!this.jitter) return Math.floor(exponential);
    return Math.floor(Math.random() * exponential);
  }

  async executeWithRetry(fn, maxAttempts = 3) {
    let lastError;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        return await fn(attempt);
      } catch (err) {
        lastError = err;
        if (attempt === maxAttempts - 1) break;
        const delay = this.calculateDelay(attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw lastError;
  }
}

module.exports = { ExponentialBackoff };

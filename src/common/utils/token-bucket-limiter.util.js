'use strict';

class TokenBucketLimiter {
  constructor(options = {}) {
    this.capacity = options.capacity || 10;
    this.refillRatePerSec = options.refillRatePerSec || 5;
    this.tokens = this.capacity;
    this.lastRefill = Date.now();
  }

  _refill() {
    const now = Date.now();
    const elapsedSeconds = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsedSeconds * this.refillRatePerSec);
    this.lastRefill = now;
  }

  tryConsume(tokens = 1) {
    this._refill();
    if (this.tokens >= tokens) {
      this.tokens -= tokens;
      return true;
    }
    return false;
  }

  getAvailableTokens() {
    this._refill();
    return Number(this.tokens.toFixed(2));
  }
}

module.exports = { TokenBucketLimiter };

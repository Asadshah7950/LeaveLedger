'use strict';

/**
 * Resilient Exponential Backoff Retry with Full Jitter.
 * Decorates asynchronous external service calls with customizable backoff curves.
 */
async function retryWithBackoff(fn, options = {}) {
  const maxAttempts = options.maxAttempts || 3;
  const initialDelayMs = options.initialDelayMs || 100;
  const backoffFactor = options.backoffFactor || 2;
  const maxDelayMs = options.maxDelayMs || 5000;
  const shouldRetry = options.shouldRetry || (() => true);

  let attempt = 0;
  let lastError;

  while (attempt < maxAttempts) {
    attempt++;
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt >= maxAttempts || !shouldRetry(err)) {
        throw err;
      }
      const baseDelay = Math.min(maxDelayMs, initialDelayMs * Math.pow(backoffFactor, attempt - 1));
      // Full jitter: uniformly distributed between 0 and baseDelay
      const jitterDelay = Math.floor(Math.random() * baseDelay);
      await new Promise((resolve) => setTimeout(resolve, jitterDelay));
    }
  }
  throw lastError;
}

module.exports = { retryWithBackoff };

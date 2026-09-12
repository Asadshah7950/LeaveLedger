'use strict';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isRetryable(error) {
  if (error.code === 'CIRCUIT_OPEN' || error.code === 'CIRCUIT_HALF_OPEN') {
    return false;
  }
  if (error.response) {
    const status = error.response.status;
    if (status === 429 || status === 408) return true;
    if (status >= 400 && status < 500) return false;
    return true; // 5xx
  }
  return true;
}

async function withRetry(fn, options = {}) {
  const {
    maxAttempts = 3,
    baseDelayMs = 1000,
    maxDelayMs = 10000,
    jitter = true,
    onRetry = null,
  } = options;

  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;

      if (attempt === maxAttempts || !isRetryable(error)) {
        throw error;
      }

      const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1);
      const cappedDelay = Math.min(exponentialDelay, maxDelayMs);
      const actualDelay = jitter
        ? cappedDelay * (0.5 + Math.random() * 0.5)
        : cappedDelay;

      if (onRetry) {
        onRetry(error, attempt);
      }

      await sleep(actualDelay);
    }
  }

  throw lastError;
}

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
      const jitterDelay = Math.floor(Math.random() * baseDelay);
      await sleep(jitterDelay);
    }
  }
  throw lastError;
}

module.exports = { withRetry, retryWithBackoff, isRetryable, sleep };

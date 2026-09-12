'use strict';

/**
 * Circuit Breaker — protects downstream calls from cascading failure.
 *
 * Implements the standard three-state pattern:
 *
 *   CLOSED ──(N failures)──► OPEN ──(cooldown expires)──► HALF_OPEN
 *     ▲                                                       │
 *     └────────────────────(probe succeeds)───────────────────┘
 *
 * Usage:
 *   const breaker = new CircuitBreaker({ failureThreshold: 5, cooldownMs: 30_000 });
 *   const result = await breaker.call(() => externalHcmService.getEmployeeBalance(id));
 */

const STATE = Object.freeze({ CLOSED: 'CLOSED', OPEN: 'OPEN', HALF_OPEN: 'HALF_OPEN' });

class CircuitBreakerOpenError extends Error {
  constructor(name, cooldownRemainingMs) {
    super(
      `CircuitBreaker [${name}] is OPEN. Retry in ${Math.ceil(cooldownRemainingMs / 1000)}s.`
    );
    this.name = 'CircuitBreakerOpenError';
    this.circuitName = name;
    this.cooldownRemainingMs = cooldownRemainingMs;
  }
}

class CircuitBreaker {
  /**
   * @param {object} options
   * @param {string}  [options.name='default']         - Identifier for logs
   * @param {number}  [options.failureThreshold=5]     - Consecutive failures to open
   * @param {number}  [options.cooldownMs=30000]       - ms to stay OPEN before HALF_OPEN
   * @param {number}  [options.timeout=10000]          - Max ms per call before treating as failure
   * @param {Function} [options.fallback]              - Optional fn(err) to call in OPEN state
   */
  constructor(options = {}) {
    this._name = options.name || 'default';
    this._failureThreshold = options.failureThreshold ?? 5;
    this._cooldownMs = options.cooldownMs ?? 30_000;
    this._timeout = options.timeout ?? 10_000;
    this._fallback = options.fallback || null;

    this._state = STATE.CLOSED;
    this._failureCount = 0;
    this._openedAt = null;
    this._successCount = 0;
  }

  get state() { return this._state; }
  get failureCount() { return this._failureCount; }

  /**
   * Execute an async function through the circuit breaker.
   *
   * @template T
   * @param {() => Promise<T>} fn
   * @returns {Promise<T>}
   * @throws {CircuitBreakerOpenError} when state is OPEN and no fallback configured
   */
  async call(fn) {
    if (this._state === STATE.OPEN) {
      const elapsed = Date.now() - this._openedAt;
      const remaining = this._cooldownMs - elapsed;

      if (remaining > 0) {
        const err = new CircuitBreakerOpenError(this._name, remaining);
        if (this._fallback) return this._fallback(err);
        throw err;
      }
      // Cooldown expired — probe with HALF_OPEN
      this._state = STATE.HALF_OPEN;
    }

    try {
      const result = await this._withTimeout(fn);
      this._onSuccess();
      return result;
    } catch (err) {
      this._onFailure();
      throw err;
    }
  }

  /**
   * Wrap a promise with a hard timeout.
   * @param {Function} fn
   * @returns {Promise}
   */
  _withTimeout(fn) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`CircuitBreaker [${this._name}] call timed out after ${this._timeout}ms`)),
        this._timeout
      );
      Promise.resolve()
        .then(() => fn())
        .then((val) => { clearTimeout(timer); resolve(val); })
        .catch((err) => { clearTimeout(timer); reject(err); });
    });
  }

  _onSuccess() {
    if (this._state === STATE.HALF_OPEN) {
      // Probe succeeded — reset to CLOSED
      this._state = STATE.CLOSED;
      this._failureCount = 0;
      this._openedAt = null;
    } else {
      this._failureCount = 0;
    }
    this._successCount++;
  }

  _onFailure() {
    this._failureCount++;
    if (this._state === STATE.HALF_OPEN || this._failureCount >= this._failureThreshold) {
      this._state = STATE.OPEN;
      this._openedAt = Date.now();
    }
  }

  /** Manually reset to CLOSED state (useful in tests or admin endpoints). */
  reset() {
    this._state = STATE.CLOSED;
    this._failureCount = 0;
    this._openedAt = null;
  }

  toJSON() {
    return {
      name: this._name,
      state: this._state,
      failureCount: this._failureCount,
      openedAt: this._openedAt,
    };
  }
}

module.exports = { CircuitBreaker, CircuitBreakerOpenError, STATE };

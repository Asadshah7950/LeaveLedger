'use strict';

const { CircuitState } = require('../constants');

const STATE = Object.freeze({
  CLOSED: CircuitState ? CircuitState.CLOSED : 'CLOSED',
  OPEN: CircuitState ? CircuitState.OPEN : 'OPEN',
  HALF_OPEN: CircuitState ? CircuitState.HALF_OPEN : 'HALF_OPEN',
});

class CircuitBreakerOpenError extends Error {
  constructor(name, cooldownRemainingMs) {
    super(`CircuitBreaker [${name}] is OPEN. Retry in ${Math.ceil(cooldownRemainingMs / 1000)}s.`);
    this.name = 'CircuitBreakerOpenError';
    this.circuitName = name;
    this.cooldownRemainingMs = cooldownRemainingMs;
    this.code = 'CIRCUIT_OPEN';
  }
}

class CircuitBreaker {
  constructor(arg1, arg2) {
    if (typeof arg1 === 'function') {
      this.fn = arg1;
      const opts = arg2 || {};
      this._name = opts.name || 'CircuitBreaker';
      this.name = this._name;
      this._failureThreshold = opts.failureThreshold ?? 5;
      this.failureThreshold = this._failureThreshold;
      this._cooldownMs = opts.resetTimeoutMs ?? opts.cooldownMs ?? 30000;
      this.resetTimeoutMs = this._cooldownMs;
      this._timeout = opts.timeout ?? 10000;
      this._fallback = opts.fallback || null;
    } else {
      const opts = arg1 || {};
      this.fn = null;
      this._name = opts.name || 'default';
      this.name = this._name;
      this._failureThreshold = opts.failureThreshold ?? 5;
      this.failureThreshold = this._failureThreshold;
      this._cooldownMs = opts.resetTimeoutMs ?? opts.cooldownMs ?? 30000;
      this.resetTimeoutMs = this._cooldownMs;
      this._timeout = opts.timeout ?? 10000;
      this._fallback = opts.fallback || null;
    }

    this._state = STATE.CLOSED;
    this._failureCount = 0;
    this._failures = 0;
    this._openedAt = null;
    this._nextAttemptAt = null;
    this._successCount = 0;
    this._halfOpenInFlight = false;
  }

  get state() { return this._state; }
  get failureCount() { return this._failureCount; }
  get failures() { return this._failureCount; }

  async call(...args) {
    let callFn;
    if (typeof args[0] === 'function') {
      callFn = args[0];
    } else if (this.fn) {
      callFn = () => this.fn(...args);
    } else {
      throw new TypeError('CircuitBreaker.call expects a function argument when no default function is bound');
    }

    if (this._state === STATE.OPEN) {
      const elapsed = Date.now() - (this._openedAt || (this._nextAttemptAt ? this._nextAttemptAt - this._cooldownMs : Date.now()));
      const remaining = this._cooldownMs - elapsed;

      if (remaining > 0) {
        const err = new CircuitBreakerOpenError(this._name, remaining);
        if (this._fallback) return this._fallback(err);
        throw err;
      }
      this._state = STATE.HALF_OPEN;
    }

    try {
      const result = await this._withTimeout(callFn);
      this._onSuccess();
      return result;
    } catch (err) {
      this._onFailure(err);
      throw err;
    }
  }

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
      this._state = STATE.CLOSED;
      this._failureCount = 0;
      this._failures = 0;
      this._openedAt = null;
      this._nextAttemptAt = null;
    } else {
      this._failureCount = 0;
      this._failures = 0;
    }
    this._successCount++;
  }

  _onFailure(err) {
    this._failureCount++;
    this._failures = this._failureCount;
    if (this._state === STATE.HALF_OPEN || this._failureCount >= this._failureThreshold) {
      this._state = STATE.OPEN;
      this._openedAt = Date.now();
      this._nextAttemptAt = this._openedAt + this._cooldownMs;
    }
  }

  reset() {
    this._state = STATE.CLOSED;
    this._failureCount = 0;
    this._failures = 0;
    this._openedAt = null;
    this._nextAttemptAt = null;
  }

  getStatus() {
    return {
      name: this._name,
      state: this._state,
      failures: this._failureCount,
      nextAttemptAt: this._nextAttemptAt ? new Date(this._nextAttemptAt).toISOString() : null,
    };
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

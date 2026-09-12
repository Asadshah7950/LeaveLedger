'use strict';

const STATE = {
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN',
};

class CircuitBreakerStateMachine {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 3;
    this.cooldownMs = options.cooldownMs || 5000;
    this.state = STATE.CLOSED;
    this.failureCount = 0;
    this.lastStateChange = Date.now();
  }

  getState() {
    if (this.state === STATE.OPEN && Date.now() - this.lastStateChange >= this.cooldownMs) {
      this.state = STATE.HALF_OPEN;
      this.lastStateChange = Date.now();
    }
    return this.state;
  }

  recordSuccess() {
    this.failureCount = 0;
    this.state = STATE.CLOSED;
    this.lastStateChange = Date.now();
  }

  recordFailure() {
    this.failureCount++;
    if (this.failureCount >= this.failureThreshold || this.state === STATE.HALF_OPEN) {
      this.state = STATE.OPEN;
      this.lastStateChange = Date.now();
    }
  }

  canExecute() {
    return this.getState() !== STATE.OPEN;
  }
}

module.exports = { CircuitBreakerStateMachine, STATE };

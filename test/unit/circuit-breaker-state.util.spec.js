'use strict';

const { CircuitBreakerStateMachine, STATE } = require('../../src/common/utils/circuit-breaker-state.util');

describe('CircuitBreakerStateMachine (Unit)', () => {
  it('initializes in CLOSED state and allows execution', () => {
    const cb = new CircuitBreakerStateMachine({ failureThreshold: 2 });
    expect(cb.getState()).toBe(STATE.CLOSED);
    expect(cb.canExecute()).toBe(true);
  });

  it('trips to OPEN state after exceeding failure threshold', () => {
    const cb = new CircuitBreakerStateMachine({ failureThreshold: 2 });
    cb.recordFailure();
    expect(cb.getState()).toBe(STATE.CLOSED);
    cb.recordFailure();
    expect(cb.getState()).toBe(STATE.OPEN);
    expect(cb.canExecute()).toBe(false);
  });

  it('resets to CLOSED upon recorded success', () => {
    const cb = new CircuitBreakerStateMachine({ failureThreshold: 2 });
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getState()).toBe(STATE.OPEN);
    cb.recordSuccess();
    expect(cb.getState()).toBe(STATE.CLOSED);
    expect(cb.canExecute()).toBe(true);
  });
});

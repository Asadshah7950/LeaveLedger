'use strict';

const { CircuitBreaker, CircuitBreakerOpenError, STATE } = require('../../src/common/utils/circuit-breaker.util');

describe('CircuitBreaker (Unit)', () => {
  const success = () => Promise.resolve('ok');
  const fail = () => Promise.reject(new Error('downstream error'));
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));

  it('stays CLOSED when failures are below threshold', async () => {
    const cb = new CircuitBreaker({ name: 'test', failureThreshold: 3 });
    await expect(cb.call(success)).resolves.toBe('ok');
    expect(cb.state).toBe(STATE.CLOSED);
  });

  it('opens after reaching failure threshold', async () => {
    const cb = new CircuitBreaker({ name: 'test', failureThreshold: 2 });
    await expect(cb.call(fail)).rejects.toThrow('downstream error');
    await expect(cb.call(fail)).rejects.toThrow('downstream error');
    expect(cb.state).toBe(STATE.OPEN);
  });

  it('throws CircuitBreakerOpenError when OPEN', async () => {
    const cb = new CircuitBreaker({ name: 'test', failureThreshold: 1, cooldownMs: 60_000 });
    await expect(cb.call(fail)).rejects.toThrow();
    await expect(cb.call(success)).rejects.toBeInstanceOf(CircuitBreakerOpenError);
  });

  it('calls fallback when configured and OPEN', async () => {
    const cb = new CircuitBreaker({
      name: 'test',
      failureThreshold: 1,
      cooldownMs: 60_000,
      fallback: () => 'fallback-value',
    });
    await expect(cb.call(fail)).rejects.toThrow();
    const result = await cb.call(success);
    expect(result).toBe('fallback-value');
  });

  it('transitions to HALF_OPEN after cooldown expires', async () => {
    const cb = new CircuitBreaker({ name: 'test', failureThreshold: 1, cooldownMs: 10 });
    await expect(cb.call(fail)).rejects.toThrow();
    expect(cb.state).toBe(STATE.OPEN);
    await delay(20);
    // The next call should try HALF_OPEN probe
    await expect(cb.call(success)).resolves.toBe('ok');
    expect(cb.state).toBe(STATE.CLOSED);
  });

  it('re-opens if HALF_OPEN probe fails', async () => {
    const cb = new CircuitBreaker({ name: 'test', failureThreshold: 1, cooldownMs: 10 });
    await expect(cb.call(fail)).rejects.toThrow();
    await delay(20);
    await expect(cb.call(fail)).rejects.toThrow();
    expect(cb.state).toBe(STATE.OPEN);
  });

  it('reset() clears failure count and restores CLOSED', async () => {
    const cb = new CircuitBreaker({ name: 'test', failureThreshold: 1, cooldownMs: 60_000 });
    await expect(cb.call(fail)).rejects.toThrow();
    expect(cb.state).toBe(STATE.OPEN);
    cb.reset();
    expect(cb.state).toBe(STATE.CLOSED);
    expect(cb.failureCount).toBe(0);
  });

  it('rejects on timeout', async () => {
    const cb = new CircuitBreaker({ name: 'test', timeout: 10 });
    const slowFn = () => new Promise((r) => setTimeout(r, 100));
    await expect(cb.call(slowFn)).rejects.toThrow('timed out');
  });
});

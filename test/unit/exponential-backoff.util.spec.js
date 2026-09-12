'use strict';

const { ExponentialBackoff } = require('../../src/common/utils/exponential-backoff.util');

describe('ExponentialBackoff (Unit)', () => {
  it('calculates deterministic delay without jitter', () => {
    const backoff = new ExponentialBackoff({ baseDelayMs: 100, factor: 2, jitter: false, maxDelayMs: 1000 });
    expect(backoff.calculateDelay(0)).toBe(100);
    expect(backoff.calculateDelay(1)).toBe(200);
    expect(backoff.calculateDelay(2)).toBe(400);
    expect(backoff.calculateDelay(5)).toBe(1000); // capped at maxDelayMs
  });

  it('calculates delay with jitter within bound', () => {
    const backoff = new ExponentialBackoff({ baseDelayMs: 100, factor: 2, jitter: true, maxDelayMs: 1000 });
    const delay = backoff.calculateDelay(2);
    expect(delay).toBeGreaterThanOrEqual(0);
    expect(delay).toBeLessThanOrEqual(400);
  });

  it('retries successfully on transient failure', async () => {
    const backoff = new ExponentialBackoff({ baseDelayMs: 10, maxDelayMs: 20, jitter: false });
    let attempts = 0;
    const result = await backoff.executeWithRetry(async (att) => {
      attempts++;
      if (att < 1) throw new Error('Transient error');
      return 'success';
    }, 3);
    expect(result).toBe('success');
    expect(attempts).toBe(2);
  });
});

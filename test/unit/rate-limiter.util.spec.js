'use strict';

const { RateLimiter } = require('../../src/common/utils/rate-limiter.util');

describe('RateLimiter (Unit)', () => {
  let limiter;

  beforeEach(() => {
    limiter = new RateLimiter({ windowMs: 1000, maxRequests: 3 });
  });

  it('allows requests within max limit and decreases remaining counter', () => {
    const res1 = limiter.check('client-1');
    expect(res1.allowed).toBe(true);
    expect(res1.remaining).toBe(2);
    expect(res1.total).toBe(1);

    const res2 = limiter.check('client-1');
    expect(res2.allowed).toBe(true);
    expect(res2.remaining).toBe(1);

    const res3 = limiter.check('client-1');
    expect(res3.allowed).toBe(true);
    expect(res3.remaining).toBe(0);
  });

  it('blocks subsequent requests once max limit is reached', () => {
    limiter.check('client-2');
    limiter.check('client-2');
    limiter.check('client-2');

    const blocked = limiter.check('client-2');
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.resetTimeMs).toBeGreaterThan(Date.now());
  });

  it('tracks distinct clients independently', () => {
    limiter.check('client-a');
    limiter.check('client-a');
    limiter.check('client-a');

    const blockedA = limiter.check('client-a');
    expect(blockedA.allowed).toBe(false);

    const allowedB = limiter.check('client-b');
    expect(allowedB.allowed).toBe(true);
    expect(allowedB.remaining).toBe(2);
  });

  it('resets count when reset(key) is invoked', () => {
    limiter.check('client-reset');
    limiter.check('client-reset');
    limiter.check('client-reset');
    expect(limiter.check('client-reset').allowed).toBe(false);

    limiter.reset('client-reset');
    const afterReset = limiter.check('client-reset');
    expect(afterReset.allowed).toBe(true);
    expect(afterReset.remaining).toBe(2);
  });

  it('clears all tracked keys on clear()', () => {
    limiter.check('client-x');
    limiter.check('client-y');
    limiter.clear();

    expect(limiter.hits.size).toBe(0);
  });

  it('allows new requests once window expires', async () => {
    const fastLimiter = new RateLimiter({ windowMs: 50, maxRequests: 2 });
    fastLimiter.check('key');
    fastLimiter.check('key');
    expect(fastLimiter.check('key').allowed).toBe(false);

    await new Promise((resolve) => setTimeout(resolve, 60));

    const result = fastLimiter.check('key');
    expect(result.allowed).toBe(true);
  });
});

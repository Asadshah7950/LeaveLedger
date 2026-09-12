'use strict';

const { TokenBucketLimiter } = require('../../src/common/utils/token-bucket-limiter.util');

describe('TokenBucketLimiter (Unit)', () => {
  it('consumes tokens within capacity', () => {
    const limiter = new TokenBucketLimiter({ capacity: 5, refillRatePerSec: 1 });
    expect(limiter.tryConsume(3)).toBe(true);
    expect(limiter.tryConsume(2)).toBe(true);
    expect(limiter.tryConsume(1)).toBe(false);
  });

  it('refills tokens over elapsed duration', async () => {
    const limiter = new TokenBucketLimiter({ capacity: 2, refillRatePerSec: 10 });
    expect(limiter.tryConsume(2)).toBe(true);
    expect(limiter.tryConsume(1)).toBe(false);
    await new Promise((r) => setTimeout(r, 150));
    expect(limiter.tryConsume(1)).toBe(true);
  });
});

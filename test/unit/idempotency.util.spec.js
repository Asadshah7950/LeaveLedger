'use strict';

const { IdempotencyManager } = require('../../src/common/utils/idempotency.util');

describe('IdempotencyManager (Unit)', () => {
  let manager;

  beforeEach(() => {
    manager = new IdempotencyManager({ ttlMs: 1000 });
  });

  it('marks new key as NEW', () => {
    const res = manager.begin('k1', { days: 3 });
    expect(res.status).toBe('NEW');
  });

  it('marks concurrent request with same key as IN_FLIGHT', () => {
    manager.begin('k1', { days: 3 });
    const res2 = manager.begin('k1', { days: 3 });
    expect(res2.status).toBe('IN_FLIGHT');
  });

  it('stores completed response and replays it', () => {
    manager.begin('k1', { days: 3 });
    manager.complete('k1', { approved: true, id: 'req-1' });

    const res2 = manager.begin('k1', { days: 3 });
    expect(res2.status).toBe('COMPLETED');
    expect(res2.response).toEqual({ approved: true, id: 'req-1' });
  });

  it('throws on reused key with altered payload', () => {
    manager.begin('k1', { days: 3 });
    expect(() => manager.begin('k1', { days: 5 })).toThrow('Idempotency key reused with different request payload');
  });

  it('removes keys manually', () => {
    manager.begin('k1', { days: 3 });
    manager.remove('k1');
    expect(manager.size).toBe(0);
  });

  it('throws TypeError on invalid key', () => {
    expect(() => manager.begin('', {})).toThrow(TypeError);
    expect(() => manager.begin(null, {})).toThrow(TypeError);
  });
});

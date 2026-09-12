'use strict';

const { RequestDeduplicator } = require('../../src/common/utils/request-deduplication.util');

describe('RequestDeduplicator (Unit)', () => {
  it('deduplicates concurrent calls with identical idempotency keys', async () => {
    const deduplicator = new RequestDeduplicator();
    let invocations = 0;
    const task = async () => {
      invocations++;
      await new Promise((r) => setTimeout(r, 20));
      return { status: 'created' };
    };

    const [res1, res2] = await Promise.all([
      deduplicator.execute('req-123', task),
      deduplicator.execute('req-123', task),
    ]);

    expect(res1).toEqual({ status: 'created' });
    expect(res2).toEqual({ status: 'created' });
    expect(invocations).toBe(1);
  });

  it('evicts cache entry on promise failure', async () => {
    const deduplicator = new RequestDeduplicator();
    let count = 0;
    const failingTask = async () => {
      count++;
      throw new Error('Database timeout');
    };

    await expect(deduplicator.execute('req-fail', failingTask)).rejects.toThrow('Database timeout');
    await expect(deduplicator.execute('req-fail', failingTask)).rejects.toThrow('Database timeout');
    expect(count).toBe(2);
  });
});

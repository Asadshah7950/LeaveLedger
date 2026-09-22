'use strict';

const { DeadLetterQueue } = require('../../src/common/utils/dead-letter-queue.util');

describe('DeadLetterQueue (Unit)', () => {
  let dlq;

  beforeEach(() => {
    dlq = new DeadLetterQueue({
      maxRetries: 3,
      baseBackoffMs: 50,
      maxBackoffMs: 500,
      maxCapacity: 5,
    });
  });

  it('enqueues a failed message and records initial metadata', () => {
    const error = new Error('Connection reset by peer');
    error.code = 'ECONNRESET';

    const record = dlq.enqueue({
      id: 'msg-101',
      channel: 'leave.balance.reserved',
      payload: { employeeId: 'emp-1', amount: 5 },
      error,
    });

    expect(record.id).toBe('msg-101');
    expect(record.channel).toBe('leave.balance.reserved');
    expect(record.attempts).toBe(1);
    expect(record.isPoison).toBe(false);
    expect(record.initialError.category).toBe('ECONNRESET');
    expect(record.initialError.message).toBe('Connection reset by peer');
    expect(dlq.get('msg-101')).not.toBeNull();
  });

  it('increments attempts on subsequent enqueue and flags poison message when maxRetries reached', () => {
    dlq.enqueue({ id: 'msg-200', channel: 'outbox.events', payload: { data: 1 } });
    dlq.enqueue({ id: 'msg-200', channel: 'outbox.events', payload: { data: 1 } });
    const finalRecord = dlq.enqueue({
      id: 'msg-200',
      channel: 'outbox.events',
      payload: { data: 1 },
      error: new Error('Permanent database crash'),
    });

    expect(finalRecord.attempts).toBe(3);
    expect(finalRecord.isPoison).toBe(true);
    expect(dlq.canRetry('msg-200')).toBe(false);

    const stats = dlq.getStats();
    expect(stats.poisonCount).toBe(1);
    expect(stats.size).toBe(1);
  });

  it('redrives message successfully through processor and evicts from queue', async () => {
    dlq.enqueue({
      id: 'msg-300',
      channel: 'balance.updates',
      payload: { balance: 100 },
    });

    const mockProcessor = jest.fn().mockResolvedValue(true);
    const success = await dlq.redrive('msg-300', mockProcessor);

    expect(success).toBe(true);
    expect(mockProcessor).toHaveBeenCalledWith({ balance: 100 }, 'balance.updates');
    expect(dlq.get('msg-300')).toBeNull();
    expect(dlq.getStats().totalRedriven).toBe(1);
  });

  it('re-enqueues message with incremented attempts if redrive processor fails', async () => {
    dlq.enqueue({
      id: 'msg-400',
      channel: 'balance.updates',
      payload: { balance: 50 },
    });

    const failingProcessor = jest.fn().mockRejectedValue(new Error('Broker still down'));
    const success = await dlq.redrive('msg-400', failingProcessor);

    expect(success).toBe(false);
    const record = dlq.get('msg-400');
    expect(record).not.toBeNull();
    expect(record.attempts).toBe(2);
    expect(record.lastError.message).toBe('Broker still down');
  });

  it('redrives all eligible messages using redriveEligible', async () => {
    dlq.enqueue({ id: 'm1', channel: 'c1', payload: 1 });
    dlq.enqueue({ id: 'm2', channel: 'c2', payload: 2 });

    // Mock canRetry to true for both
    jest.spyOn(dlq, 'canRetry').mockReturnValue(true);

    const processor = jest.fn().mockResolvedValue(true);
    const result = await dlq.redriveEligible(processor);

    expect(result.succeeded).toBe(2);
    expect(result.failed).toBe(0);
    expect(dlq.getStats().size).toBe(0);
  });

  it('enforces max capacity with FIFO eviction for oldest records', () => {
    for (let i = 1; i <= 6; i++) {
      dlq.enqueue({ id: `msg-${i}`, channel: 'events', payload: i });
    }

    expect(dlq.getStats().size).toBe(5);
    expect(dlq.get('msg-1')).toBeNull(); // Evicted
    expect(dlq.get('msg-6')).not.toBeNull();
    expect(dlq.getStats().totalEvicted).toBe(1);
  });

  it('validates input parameters cleanly', () => {
    expect(() => dlq.enqueue({ id: '', channel: 'c' })).toThrow(TypeError);
    expect(() => dlq.enqueue({ id: 'valid', channel: '' })).toThrow(TypeError);
    expect(dlq.canRetry('non-existent')).toBe(false);
  });
});

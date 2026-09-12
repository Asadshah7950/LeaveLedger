'use strict';

const { retryWithBackoff } = require('../../src/common/utils/retry.util');

describe('retryWithBackoff (Unit)', () => {
  it('returns result immediately on first attempt success', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const result = await retryWithBackoff(fn, { maxAttempts: 3 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries until success within attempt limit', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('fail-1'))
      .mockRejectedValueOnce(new Error('fail-2'))
      .mockResolvedValue('success');

    const result = await retryWithBackoff(fn, { maxAttempts: 3, initialDelayMs: 5 });
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws final error when maxAttempts exhausted', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('persistent failure'));
    await expect(retryWithBackoff(fn, { maxAttempts: 2, initialDelayMs: 5 })).rejects.toThrow('persistent failure');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('aborts immediately when shouldRetry returns false', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('unrecoverable'));
    const shouldRetry = (err) => err.message !== 'unrecoverable';

    await expect(retryWithBackoff(fn, { maxAttempts: 5, shouldRetry })).rejects.toThrow('unrecoverable');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

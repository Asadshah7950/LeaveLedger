'use strict';

const { LockManager } = require('../../src/common/utils/lock.util');

describe('LockManager (Unit)', () => {
  let lockManager;

  beforeEach(() => {
    lockManager = new LockManager();
  });

  it('successfully acquires and releases a lock for a key', () => {
    const key = 'balance:EMP1:LOC1:VACATION';
    const lock = lockManager.acquireLock(key, 5000);

    expect(lock.acquired).toBe(true);
    expect(lock.token).toBeDefined();
    expect(lockManager.isLocked(key)).toBe(true);

    const released = lockManager.releaseLock(key, lock.token);
    expect(released).toBe(true);
    expect(lockManager.isLocked(key)).toBe(false);
  });

  it('fails to acquire an already held lock before TTL expires', () => {
    const key = 'request:leave:REQ123';
    const firstLock = lockManager.acquireLock(key, 5000);
    expect(firstLock.acquired).toBe(true);

    const secondLock = lockManager.acquireLock(key, 5000);
    expect(secondLock.acquired).toBe(false);
    expect(secondLock.token).toBeNull();
  });

  it('rejects lock release if an invalid token is provided', () => {
    const key = 'test:lock';
    const lock = lockManager.acquireLock(key, 5000);

    const released = lockManager.releaseLock(key, 'wrong-token');
    expect(released).toBe(false);
    expect(lockManager.isLocked(key)).toBe(true);
  });

  it('allows re-acquiring lock once TTL expires', async () => {
    const key = 'short-lived:lock';
    const firstLock = lockManager.acquireLock(key, 50);
    expect(firstLock.acquired).toBe(true);

    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(lockManager.isLocked(key)).toBe(false);
    const secondLock = lockManager.acquireLock(key, 5000);
    expect(secondLock.acquired).toBe(true);
  });

  it('executes operation under withLock and releases on completion', async () => {
    const key = 'critical:section';
    let executed = false;

    const result = await lockManager.withLock(key, 5000, async () => {
      expect(lockManager.isLocked(key)).toBe(true);
      executed = true;
      return 'operation_result';
    });

    expect(result).toBe('operation_result');
    expect(executed).toBe(true);
    expect(lockManager.isLocked(key)).toBe(false);
  });

  it('releases lock even if fn throws inside withLock', async () => {
    const key = 'throwing:section';

    await expect(
      lockManager.withLock(key, 5000, async () => {
        throw new Error('Failure inside critical section');
      })
    ).rejects.toThrow('Failure inside critical section');

    expect(lockManager.isLocked(key)).toBe(false);
  });

  it('throws RESOURCE_LOCKED when withLock fails to acquire lock', async () => {
    const key = 'already:held';
    lockManager.acquireLock(key, 5000);

    await expect(
      lockManager.withLock(key, 5000, async () => 'should not run')
    ).rejects.toThrow(/is locked by another operation/);
  });
});

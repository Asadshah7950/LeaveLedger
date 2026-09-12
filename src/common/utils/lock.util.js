'use strict';

const { v4: uuidv4 } = require('uuid');

class LockManager {
  constructor() {
    this._locks = new Map();
  }

  acquireLock(resourceKey, ttlMs = 5000) {
    const now = Date.now();
    const existing = this._locks.get(resourceKey);

    if (existing && existing.expiresAt > now) {
      return { acquired: false, token: null, key: resourceKey };
    }

    const token = uuidv4();
    const expiresAt = now + ttlMs;

    this._locks.set(resourceKey, { token, expiresAt });
    return { acquired: true, token, key: resourceKey, expiresAt };
  }

  releaseLock(resourceKey, token) {
    const existing = this._locks.get(resourceKey);
    if (!existing) {
      return false;
    }

    if (existing.token !== token) {
      return false;
    }

    this._locks.delete(resourceKey);
    return true;
  }

  isLocked(resourceKey) {
    const now = Date.now();
    const existing = this._locks.get(resourceKey);
    if (!existing) {
      return false;
    }
    if (existing.expiresAt <= now) {
      this._locks.delete(resourceKey);
      return false;
    }
    return true;
  }

  async withLock(resourceKey, ttlMs, fn) {
    const lock = this.acquireLock(resourceKey, ttlMs);
    if (!lock.acquired) {
      const err = new Error('Resource ' + resourceKey + ' is locked by another operation');
      err.code = 'RESOURCE_LOCKED';
      err.status = 409;
      throw err;
    }

    try {
      return await fn();
    } finally {
      this.releaseLock(resourceKey, lock.token);
    }
  }

  reset() {
    this._locks.clear();
  }
}

const defaultLockManager = new LockManager();

module.exports = {
  LockManager,
  lockManager: defaultLockManager,
};

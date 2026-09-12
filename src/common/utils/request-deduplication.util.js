'use strict';

class RequestDeduplicator {
  constructor(options = {}) {
    this.ttlMs = options.ttlMs || 60000;
    this._cache = new Map();
  }

  async execute(key, taskFn) {
    if (!key) return await taskFn();

    const existing = this._cache.get(key);
    if (existing) {
      if (Date.now() < existing.expiresAt) {
        return existing.promise;
      }
      this._cache.delete(key);
    }

    const promise = Promise.resolve().then(() => taskFn());
    this._cache.set(key, {
      promise,
      expiresAt: Date.now() + this.ttlMs,
    });

    try {
      const result = await promise;
      return result;
    } catch (err) {
      this._cache.delete(key);
      throw err;
    }
  }

  clear() {
    this._cache.clear();
  }
}

module.exports = { RequestDeduplicator };

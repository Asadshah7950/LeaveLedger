'use strict';

const crypto = require('crypto');

/**
 * In-memory Idempotency Key Manager for mutation endpoints (POST/PUT/PATCH).
 * Prevents double-processing of identical client requests (e.g. duplicate leave requests).
 */
class IdempotencyManager {
  constructor(options = {}) {
    this._ttlMs = options.ttlMs || 86400000; // 24 hours
    this._store = new Map(); // key -> { state: 'IN_FLIGHT'|'COMPLETED', fingerprint, response, expiresAt }
  }

  static generateFingerprint(payload) {
    const raw = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  begin(key, payload) {
    if (!key || typeof key !== 'string') throw new TypeError('Idempotency key must be a non-empty string');
    const now = Date.now();
    this._cleanup();

    const existing = this._store.get(key);
    const fingerprint = IdempotencyManager.generateFingerprint(payload);

    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        throw new Error('Idempotency key reused with different request payload');
      }
      if (existing.state === 'IN_FLIGHT') {
        return { status: 'IN_FLIGHT' };
      }
      return { status: 'COMPLETED', response: existing.response };
    }

    this._store.set(key, {
      state: 'IN_FLIGHT',
      fingerprint,
      response: null,
      expiresAt: now + this._ttlMs,
    });
    return { status: 'NEW' };
  }

  complete(key, response) {
    const existing = this._store.get(key);
    if (!existing) return;
    existing.state = 'COMPLETED';
    existing.response = response;
  }

  remove(key) {
    this._store.delete(key);
  }

  _cleanup() {
    const now = Date.now();
    for (const [k, v] of this._store.entries()) {
      if (v.expiresAt <= now) this._store.delete(k);
    }
  }

  get size() {
    return this._store.size;
  }
}

module.exports = { IdempotencyManager };

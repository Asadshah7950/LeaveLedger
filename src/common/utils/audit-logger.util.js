'use strict';

const crypto = require('crypto');

/**
 * Append-only tamper-evident audit ledger for employee balance mutations.
 * Each entry is linked to the previous entry via SHA-256 hash chaining.
 */
class AuditLedger {
  constructor() {
    this._chain = [];
  }

  static hashEntry(entry) {
    const payload = JSON.stringify({
      index: entry.index,
      previousHash: entry.previousHash,
      timestamp: entry.timestamp,
      employeeId: entry.employeeId,
      mutation: entry.mutation,
      reason: entry.reason,
    });
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  append(employeeId, mutation, reason) {
    if (!employeeId || typeof employeeId !== 'string') {
      throw new TypeError('employeeId must be a non-empty string');
    }
    const previousHash = this._chain.length > 0 ? this._chain[this._chain.length - 1].hash : '0'.repeat(64);
    const entry = {
      index: this._chain.length,
      previousHash,
      timestamp: Date.now(),
      employeeId,
      mutation,
      reason: reason || 'UNSPECIFIED',
      hash: null,
    };
    entry.hash = AuditLedger.hashEntry(entry);
    this._chain.push(entry);
    return entry;
  }

  verifyIntegrity() {
    for (let i = 0; i < this._chain.length; i++) {
      const entry = this._chain[i];
      const expectedPrev = i === 0 ? '0'.repeat(64) : this._chain[i - 1].hash;
      if (entry.previousHash !== expectedPrev) return false;
      const expectedHash = AuditLedger.hashEntry(entry);
      if (entry.hash !== expectedHash) return false;
    }
    return true;
  }

  get entries() {
    return [...this._chain];
  }

  get length() {
    return this._chain.length;
  }
}

module.exports = { AuditLedger };

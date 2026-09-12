'use strict';

const crypto = require('crypto');

class AuditHasher {
  static computeRecordHash(record, previousHash = 'GENESIS') {
    const canonical = JSON.stringify({
      id: record.id,
      userId: record.userId,
      action: record.action,
      timestamp: record.timestamp,
      payload: record.payload || {},
      prev: previousHash,
    });
    return crypto.createHash('sha256').update(canonical).digest('hex');
  }

  static verifyChain(records) {
    if (!Array.isArray(records) || records.length === 0) return true;
    let prev = 'GENESIS';
    for (let i = 0; i < records.length; i++) {
      const expected = this.computeRecordHash(records[i], prev);
      if (records[i].hash !== expected) {
        return false;
      }
      prev = records[i].hash;
    }
    return true;
  }
}

module.exports = { AuditHasher };

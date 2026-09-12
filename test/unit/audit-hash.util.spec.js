'use strict';

const { AuditHasher } = require('../../src/common/utils/audit-hash.util');

describe('AuditHasher (Unit)', () => {
  it('computes deterministic SHA-256 hash for audit record', () => {
    const record = { id: 1, userId: 'u1', action: 'LEAVE_REQUESTED', timestamp: '2026-06-01T10:00:00Z' };
    const h1 = AuditHasher.computeRecordHash(record, 'GENESIS');
    const h2 = AuditHasher.computeRecordHash(record, 'GENESIS');
    expect(h1).toHaveLength(64);
    expect(h1).toEqual(h2);
  });

  it('validates unbroken cryptographic chain', () => {
    const rec1 = { id: 1, userId: 'u1', action: 'CREATE', timestamp: '2026-06-01' };
    rec1.hash = AuditHasher.computeRecordHash(rec1, 'GENESIS');
    const rec2 = { id: 2, userId: 'u1', action: 'APPROVE', timestamp: '2026-06-02' };
    rec2.hash = AuditHasher.computeRecordHash(rec2, rec1.hash);

    expect(AuditHasher.verifyChain([rec1, rec2])).toBe(true);
  });

  it('detects tampered record in chain', () => {
    const rec1 = { id: 1, userId: 'u1', action: 'CREATE', timestamp: '2026-06-01' };
    rec1.hash = AuditHasher.computeRecordHash(rec1, 'GENESIS');
    rec1.action = 'TAMPERED';
    expect(AuditHasher.verifyChain([rec1])).toBe(false);
  });
});

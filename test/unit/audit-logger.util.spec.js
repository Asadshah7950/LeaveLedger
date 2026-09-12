'use strict';

const { AuditLedger } = require('../../src/common/utils/audit-logger.util');

describe('AuditLedger (Unit)', () => {
  let ledger;

  beforeEach(() => {
    ledger = new AuditLedger();
  });

  it('initial ledger is empty and valid', () => {
    expect(ledger.length).toBe(0);
    expect(ledger.verifyIntegrity()).toBe(true);
  });

  it('appends entries with valid hash chaining', () => {
    ledger.append('EMP-001', { delta: -2, balanceAfter: 18 }, 'VACATION_TAKEN');
    ledger.append('EMP-001', { delta: 5, balanceAfter: 23 }, 'ACCRUAL');
    expect(ledger.length).toBe(2);
    expect(ledger.verifyIntegrity()).toBe(true);
    expect(ledger.entries[1].previousHash).toBe(ledger.entries[0].hash);
  });

  it('detects tampering with mutation data', () => {
    ledger.append('EMP-001', { delta: -2 }, 'LEAVE');
    ledger.append('EMP-002', { delta: -1 }, 'SICK');
    ledger._chain[0].mutation.delta = -50; // Tamper
    expect(ledger.verifyIntegrity()).toBe(false);
  });

  it('detects tampering with previousHash linkage', () => {
    ledger.append('EMP-001', { delta: -2 }, 'LEAVE');
    ledger.append('EMP-002', { delta: -1 }, 'SICK');
    ledger._chain[1].previousHash = 'bad-hash';
    expect(ledger.verifyIntegrity()).toBe(false);
  });

  it('throws on invalid employeeId', () => {
    expect(() => ledger.append('', { delta: 1 })).toThrow(TypeError);
    expect(() => ledger.append(null, { delta: 1 })).toThrow(TypeError);
  });
});

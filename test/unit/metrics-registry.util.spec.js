'use strict';

const { MetricsRegistry } = require('../../src/common/utils/metrics-registry.util');

describe('MetricsRegistry (Unit)', () => {
  let registry;

  beforeEach(() => {
    registry = new MetricsRegistry({ windowSize: 100 });
  });

  it('initial snapshot has zero metrics', () => {
    const snap = registry.getSnapshot();
    expect(snap.totalRequests).toBe(0);
    expect(snap.errorRate).toBe(0);
    expect(snap.p50).toBe(0);
  });

  it('records requests and computes accurate percentiles', () => {
    for (let i = 1; i <= 100; i++) {
      registry.recordRequest(i);
    }
    const snap = registry.getSnapshot();
    expect(snap.totalRequests).toBe(100);
    expect(snap.p50).toBe(50);
    expect(snap.p95).toBe(95);
    expect(snap.p99).toBe(99);
  });

  it('tracks error counts and calculates error rate accurately', () => {
    registry.recordRequest(10, false);
    registry.recordRequest(20, true);
    registry.recordRequest(30, false);
    registry.recordRequest(40, true);
    const snap = registry.getSnapshot();
    expect(snap.totalRequests).toBe(4);
    expect(snap.totalErrors).toBe(2);
    expect(snap.errorRate).toBe(0.5);
  });

  it('respects window size limitation', () => {
    const small = new MetricsRegistry({ windowSize: 5 });
    for (let i = 1; i <= 10; i++) small.recordRequest(i);
    expect(small.getSnapshot().sampleSize).toBe(5);
  });
});

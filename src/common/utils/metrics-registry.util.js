'use strict';

/**
 * High-performance In-Memory Percentile & Latency Metric Registry.
 * Computes P50, P95, and P99 latency percentiles across sliding request windows.
 */
class MetricsRegistry {
  constructor(options = {}) {
    this._windowSize = options.windowSize || 1000;
    this._latencies = [];
    this._requestCount = 0;
    this._errorCount = 0;
  }

  recordRequest(durationMs, isError = false) {
    this._requestCount++;
    if (isError) this._errorCount++;
    this._latencies.push(durationMs);
    if (this._latencies.length > this._windowSize) {
      this._latencies.shift();
    }
  }

  getPercentile(p) {
    if (this._latencies.length === 0) return 0;
    const sorted = [...this._latencies].sort((a, b) => a - b);
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(sorted.length - 1, index))];
  }

  getSnapshot() {
    return {
      totalRequests: this._requestCount,
      totalErrors: this._errorCount,
      errorRate: this._requestCount > 0 ? Number((this._errorCount / this._requestCount).toFixed(4)) : 0,
      p50: this.getPercentile(50),
      p95: this.getPercentile(95),
      p99: this.getPercentile(99),
      sampleSize: this._latencies.length,
    };
  }

  reset() {
    this._latencies = [];
    this._requestCount = 0;
    this._errorCount = 0;
  }
}

module.exports = { MetricsRegistry };

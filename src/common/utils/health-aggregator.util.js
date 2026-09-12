'use strict';

class HealthAggregator {
  constructor() {
    this._indicators = new Map();
  }

  registerIndicator(name, probeFn) {
    this._indicators.set(name, probeFn);
  }

  async check() {
    const results = {};
    let isDegraded = false;
    let isUnhealthy = false;

    for (const [name, probe] of this._indicators.entries()) {
      try {
        const res = await Promise.resolve(probe());
        results[name] = { status: res.status || 'up', details: res.details || null };
        if (res.status === 'degraded') isDegraded = true;
        if (res.status === 'down') isUnhealthy = true;
      } catch (err) {
        results[name] = { status: 'down', error: err.message };
        isUnhealthy = true;
      }
    }

    const overall = isUnhealthy ? 'unhealthy' : isDegraded ? 'degraded' : 'healthy';
    return {
      status: overall,
      timestamp: new Date().toISOString(),
      indicators: results,
    };
  }
}

module.exports = { HealthAggregator };

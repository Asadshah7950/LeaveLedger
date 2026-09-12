'use strict';

const { HealthAggregator } = require('../../src/common/utils/health-aggregator.util');

describe('HealthAggregator (Unit)', () => {
  it('reports healthy when all probes pass', async () => {
    const aggregator = new HealthAggregator();
    aggregator.registerIndicator('db', () => ({ status: 'up' }));
    aggregator.registerIndicator('redis', () => ({ status: 'up' }));

    const res = await aggregator.check();
    expect(res.status).toBe('healthy');
    expect(res.indicators.db.status).toBe('up');
  });

  it('reports degraded or unhealthy on probe failures', async () => {
    const aggregator = new HealthAggregator();
    aggregator.registerIndicator('db', () => ({ status: 'up' }));
    aggregator.registerIndicator('externalApi', () => ({ status: 'degraded' }));

    const res1 = await aggregator.check();
    expect(res1.status).toBe('degraded');

    aggregator.registerIndicator('cache', () => { throw new Error('Connection refused'); });
    const res2 = await aggregator.check();
    expect(res2.status).toBe('unhealthy');
  });
});

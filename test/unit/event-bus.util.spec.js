'use strict';

const { EventBus } = require('../../src/common/utils/event-bus.util');

describe('EventBus (Unit)', () => {
  let bus;

  beforeEach(() => {
    bus = new EventBus();
  });

  afterEach(() => {
    bus.clear();
  });

  it('delivers published events to all subscribers on a channel', () => {
    const received = [];
    bus.subscribe('REQUEST_APPROVED', (p) => received.push(p));
    bus.subscribe('REQUEST_APPROVED', (p) => received.push({ ...p, second: true }));
    bus.publish('REQUEST_APPROVED', { requestId: 'R1' });
    expect(received).toHaveLength(2);
    expect(received[0].requestId).toBe('R1');
  });

  it('returns the number of listeners notified', () => {
    bus.subscribe('EVT', () => {});
    bus.subscribe('EVT', () => {});
    const count = bus.publish('EVT', {});
    expect(count).toBe(2);
  });

  it('returns 0 when no subscribers exist', () => {
    expect(bus.publish('UNKNOWN', {})).toBe(0);
  });

  it('subscribeOnce fires handler exactly once', () => {
    let calls = 0;
    bus.subscribeOnce('TICK', () => calls++);
    bus.publish('TICK', {});
    bus.publish('TICK', {});
    bus.publish('TICK', {});
    expect(calls).toBe(1);
  });

  it('unsubscribe removes only the specified handler', () => {
    const results = [];
    const handlerA = (p) => results.push(`A:${p}`);
    const handlerB = (p) => results.push(`B:${p}`);
    bus.subscribe('DATA', handlerA);
    bus.subscribe('DATA', handlerB);
    bus.unsubscribe('DATA', handlerA);
    bus.publish('DATA', 'x');
    expect(results).toEqual(['B:x']);
  });

  it('unsubscribe function returned from subscribe works correctly', () => {
    let count = 0;
    const unsub = bus.subscribe('PING', () => count++);
    bus.publish('PING', null);
    expect(count).toBe(1);
    unsub();
    bus.publish('PING', null);
    expect(count).toBe(1);  // No additional calls after unsubscribe
  });

  it('clear(eventName) removes all listeners for that event only', () => {
    let aCount = 0, bCount = 0;
    bus.subscribe('A', () => aCount++);
    bus.subscribe('B', () => bCount++);
    bus.clear('A');
    bus.publish('A', {});
    bus.publish('B', {});
    expect(aCount).toBe(0);
    expect(bCount).toBe(1);
  });

  it('clear() with no arg removes all listeners', () => {
    let count = 0;
    bus.subscribe('X', () => count++);
    bus.subscribe('Y', () => count++);
    bus.clear();
    bus.publish('X', {});
    bus.publish('Y', {});
    expect(count).toBe(0);
  });

  it('listenerCount returns accurate subscriber count', () => {
    bus.subscribe('EV', () => {});
    bus.subscribe('EV', () => {});
    expect(bus.listenerCount('EV')).toBe(2);
  });

  it('throws TypeError when handler is not a function', () => {
    expect(() => bus.subscribe('EVT', 'not-a-function')).toThrow(TypeError);
    expect(() => bus.subscribeOnce('EVT', 42)).toThrow(TypeError);
  });
});

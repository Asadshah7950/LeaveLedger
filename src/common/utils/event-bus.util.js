'use strict';

/**
 * Lightweight In-Process Event Bus — a synchronous publish/subscribe
 * channel for decoupling domain events inside a single microservice.
 *
 * Supports:
 *  - Typed event channels with multiple concurrent listeners
 *  - One-shot listeners (subscribeOnce)
 *  - Ordered listener removal by handler reference
 *  - Event history replay for late subscribers (optional ring buffer)
 *
 * This is intentionally NOT a replacement for an external message broker
 * (Kafka / RabbitMQ); it operates within a single Node.js process and is
 * most useful for intra-service domain event fanout (e.g. REQUEST_APPROVED).
 */
class EventBus {
  constructor(options = {}) {
    /** @type {Map<string, Set<Function>>} */
    this._listeners = new Map();
    /** @type {Map<string, WeakSet<Function>>} */
    this._onceListeners = new WeakMap();
    /** @type {Map<string, Array>} */
    this._history = new Map();
    this._historyMaxSize = options.historyMaxSize || 0;  // 0 = disabled
  }

  /**
   * Subscribe to an event channel.
   * @param {string} eventName
   * @param {Function} handler
   * @returns {Function} Unsubscribe function
   */
  subscribe(eventName, handler) {
    if (typeof handler !== 'function') {
      throw new TypeError('Event handler must be a function');
    }
    if (!this._listeners.has(eventName)) {
      this._listeners.set(eventName, new Set());
    }
    this._listeners.get(eventName).add(handler);

    // Replay buffered history to the new subscriber
    if (this._historyMaxSize > 0 && this._history.has(eventName)) {
      const past = this._history.get(eventName);
      setImmediate(() => past.forEach((payload) => handler(payload)));
    }

    return () => this.unsubscribe(eventName, handler);
  }

  /**
   * Subscribe to an event channel for exactly one invocation.
   * @param {string} eventName
   * @param {Function} handler
   */
  subscribeOnce(eventName, handler) {
    if (typeof handler !== 'function') {
      throw new TypeError('Event handler must be a function');
    }
    const wrapper = (payload) => {
      this.unsubscribe(eventName, wrapper);
      handler(payload);
    };
    // Track the original handler so callers can unsubscribe by original reference
    if (!this._onceListeners.has(handler)) {
      this._onceListeners.set(handler, wrapper);
    }
    this.subscribe(eventName, wrapper);
  }

  /**
   * Remove a specific handler from an event channel.
   * @param {string} eventName
   * @param {Function} handler
   */
  unsubscribe(eventName, handler) {
    const listeners = this._listeners.get(eventName);
    if (!listeners) return;
    // Handle both direct reference and once-wrapper lookup
    const wrapper = this._onceListeners.has(handler) ? this._onceListeners.get(handler) : handler;
    listeners.delete(wrapper);
    if (listeners.size === 0) this._listeners.delete(eventName);
  }

  /**
   * Publish an event to all subscribers on the given channel.
   * Handlers are called synchronously in insertion order.
   *
   * @param {string} eventName
   * @param {*} payload
   * @returns {number} Number of listeners notified
   */
  publish(eventName, payload) {
    // Maintain history ring buffer if enabled
    if (this._historyMaxSize > 0) {
      if (!this._history.has(eventName)) this._history.set(eventName, []);
      const buf = this._history.get(eventName);
      buf.push(payload);
      if (buf.length > this._historyMaxSize) buf.shift();
    }

    const listeners = this._listeners.get(eventName);
    if (!listeners || listeners.size === 0) return 0;

    let notified = 0;
    for (const handler of listeners) {
      handler(payload);
      notified++;
    }
    return notified;
  }

  /**
   * Remove all listeners for a given event, or all events if no name provided.
   * @param {string} [eventName]
   */
  clear(eventName) {
    if (eventName) {
      this._listeners.delete(eventName);
      this._history.delete(eventName);
    } else {
      this._listeners.clear();
      this._history.clear();
    }
  }

  /**
   * Return the count of active listeners for a given event.
   * @param {string} eventName
   * @returns {number}
   */
  listenerCount(eventName) {
    return this._listeners.get(eventName)?.size || 0;
  }
}

module.exports = { EventBus };

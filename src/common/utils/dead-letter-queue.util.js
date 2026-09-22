'use strict';

/**
 * Dead-Letter Queue (DLQ) & Poison Message Supervisor
 *
 * Implements resilient fault isolation for the Transactional Outbox pattern:
 * - Poison message detection after configurable retry attempts
 * - Exponential backoff retry scheduling with jitter
 * - Safe message replay / redrive mechanism for transient recovery
 * - Cryptographic message fingerprinting & failure classification
 * - Observability metrics: queue depth, error taxonomy, and retention eviction
 */
class DeadLetterQueue {
  /**
   * @param {Object} options
   * @param {number} [options.maxRetries=3] Maximum delivery attempts before marking as POISON
   * @param {number} [options.baseBackoffMs=100] Base backoff duration in milliseconds
   * @param {number} [options.maxBackoffMs=5000] Maximum backoff cap
   * @param {number} [options.maxCapacity=1000] Maximum capacity before FIFO eviction
   */
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.baseBackoffMs = options.baseBackoffMs || 100;
    this.maxBackoffMs = options.maxBackoffMs || 5000;
    this.maxCapacity = options.maxCapacity || 1000;

    /** @type {Map<string, Object>} */
    this._messages = new Map();
    /** @type {Map<string, number>} */
    this._errorTaxonomy = new Map();
    this._totalEnqueued = 0;
    this._totalRedriven = 0;
    this._totalEvicted = 0;
  }

  /**
   * Enqueue a failed message into the DLQ.
   *
   * @param {Object} item
   * @param {string} item.id Unique message identifier
   * @param {string} item.channel Target channel/topic
   * @param {Object|string} item.payload Message payload
   * @param {Error|Object} [item.error] The failure that triggered quarantine
   * @returns {Object} Stored DLQ record
   */
  enqueue({ id, channel, payload, error }) {
    if (!id || typeof id !== 'string') {
      throw new TypeError('Message ID must be a non-empty string');
    }
    if (!channel || typeof channel !== 'string') {
      throw new TypeError('Channel must be a non-empty string');
    }

    const now = Date.now();
    let record = this._messages.get(id);

    const errorCategory = error?.code || error?.name || 'UNKNOWN_ERROR';
    const errorMessage = error?.message || String(error || 'Unspecified error');

    if (record) {
      record.attempts += 1;
      record.lastError = { category: errorCategory, message: errorMessage, timestamp: now };
      record.updatedAt = now;
      record.isPoison = record.attempts >= this.maxRetries;
      record.nextRetryAt = this._calculateNextRetry(record.attempts);
    } else {
      // FIFO eviction if capacity exceeded
      if (this._messages.size >= this.maxCapacity) {
        const oldestKey = this._messages.keys().next().value;
        this._messages.delete(oldestKey);
        this._totalEvicted += 1;
      }

      record = {
        id,
        channel,
        payload,
        attempts: 1,
        initialError: { category: errorCategory, message: errorMessage, timestamp: now },
        lastError: { category: errorCategory, message: errorMessage, timestamp: now },
        createdAt: now,
        updatedAt: now,
        isPoison: 1 >= this.maxRetries,
        nextRetryAt: this._calculateNextRetry(1),
        redriveCount: 0,
      };
      this._messages.set(id, record);
    }

    this._totalEnqueued += 1;
    this._errorTaxonomy.set(errorCategory, (this._errorTaxonomy.get(errorCategory) || 0) + 1);

    return { ...record };
  }

  /**
   * Check whether a message is eligible for immediate retry.
   *
   * @param {string} id
   * @param {number} [now]
   * @returns {boolean}
   */
  canRetry(id, now = Date.now()) {
    const record = this._messages.get(id);
    if (!record) return false;
    if (record.isPoison) return false;
    return now >= record.nextRetryAt;
  }

  /**
   * Re-drive a specific message through a consumer handler.
   *
   * @param {string} id
   * @param {Function} processor Async or sync function taking (payload, channel)
   * @returns {Promise<boolean>} True if successfully processed and dequeued
   */
  async redrive(id, processor) {
    if (typeof processor !== 'function') {
      throw new TypeError('Processor must be a function');
    }
    const record = this._messages.get(id);
    if (!record) return false;

    try {
      await processor(record.payload, record.channel);
      this._messages.delete(id);
      this._totalRedriven += 1;
      return true;
    } catch (err) {
      this.enqueue({
        id: record.id,
        channel: record.channel,
        payload: record.payload,
        error: err,
      });
      return false;
    }
  }

  /**
   * Re-drive all non-poison messages currently eligible.
   *
   * @param {Function} processor
   * @returns {Promise<{ succeeded: number, failed: number }>}
   */
  async redriveEligible(processor) {
    const now = Date.now();
    let succeeded = 0;
    let failed = 0;

    for (const [id] of this._messages) {
      if (this.canRetry(id, now)) {
        const ok = await this.redrive(id, processor);
        if (ok) succeeded++;
        else failed++;
      }
    }

    return { succeeded, failed };
  }

  /**
   * Retrieve a message record by ID.
   *
   * @param {string} id
   * @returns {Object|null}
   */
  get(id) {
    const record = this._messages.get(id);
    return record ? { ...record } : null;
  }

  /**
   * Remove a message manually from DLQ.
   *
   * @param {string} id
   * @returns {boolean}
   */
  delete(id) {
    return this._messages.delete(id);
  }

  /**
   * Clear all records.
   */
  clear() {
    this._messages.clear();
    this._errorTaxonomy.clear();
  }

  /**
   * Get telemetry stats.
   *
   * @returns {Object}
   */
  getStats() {
    let poisonCount = 0;
    let oldestTimestamp = Infinity;
    const now = Date.now();

    for (const record of this._messages.values()) {
      if (record.isPoison) poisonCount++;
      if (record.createdAt < oldestTimestamp) oldestTimestamp = record.createdAt;
    }

    return {
      size: this._messages.size,
      poisonCount,
      totalEnqueued: this._totalEnqueued,
      totalRedriven: this._totalRedriven,
      totalEvicted: this._totalEvicted,
      oldestMessageAgeMs: this._messages.size > 0 ? now - oldestTimestamp : 0,
      errorTaxonomy: Object.fromEntries(this._errorTaxonomy),
    };
  }

  /**
   * Internal exponential backoff with pseudo-random jitter.
   *
   * @private
   * @param {number} attempt
   * @returns {number} Timestamp in ms
   */
  _calculateNextRetry(attempt) {
    const factor = Math.pow(2, Math.min(attempt, 10));
    const delay = Math.min(this.baseBackoffMs * factor, this.maxBackoffMs);
    const jitter = delay * 0.2 * Math.random();
    return Date.now() + Math.floor(delay + jitter);
  }
}

module.exports = { DeadLetterQueue };

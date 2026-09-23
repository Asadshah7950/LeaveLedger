'use strict';

/**
 * @fileoverview Min-heap priority queue for scheduled outbox message delivery.
 *
 * Provides O(log n) insert and O(log n) extract-min operations. Used by the
 * transactional outbox supervisor to order pending messages by their
 * `scheduledAt` timestamp, ensuring earliest-due messages are dispatched first
 * even under concurrent enqueue pressure.
 *
 * @module priority-queue.util
 */

/**
 * @typedef {Object} PriorityQueueEntry
 * @property {number} priority   - Numeric priority (lower = higher urgency; typically epoch ms).
 * @property {*}      value      - The payload stored at this position.
 * @property {number} insertSeq  - Monotonically-increasing counter for FIFO tie-breaking.
 */

/**
 * Binary min-heap priority queue with FIFO tie-breaking.
 *
 * @template T
 */
class PriorityQueue {
  /**
   * @param {object}   [options]
   * @param {number}   [options.maxSize=Infinity]  Maximum number of entries. Oldest
   *                                               low-priority item is evicted on overflow.
   * @param {function} [options.comparator]        Optional custom comparator(a, b) → number.
   *                                               Defaults to numeric ascending (min-heap).
   */
  constructor(options = {}) {
    const { maxSize = Infinity, comparator } = options;

    /** @type {PriorityQueueEntry[]} */
    this._heap = [];

    /** @type {number} */
    this._maxSize = maxSize;

    /** @type {number} */
    this._seq = 0;

    /** @type {function(PriorityQueueEntry, PriorityQueueEntry): number} */
    this._comparator = comparator
      ? (a, b) => comparator(a.value, b.value)
      : (a, b) => a.priority - b.priority || a.insertSeq - b.insertSeq;
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Number of entries currently in the queue.
   * @type {number}
   */
  get size() {
    return this._heap.length;
  }

  /**
   * Whether the queue is empty.
   * @type {boolean}
   */
  get isEmpty() {
    return this._heap.length === 0;
  }

  /**
   * Enqueue a value with the given numeric priority.
   *
   * If the queue is at capacity the entry with the highest priority value
   * (i.e. the least urgent item) is evicted to make room.  If the new entry
   * is itself the least urgent it is dropped immediately.
   *
   * @param {T}      value    - Payload to store.
   * @param {number} priority - Numeric priority (lower = more urgent).
   * @returns {{ evicted: PriorityQueueEntry|null }}
   */
  enqueue(value, priority) {
    const entry = { priority, value, insertSeq: this._seq++ };
    let evicted = null;

    if (this._heap.length >= this._maxSize) {
      const worstIdx = this._findMaxIndex();
      const worst = this._heap[worstIdx];

      if (this._comparator(entry, worst) >= 0) {
        // New entry is no better than the worst — drop it.
        return { evicted: null };
      }

      // Remove the worst to make room.
      evicted = worst;
      this._heap.splice(worstIdx, 1);
      this._buildHeap();
    }

    this._heap.push(entry);
    this._siftUp(this._heap.length - 1);
    return { evicted };
  }

  /**
   * Remove and return the highest-priority (lowest numeric value) entry.
   *
   * @returns {T|undefined} The value, or `undefined` if the queue is empty.
   */
  dequeue() {
    if (this._heap.length === 0) return undefined;
    if (this._heap.length === 1) return this._heap.pop().value;

    const min = this._heap[0];
    this._heap[0] = this._heap.pop();
    this._siftDown(0);
    return min.value;
  }

  /**
   * Peek at the highest-priority value without removing it.
   *
   * @returns {T|undefined}
   */
  peek() {
    return this._heap.length > 0 ? this._heap[0].value : undefined;
  }

  /**
   * Peek at the priority of the front entry.
   *
   * @returns {number|undefined}
   */
  peekPriority() {
    return this._heap.length > 0 ? this._heap[0].priority : undefined;
  }

  /**
   * Drain all entries in priority order.
   *
   * @returns {T[]}
   */
  drain() {
    const result = [];
    while (!this.isEmpty) {
      result.push(this.dequeue());
    }
    return result;
  }

  /**
   * Remove all entries matching the predicate.
   *
   * This is O(n log n) — it rebuilds the heap after removal.
   *
   * @param {function(T): boolean} predicate
   * @returns {number} Number of entries removed.
   */
  removeWhere(predicate) {
    const before = this._heap.length;
    this._heap = this._heap.filter(e => !predicate(e.value));
    this._buildHeap();
    return before - this._heap.length;
  }

  /**
   * Return observable metrics for monitoring.
   *
   * @returns {{ size: number, maxSize: number, headPriority: number|null }}
   */
  metrics() {
    return {
      size: this._heap.length,
      maxSize: this._maxSize,
      headPriority: this._heap.length > 0 ? this._heap[0].priority : null,
    };
  }

  // ---------------------------------------------------------------------------
  // Internal heap operations
  // ---------------------------------------------------------------------------

  /** @param {number} idx */
  _siftUp(idx) {
    while (idx > 0) {
      const parent = (idx - 1) >> 1;
      if (this._comparator(this._heap[idx], this._heap[parent]) < 0) {
        [this._heap[idx], this._heap[parent]] = [this._heap[parent], this._heap[idx]];
        idx = parent;
      } else {
        break;
      }
    }
  }

  /** @param {number} idx */
  _siftDown(idx) {
    const n = this._heap.length;
    while (true) {
      let smallest = idx;
      const left = 2 * idx + 1;
      const right = 2 * idx + 2;

      if (left < n && this._comparator(this._heap[left], this._heap[smallest]) < 0) {
        smallest = left;
      }
      if (right < n && this._comparator(this._heap[right], this._heap[smallest]) < 0) {
        smallest = right;
      }
      if (smallest === idx) break;

      [this._heap[idx], this._heap[smallest]] = [this._heap[smallest], this._heap[idx]];
      idx = smallest;
    }
  }

  /** Rebuild heap invariant from scratch — O(n). */
  _buildHeap() {
    for (let i = (this._heap.length >> 1) - 1; i >= 0; i--) {
      this._siftDown(i);
    }
  }

  /**
   * Find the index of the entry with the highest priority value (least urgent).
   * Only leaf nodes can be the max in a min-heap.
   *
   * @returns {number}
   */
  _findMaxIndex() {
    const start = this._heap.length >> 1;
    let maxIdx = start;
    for (let i = start + 1; i < this._heap.length; i++) {
      if (this._comparator(this._heap[i], this._heap[maxIdx]) > 0) {
        maxIdx = i;
      }
    }
    return maxIdx;
  }
}

module.exports = { PriorityQueue };

'use strict';

const { PriorityQueue } = require('../../src/common/utils/priority-queue.util');

describe('PriorityQueue', () => {
  // ---------------------------------------------------------------------------
  // Basic min-heap operations
  // ---------------------------------------------------------------------------

  describe('enqueue / dequeue', () => {
    it('dequeues in ascending priority order', () => {
      const pq = new PriorityQueue();
      pq.enqueue('c', 30);
      pq.enqueue('a', 10);
      pq.enqueue('b', 20);

      expect(pq.dequeue()).toBe('a');
      expect(pq.dequeue()).toBe('b');
      expect(pq.dequeue()).toBe('c');
    });

    it('returns undefined when dequeuing from an empty queue', () => {
      const pq = new PriorityQueue();
      expect(pq.dequeue()).toBeUndefined();
    });

    it('handles single-element queue', () => {
      const pq = new PriorityQueue();
      pq.enqueue('only', 5);
      expect(pq.dequeue()).toBe('only');
      expect(pq.isEmpty).toBe(true);
    });

    it('maintains FIFO order for equal priorities', () => {
      const pq = new PriorityQueue();
      pq.enqueue('first', 10);
      pq.enqueue('second', 10);
      pq.enqueue('third', 10);

      expect(pq.dequeue()).toBe('first');
      expect(pq.dequeue()).toBe('second');
      expect(pq.dequeue()).toBe('third');
    });
  });

  // ---------------------------------------------------------------------------
  // Peek
  // ---------------------------------------------------------------------------

  describe('peek / peekPriority', () => {
    it('returns front value without removing it', () => {
      const pq = new PriorityQueue();
      pq.enqueue('msg', 5);
      expect(pq.peek()).toBe('msg');
      expect(pq.size).toBe(1);
    });

    it('returns undefined peek on empty queue', () => {
      expect(new PriorityQueue().peek()).toBeUndefined();
    });

    it('peekPriority returns the lowest priority number', () => {
      const pq = new PriorityQueue();
      pq.enqueue('a', 100);
      pq.enqueue('b', 1);
      expect(pq.peekPriority()).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Capacity / eviction
  // ---------------------------------------------------------------------------

  describe('maxSize eviction', () => {
    it('evicts the least-urgent entry when at capacity', () => {
      const pq = new PriorityQueue({ maxSize: 2 });
      pq.enqueue('low', 100);
      pq.enqueue('high', 1);
      const { evicted } = pq.enqueue('medium', 50);

      // 'low' (priority 100) should be evicted
      expect(evicted).not.toBeNull();
      expect(evicted.value).toBe('low');
      expect(pq.size).toBe(2);
    });

    it('drops incoming entry if it is the least urgent', () => {
      const pq = new PriorityQueue({ maxSize: 2 });
      pq.enqueue('a', 10);
      pq.enqueue('b', 20);
      const { evicted } = pq.enqueue('c', 99); // worse than both

      expect(evicted).toBeNull();
      expect(pq.size).toBe(2);
    });
  });

  // ---------------------------------------------------------------------------
  // drain / removeWhere
  // ---------------------------------------------------------------------------

  describe('drain', () => {
    it('returns all values in priority order and empties the queue', () => {
      const pq = new PriorityQueue();
      pq.enqueue('z', 3);
      pq.enqueue('a', 1);
      pq.enqueue('m', 2);

      expect(pq.drain()).toEqual(['a', 'm', 'z']);
      expect(pq.isEmpty).toBe(true);
    });
  });

  describe('removeWhere', () => {
    it('removes all entries matching the predicate', () => {
      const pq = new PriorityQueue();
      pq.enqueue({ id: 1, retry: true }, 10);
      pq.enqueue({ id: 2, retry: false }, 20);
      pq.enqueue({ id: 3, retry: true }, 30);

      const removed = pq.removeWhere(v => v.retry === true);
      expect(removed).toBe(2);
      expect(pq.size).toBe(1);
      expect(pq.peek()).toEqual({ id: 2, retry: false });
    });
  });

  // ---------------------------------------------------------------------------
  // Custom comparator
  // ---------------------------------------------------------------------------

  describe('custom comparator', () => {
    it('supports max-heap via reversed comparator', () => {
      const pq = new PriorityQueue({
        comparator: (a, b) => b.score - a.score,
      });
      pq.enqueue({ score: 5 }, 0);
      pq.enqueue({ score: 1 }, 0);
      pq.enqueue({ score: 9 }, 0);

      expect(pq.dequeue().score).toBe(9);
      expect(pq.dequeue().score).toBe(5);
      expect(pq.dequeue().score).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // metrics
  // ---------------------------------------------------------------------------

  describe('metrics', () => {
    it('reports correct size and headPriority', () => {
      const pq = new PriorityQueue({ maxSize: 10 });
      pq.enqueue('a', 5);
      pq.enqueue('b', 2);

      const m = pq.metrics();
      expect(m.size).toBe(2);
      expect(m.maxSize).toBe(10);
      expect(m.headPriority).toBe(2);
    });

    it('reports null headPriority on empty queue', () => {
      expect(new PriorityQueue().metrics().headPriority).toBeNull();
    });
  });
});

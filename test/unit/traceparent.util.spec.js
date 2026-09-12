'use strict';

const {
  parseTraceparent,
  generateTraceparent,
  continueTrace,
  extractSpanContext,
} = require('../../src/common/utils/traceparent.util');

describe('W3C Traceparent Utility (Unit)', () => {
  const VALID_TRACEPARENT = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01';

  // ── parseTraceparent ──────────────────────────────────────────
  describe('parseTraceparent', () => {
    it('parses a valid sampled traceparent', () => {
      const result = parseTraceparent(VALID_TRACEPARENT);
      expect(result).not.toBeNull();
      expect(result.version).toBe('00');
      expect(result.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
      expect(result.parentId).toBe('00f067aa0ba902b7');
      expect(result.sampled).toBe(true);
    });

    it('parses an unsampled traceparent (flags=00)', () => {
      const unsampled = '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-00';
      const result = parseTraceparent(unsampled);
      expect(result.sampled).toBe(false);
    });

    it('returns null for missing or empty header', () => {
      expect(parseTraceparent(undefined)).toBeNull();
      expect(parseTraceparent('')).toBeNull();
      expect(parseTraceparent(null)).toBeNull();
    });

    it('returns null for malformed header (wrong segment count)', () => {
      expect(parseTraceparent('00-traceonly')).toBeNull();
      expect(parseTraceparent('not-a-traceparent')).toBeNull();
    });

    it('returns null for all-zeros trace-id (spec violation)', () => {
      const allZero = `00-${'0'.repeat(32)}-00f067aa0ba902b7-01`;
      expect(parseTraceparent(allZero)).toBeNull();
    });

    it('returns null for all-zeros parent-id (spec violation)', () => {
      const allZeroParent = `00-4bf92f3577b34da6a3ce929d0e0e4736-${'0'.repeat(16)}-01`;
      expect(parseTraceparent(allZeroParent)).toBeNull();
    });

    it('returns null for version ff (reserved / invalid)', () => {
      const ffVersion = `ff-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01`;
      expect(parseTraceparent(ffVersion)).toBeNull();
    });
  });

  // ── generateTraceparent ───────────────────────────────────────
  describe('generateTraceparent', () => {
    it('generates a valid traceparent matching the W3C format', () => {
      const header = generateTraceparent();
      expect(typeof header).toBe('string');
      const parts = header.split('-');
      expect(parts).toHaveLength(4);
      expect(parts[0]).toBe('00');
      expect(parts[1]).toHaveLength(32);
      expect(parts[2]).toHaveLength(16);
      expect(['01', '00']).toContain(parts[3]);
    });

    it('generates unique trace-ids on every call', () => {
      const ids = new Set(Array.from({ length: 50 }, () => generateTraceparent().split('-')[1]));
      expect(ids.size).toBe(50);
    });

    it('respects the sampled=false flag', () => {
      const header = generateTraceparent(false);
      expect(header.endsWith('-00')).toBe(true);
    });
  });

  // ── continueTrace ────────────────────────────────────────────
  describe('continueTrace', () => {
    it('preserves original trace-id and generates a new parent-id', () => {
      const child = continueTrace(VALID_TRACEPARENT);
      const parsed = parseTraceparent(child);
      expect(parsed).not.toBeNull();
      expect(parsed.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
      expect(parsed.parentId).not.toBe('00f067aa0ba902b7');
    });

    it('falls back to new root trace when incoming traceparent is malformed', () => {
      const fallback = continueTrace('bad-header');
      const parsed = parseTraceparent(fallback);
      expect(parsed).not.toBeNull();
    });
  });

  // ── extractSpanContext ────────────────────────────────────────
  describe('extractSpanContext', () => {
    it('extracts span context from a valid traceparent', () => {
      const ctx = extractSpanContext(VALID_TRACEPARENT);
      expect(ctx.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
      expect(ctx.spanId).toBe('00f067aa0ba902b7');
      expect(ctx.sampled).toBe(true);
      expect(ctx.fresh).toBe(false);
    });

    it('generates fresh span context when header is absent', () => {
      const ctx = extractSpanContext(undefined);
      expect(ctx.fresh).toBe(true);
      expect(ctx.traceId).toHaveLength(32);
      expect(ctx.spanId).toHaveLength(16);
    });
  });
});

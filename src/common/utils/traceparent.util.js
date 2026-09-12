'use strict';

const crypto = require('crypto');

/**
 * W3C Trace Context Level 1 — traceparent header utility.
 *
 * Format: {version}-{trace-id}-{parent-id}-{flags}
 *  - version  : "00" (single byte, fixed)
 *  - trace-id : 32 hex chars (16 bytes), globally unique per logical request
 *  - parent-id: 16 hex chars (8 bytes), identifies the outgoing span
 *  - flags    : "01" = sampled, "00" = not sampled
 *
 * Spec: https://www.w3.org/TR/trace-context/
 */

const VERSION = '00';
const SAMPLED_FLAG = '01';
const NOT_SAMPLED_FLAG = '00';

/**
 * Parse an incoming traceparent header.
 * Returns null when the header is absent, malformed, or uses an unsupported version.
 *
 * @param {string|undefined} headerValue
 * @returns {{ version: string, traceId: string, parentId: string, sampled: boolean } | null}
 */
function parseTraceparent(headerValue) {
  if (!headerValue || typeof headerValue !== 'string') return null;

  const parts = headerValue.trim().split('-');
  if (parts.length !== 4) return null;

  const [version, traceId, parentId, flags] = parts;

  // Reject future versions > 0xff or invalid lengths
  if (!/^[0-9a-f]{2}$/.test(version)) return null;
  if (version === 'ff') return null;
  if (!/^[0-9a-f]{32}$/.test(traceId)) return null;
  if (traceId === '0'.repeat(32)) return null;  // all-zeros trace-id is invalid
  if (!/^[0-9a-f]{16}$/.test(parentId)) return null;
  if (parentId === '0'.repeat(16)) return null;  // all-zeros parent-id is invalid
  if (!/^[0-9a-f]{2}$/.test(flags)) return null;

  return {
    version,
    traceId,
    parentId,
    sampled: (parseInt(flags, 16) & 1) === 1,
  };
}

/**
 * Generate a fresh traceparent header string for a new root trace.
 *
 * @param {boolean} [sampled=true]
 * @returns {string} e.g. "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
 */
function generateTraceparent(sampled = true) {
  const traceId = crypto.randomBytes(16).toString('hex');
  const parentId = crypto.randomBytes(8).toString('hex');
  const flags = sampled ? SAMPLED_FLAG : NOT_SAMPLED_FLAG;
  return `${VERSION}-${traceId}-${parentId}-${flags}`;
}

/**
 * Create a child span traceparent: reuse the trace-id from the parent,
 * but assign a fresh parent-id (span-id) for the outgoing hop.
 *
 * @param {string} incomingTraceparent - Raw W3C header from the upstream caller
 * @param {boolean} [sampled=true]     - Override sampled flag for downstream
 * @returns {string} New traceparent header to forward downstream
 */
function continueTrace(incomingTraceparent, sampled) {
  const parsed = parseTraceparent(incomingTraceparent);
  if (!parsed) {
    // Broken or absent — start a new root trace
    return generateTraceparent(sampled !== undefined ? sampled : true);
  }
  const flags = (sampled !== undefined ? sampled : parsed.sampled) ? SAMPLED_FLAG : NOT_SAMPLED_FLAG;
  const newParentId = crypto.randomBytes(8).toString('hex');
  return `${VERSION}-${parsed.traceId}-${newParentId}-${flags}`;
}

/**
 * Extract structured span metadata from a traceparent (for logging / telemetry).
 *
 * @param {string|undefined} headerValue
 * @returns {{ traceId: string, spanId: string, sampled: boolean, fresh: boolean }}
 */
function extractSpanContext(headerValue) {
  const parsed = parseTraceparent(headerValue);
  if (!parsed) {
    const fresh = generateTraceparent();
    const freshParsed = parseTraceparent(fresh);
    return {
      traceId: freshParsed.traceId,
      spanId: freshParsed.parentId,
      sampled: true,
      fresh: true,
    };
  }
  return {
    traceId: parsed.traceId,
    spanId: parsed.parentId,
    sampled: parsed.sampled,
    fresh: false,
  };
}

module.exports = { parseTraceparent, generateTraceparent, continueTrace, extractSpanContext };

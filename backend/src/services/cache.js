/**
 * Tiny in-memory interpretation cache keyed by SHA-256 of the dream text.
 *
 * Purpose: avoid redundant Claude API calls for identical dream submissions.
 * Max 1 000 entries; LRU-style eviction when full.
 * TTL: 24 hours.
 *
 * For production at scale, replace with Redis.
 */

import { createHash } from 'crypto';

const MAX_ENTRIES = 1_000;
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1_000; // 24 h

/** @type {Map<string, { value: object, expiresAt: number }>} */
const store = new Map();

/**
 * Derive a deterministic cache key from dream text.
 * Normalises whitespace + case so minor variations share the same slot.
 */
export function cacheKey(dreamText) {
  const normalised = dreamText.trim().toLowerCase().replace(/\s+/g, ' ');
  return createHash('sha256').update(normalised).digest('hex');
}

/** @returns {object|null} cached interpretation or null on miss/expiry */
export function getFromCache(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

/** Store an interpretation result. Evicts oldest entries when full. */
export function setInCache(key, value, ttlMs = DEFAULT_TTL_MS) {
  if (store.size >= MAX_ENTRIES) {
    // Evict the oldest 10 % to amortise the cost of this operation
    const evictCount = Math.ceil(MAX_ENTRIES * 0.1);
    let i = 0;
    for (const k of store.keys()) {
      if (i++ >= evictCount) break;
      store.delete(k);
    }
  }
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

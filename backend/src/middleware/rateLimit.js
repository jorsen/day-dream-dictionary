/**
 * Lightweight in-memory rate limiter per IP address.
 * Uses a sliding window backed by a timestamp array.
 *
 * For multi-instance deployments, replace with Redis-based sliding window.
 *
 * @param {{ windowMs?: number, max?: number }} options
 */
export function rateLimit({ windowMs = 60_000, max = 5 } = {}) {
  /** @type {Map<string, number[]>} */
  const store = new Map();

  // Prune stale entries every 5 minutes to prevent unbounded growth
  const pruneInterval = setInterval(() => {
    const cutoff = Date.now() - windowMs;
    for (const [key, timestamps] of store.entries()) {
      const fresh = timestamps.filter((t) => t > cutoff);
      if (fresh.length === 0) store.delete(key);
      else store.set(key, fresh);
    }
  }, 5 * 60_000);

  // Don't keep the process alive just for cleanup
  if (pruneInterval.unref) pruneInterval.unref();

  return (req, res, next) => {
    // Prefer X-Forwarded-For when behind a proxy; fall back to socket IP
    const ip =
      (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
      req.socket?.remoteAddress ||
      'unknown';

    const now = Date.now();
    const cutoff = now - windowMs;

    const timestamps = (store.get(ip) || []).filter((t) => t > cutoff);

    if (timestamps.length >= max) {
      const retryAfter = Math.ceil((timestamps[0] + windowMs - now) / 1000);
      res.setHeader('Retry-After', retryAfter);
      return res.status(429).json({
        error: 'Too many requests — please try again later',
        retryAfterSeconds: retryAfter,
      });
    }

    timestamps.push(now);
    store.set(ip, timestamps);
    next();
  };
}

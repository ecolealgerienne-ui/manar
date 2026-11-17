import { HttpError } from './util.js';

/** Fixed-window in-memory limiter keyed by IP (use Redis when running several instances). */
export function rateLimit({ windowMs, max, key = (req) => req.ip, name = 'rate' }) {
  const hits = new Map();
  const timer = setInterval(() => {
    const t = Date.now();
    for (const [k, v] of hits) if (v.reset <= t) hits.delete(k);
  }, windowMs);
  timer.unref();
  return (req, res, next) => {
    const k = key(req), t = Date.now();
    let h = hits.get(k);
    if (!h || h.reset <= t) { h = { n: 0, reset: t + windowMs }; hits.set(k, h); }
    h.n += 1;
    res.setHeader('RateLimit-Limit', max);
    res.setHeader('RateLimit-Remaining', Math.max(0, max - h.n));
    if (h.n > max) {
      res.setHeader('Retry-After', Math.ceil((h.reset - t) / 1000));
      return next(new HttpError(429, 'RATE_LIMITED', 'Too many requests, slow down'));
    }
    next();
  };
}

/** Per-account lock-out against password brute force (independent from the IP limiter). */
export class LoginGuard {
  constructor({ maxFails = 5, lockMs = 15 * 60 * 1000 } = {}) { this.maxFails = maxFails; this.lockMs = lockMs; this.map = new Map(); }
  check(id) {
    const e = this.map.get(id);
    if (e && e.until > Date.now()) throw new HttpError(429, 'ACCOUNT_LOCKED', 'Too many failed attempts, try again later');
  }
  fail(id) {
    const e = this.map.get(id) || { n: 0, until: 0 };
    if (e.until && e.until <= Date.now()) { e.n = 0; e.until = 0; }
    e.n += 1;
    if (e.n >= this.maxFails) e.until = Date.now() + this.lockMs;
    this.map.set(id, e);
  }
  ok(id) { this.map.delete(id); }
}

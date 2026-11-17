import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual, createHmac } from 'node:crypto';
import { promisify } from 'node:util';
import { config } from './config.js';

const scrypt = promisify(scryptCb);

export class HttpError extends Error {
  constructor(status, code, message) { super(message || code); this.status = status; this.code = code; }
}
export const bad = (m, code = 'BAD_REQUEST') => new HttpError(400, code, m);
export const forbidden = (m = 'Forbidden', code = 'FORBIDDEN') => new HttpError(403, code, m);
export const notFound = (m = 'Not found') => new HttpError(404, 'NOT_FOUND', m);

export const now = () => Date.now();

export async function hashPassword(pw) {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, 64);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}
export async function verifyPassword(pw, stored) {
  if (!stored) { await scrypt(pw, 'x'.repeat(16), 64); return false; } // constant-ish time
  const [, saltHex, keyHex] = stored.split('$');
  const key = await scrypt(pw, Buffer.from(saltHex, 'hex'), 64);
  const expected = Buffer.from(keyHex, 'hex');
  return key.length === expected.length && timingSafeEqual(key, expected);
}

// Tokens are random and only their keyed hash is stored: a DB leak does not leak sessions.
export const newToken = (bytes = 32) => randomBytes(bytes).toString('base64url');
export const hashToken = (t) => createHmac('sha256', config.tokenSecret).update(String(t)).digest('hex');
export const sha256 = (t) => createHash('sha256').update(t).digest('hex');

export function str(v, name, { min = 1, max = 200, optional = false } = {}) {
  if (v === undefined || v === null || v === '') {
    if (optional) return undefined;
    throw bad(`${name} is required`);
  }
  if (typeof v !== 'string') throw bad(`${name} must be a string`);
  const s = v.trim();
  if (s.length < min || s.length > max) throw bad(`${name} must be ${min}-${max} characters`);
  return s;
}
export function oneOf(v, name, values, def) {
  if (v === undefined && def !== undefined) return def;
  if (!values.includes(v)) throw bad(`${name} must be one of: ${values.join(', ')}`);
  return v;
}
export function intId(v, name = 'id') {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0) throw bad(`${name} must be a positive integer`);
  return n;
}
export const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;

export function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000, rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1), dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

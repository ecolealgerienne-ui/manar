import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';

export class HttpError extends Error {
  constructor(status, message, extra) { super(message); this.status = status; this.extra = extra; }
}
export const bad = (m, extra) => new HttpError(400, m, extra);

export class Router {
  constructor() { this.routes = []; }
  add(method, pattern, handler, opts = {}) {
    const keys = [];
    const re = new RegExp('^' + pattern.replace(/\//g, '\\/').replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^\\/]+)'; }) + '\\/?$');
    this.routes.push({ method, re, keys, handler, opts });
  }
  get(p, h, o) { this.add('GET', p, h, o); }
  post(p, h, o) { this.add('POST', p, h, o); }
  put(p, h, o) { this.add('PUT', p, h, o); }
  del(p, h, o) { this.add('DELETE', p, h, o); }
  match(method, path) {
    for (const r of this.routes) {
      if (r.method !== method) continue;
      const m = r.re.exec(path);
      if (m) return { route: r, params: Object.fromEntries(r.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])])) };
    }
    return null;
  }
}

export async function readBody(req, limit = 200_000) {
  const chunks = []; let size = 0;
  for await (const c of req) { size += c.length; if (size > limit) throw new HttpError(413, 'Requête trop volumineuse.'); chunks.push(c); }
  if (!size) return {};
  const ct = req.headers['content-type'] || '';
  const txt = Buffer.concat(chunks).toString('utf8');
  if (ct.includes('application/json')) { try { return JSON.parse(txt); } catch { throw new HttpError(400, 'JSON invalide.'); } }
  if (ct.includes('application/x-www-form-urlencoded')) return Object.fromEntries(new URLSearchParams(txt));
  throw new HttpError(415, 'Type de contenu non pris en charge.');
}

export function parseCookies(h = '') {
  const o = {};
  for (const part of h.split(';')) { const i = part.indexOf('='); if (i > 0) o[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); }
  return o;
}

export function send(res, status, body, headers = {}, req) {
  const h = { ...SECURITY_HEADERS, ...headers };
  let buf = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
  const ct = h['Content-Type'] || '';
  if (req && buf.length > 1024 && /text|json|javascript|svg|xml/.test(ct) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
    buf = gzipSync(buf); h['Content-Encoding'] = 'gzip'; h['Vary'] = 'Accept-Encoding';
  }
  h['Content-Length'] = buf.length;
  res.writeHead(status, h);
  res.end(req?.method === 'HEAD' ? undefined : buf);
}
export const sendJson = (res, status, data, headers = {}, req) => send(res, status, JSON.stringify(data), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers }, req);

export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; font-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
};

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json' };
const etagCache = new Map();
export async function serveStatic(req, res, root, urlPath) {
  const rel = normalize(decodeURIComponent(urlPath)).replace(/^([/\\])+/, '');
  const file = resolve(join(root, rel));
  if (!file.startsWith(resolve(root))) return false;
  try {
    const st = await stat(file);
    if (!st.isFile()) return false;
    const buf = await readFile(file);
    const key = file + st.mtimeMs;
    let etag = etagCache.get(key);
    if (!etag) { etag = '"' + createHash('md5').update(buf).digest('hex').slice(0, 16) + '"'; etagCache.set(key, etag); }
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, { ETag: etag }); res.end(); return true; }
    send(res, 200, buf, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', ETag: etag }, req);
    return true;
  } catch { return false; }
}

// Limiteur de débit en mémoire
export function rateLimiter(max, windowMs) {
  const hits = new Map();
  return (key) => {
    const now = Date.now();
    const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (arr.length >= max) { hits.set(key, arr); return false; }
    arr.push(now); hits.set(key, arr);
    if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
    return true;
  };
}

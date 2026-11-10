import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Router, HttpError, readBody, parseCookies, send, sendJson, serveStatic, rateLimiter } from './lib/http.js';
import { hashToken } from './lib/auth.js';
import { Catalog } from './lib/catalog.js';
import { productSvg, brandSvg, esc } from './lib/images.js';
import { checkAlerts } from './lib/services.js';
import { registerPublic } from './routes/public.js';
import { registerUser } from './routes/user.js';
import { registerAdmin } from './routes/admin.js';
import { seoFor, renderHead, sitemap } from './seo.js';

const here = dirname(fileURLToPath(import.meta.url));
const nowIso = () => new Date().toISOString();

export function createApp(db, opts = {}) {
  const publicDir = opts.publicDir || resolve(here, '../public');
  const cat = new Catalog(db);
  const router = new Router();
  const limiters = { auth: rateLimiter(25, 15 * 60000), contact: rateLimiter(10, 15 * 60000) };
  const secureCookie = (req) => process.env.VELUNE_SECURE_COOKIES === '1' || req.headers['x-forwarded-proto'] === 'https';
  const indexing = process.env.VELUNE_INDEXING === '1';
  const env = { db, cat, nowIso, limiters, secureCookie };
  registerPublic(router, env); registerUser(router, env); registerAdmin(router, env);
  const template = () => readFileSync(resolve(publicDir, 'index.html'), 'utf8');
  let tpl = template();
  const baseUrl = (req) => process.env.VELUNE_BASE_URL || `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`;

  // Nettoyage des sessions expirées + évaluation périodique des alertes
  const timer = setInterval(() => { try { db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now()); db.prepare('DELETE FROM search_log WHERE at<?').run(new Date(Date.now() - 90 * 86400000).toISOString()); cat.loadOffers(); checkAlerts(db, cat); } catch (e) { console.error('maintenance', e); } }, 15 * 60000);
  timer.unref();

  async function handle(req, res) {
    const url = new URL(req.url, 'http://x');
    const path = url.pathname;
    try {
      if (!['GET', 'HEAD', 'POST', 'PUT', 'DELETE'].includes(req.method)) throw new HttpError(405, 'Méthode non autorisée.');
      if (path.startsWith('/api/')) return await handleApi(req, res, url);

      let m;
      if ((m = /^\/img\/p\/([^/]+)\.svg$/.exec(path))) {
        const p = cat.productBySlug.get(m[1]); if (!p) return send(res, 404, 'Not found', { 'Content-Type': 'text/plain' });
        return send(res, 200, productSvg(p), { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' }, req);
      }
      if ((m = /^\/img\/b\/([^/]+)\.svg$/.exec(path))) {
        const b = cat.brandBySlug.get(m[1]); if (!b) return send(res, 404, 'Not found', { 'Content-Type': 'text/plain' });
        return send(res, 200, brandSvg(b), { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' }, req);
      }
      if (path === '/robots.txt') return send(res, 200, `User-agent: *\n${indexing ? 'Allow: /' : 'Disallow: /'}\nDisallow: /admin\nDisallow: /api/\nDisallow: /go/\nDisallow: /compte\nDisallow: /favoris\nDisallow: /alertes\nSitemap: ${baseUrl(req)}/sitemap.xml\n`, { 'Content-Type': 'text/plain; charset=utf-8' });
      if (path === '/sitemap.xml') return send(res, 200, sitemap(cat, baseUrl(req)), { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' }, req);
      if ((m = /^\/go\/(\d+)$/.exec(path))) return redirectPage(req, res, +m[1]);
      if (await serveStatic(req, res, publicDir, path === '/' ? '/__none__' : path)) return;
      if (/\.[a-z0-9]{2,5}$/i.test(path)) return send(res, 404, 'Not found', { 'Content-Type': 'text/plain' });

      // Coquille SPA + SEO
      if (opts.dev) tpl = template();
      const seo = seoFor(path, cat, { base: baseUrl(req) });
      const html = tpl.replace('<!--HEAD-->', renderHead(seo, { indexing })).replace('<!--SSR-->', seo.ssr);
      return send(res, seo.status, html, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' }, req);
    } catch (e) {
      return fail(req, res, e);
    }
  }

  function redirectPage(req, res, offerId) {
    const o = db.prepare('SELECT o.*, m.name mname, m.type mtype FROM offers o JOIN merchants m ON m.id=o.merchant_id WHERE o.id=?').get(offerId);
    if (!o) return send(res, 404, 'Offre introuvable', { 'Content-Type': 'text/plain; charset=utf-8' });
    const f = cat.formatById.get(o.format_id); const p = f && cat.productById.get(f.productId);
    const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Redirection vers ${esc(o.mname)} | VELUNE</title><link rel="stylesheet" href="/css/style.css"></head><body><main class="container narrow" style="padding:4rem 0"><h1>Vous quittez VELUNE</h1>
<p>Vous allez être redirigé vers <strong>${esc(o.mname)}</strong> pour <strong>${esc(p ? p.brand + ' ' + p.name : '')}</strong> (${esc(f?.label || '')}).</p>
<p class="notice demo">Cette offre est une <strong>donnée de démonstration</strong>. L’adresse ci-dessous est fictive (domaine <code>.invalid</code>) et ne mène à aucune boutique réelle.</p>
<p class="muted">Lien affilié : en production, VELUNE peut percevoir une commission si vous achetez via ce lien, sans surcoût pour vous. Le classement n’en dépend pas. Vérifiez le prix et les conditions sur le site du marchand.</p>
<p><a class="btn btn-primary" rel="sponsored nofollow noopener" href="${esc(o.url)}">Continuer vers ${esc(o.mname)}</a> <a class="btn" href="${p ? '/produit/' + p.slug : '/'}">Retour</a></p></main></body></html>`;
    send(res, 200, html, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }, req);
  }

  async function handleApi(req, res, url) {
    const found = router.match(req.method === 'HEAD' ? 'GET' : req.method, url.pathname);
    if (!found) throw new HttpError(404, 'Ressource introuvable.');
    const ip = req.socket.remoteAddress || '?';
    // CSRF : les requêtes modifiantes doivent porter l'en-tête personnalisé et provenir de la même origine
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      if (req.headers['x-requested-with'] !== 'velune') throw new HttpError(403, 'Requête refusée (en-tête de sécurité manquant).');
      const origin = req.headers.origin;
      if (origin && new URL(origin).host !== req.headers.host) throw new HttpError(403, 'Origine non autorisée.');
    }
    const cookies = parseCookies(req.headers.cookie);
    const sessionToken = cookies.vsid || null;
    let user = null;
    if (sessionToken) {
      const s = db.prepare('SELECT user_id, expires FROM sessions WHERE token_hash=?').get(hashToken(sessionToken));
      if (s && s.expires > Date.now()) { const u = db.prepare('SELECT * FROM users WHERE id=?').get(s.user_id); if (u && u.status === 'active') user = u; }
    }
    const ctx = {
      req, res, ip, params: found.params, query: Object.fromEntries(url.searchParams), body: {}, user, sessionToken,
      requireUser() { if (!user) throw new HttpError(401, 'Connexion requise.'); return user; },
      requireAdmin() { if (!user) throw new HttpError(401, 'Connexion requise.'); if (user.role !== 'admin') throw new HttpError(403, 'Accès réservé aux administrateurs.'); return user; },
    };
    if (found.route.opts.limit && !limiters[found.route.opts.limit](ip)) throw new HttpError(429, 'Trop de requêtes. Réessayez plus tard.');
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') ctx.body = await readBody(req);
    const data = await found.route.handler(ctx);
    sendJson(res, 200, data ?? { ok: true }, {}, req);
  }

  function fail(req, res, e) {
    if (e instanceof HttpError) return sendJson(res, e.status, { error: e.message, ...(e.extra || {}) }, {}, req);
    console.error('Erreur serveur:', e);
    return sendJson(res, 500, { error: 'Une erreur interne est survenue. Réessayez plus tard.' }, {}, req);
  }

  const server = createServer((req, res) => { handle(req, res).catch((e) => fail(req, res, e)); });
  return { server, cat, close: () => { clearInterval(timer); server.close(); } };
}

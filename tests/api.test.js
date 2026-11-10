import test from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../server/db.js';
import { seed } from '../server/seed.js';
import { createApp } from '../server/app.js';
import { runSearch } from '../server/lib/search.js';
import { compareBasket } from '../server/lib/services.js';
import { pricePer100, shippingFor, applyCode } from '../server/lib/pricing.js';

const db = openDb(':memory:');
const { credentials } = seed(db, { adminPassword: 'Admin-Test-Pass-1!' });
const app = createApp(db);
const cat = app.cat;
await new Promise((r) => app.server.listen(0, r));
const base = `http://127.0.0.1:${app.server.address().port}`;
test.after(() => app.close());

class Client {
  constructor() { this.cookie = ''; }
  async req(method, path, body) {
    const res = await fetch(base + path, { method, headers: { 'X-Requested-With': 'velune', 'Content-Type': 'application/json', cookie: this.cookie }, body: body ? JSON.stringify(body) : undefined });
    const sc = res.headers.get('set-cookie'); if (sc) this.cookie = sc.split(';')[0];
    return { status: res.status, data: await res.json().catch(() => null) };
  }
  async login(e, p) { const r = await this.req('POST', '/api/auth/login', { email: e, password: p }); assert.equal(r.status, 200); }
}

test('jeu de données conforme au cahier des charges', () => {
  const n = (c) => cat.products.filter((p) => p.category === c).length;
  assert.ok(n('parfum') >= 200 && n('skincare') >= 50 && n('maquillage') >= 50 && n('cheveux') + n('corps') >= 20);
  assert.ok(cat.brands.length >= 30);
  assert.ok(cat.products.every((p) => p.demo));
});

test('T1 recherche parfum précis + formats + marchands', () => {
  const r = runSearch(cat, { q: 'Dior Sauvage Eau de Parfum 100 ml' });
  assert.equal(r.items[0].name, 'Sauvage');
  const p = cat.productBySlug.get(r.items[0].slug);
  assert.ok(p.formats.length >= 2 && p.formats.some((f) => f.offers.length >= 2));
});

test('T2 recherche olfactive vanille+musc+ambre < 100 €', () => {
  const r = runSearch(cat, { q: 'parfum vanillé, musqué et ambré à moins de 100 €' });
  assert.ok(r.total > 0);
  const top = cat.productBySlug.get(r.items[0].slug);
  for (const n of ['Vanille', 'Musc blanc', 'Ambre']) assert.ok(top.allNotes.includes(n) || top.accords.length, n);
  assert.equal(r.items[0].match, 100);
  assert.ok(r.items.every((i) => i.minPrice <= 100));
});

test('T3 exclusion de notes', () => {
  const r = runSearch(cat, { q: 'parfum floral sans rose', pageSize: 60 });
  assert.ok(r.total > 0);
  for (const i of r.items) { const p = cat.productBySlug.get(i.slug); assert.ok(!p.allNotes.includes('Rose')); assert.ok(p.families.includes('florale')); }
});

test('recherche tolérante aux fautes', () => {
  assert.equal(runSearch(cat, { q: 'Dior Sauvge' }).items[0]?.name, 'Sauvage');
});

test('T4 similarité avec raisons et alternatives moins chères', async () => {
  const c = new Client();
  const r = await c.req('GET', '/api/products/tom-ford-black-orchid-edp/similar?cheaper=1');
  assert.equal(r.status, 200);
  assert.ok(r.data.items.length > 0);
  for (const it of r.data.items) { assert.ok(it.similarity.reasons.length > 0); assert.ok(it.similarity.priceDelta < 0); assert.ok(it.similarity.score <= 100); }
});

test('T7 calcul du prix au ml', () => {
  assert.equal(pricePer100(60, 30, 'ml'), 200);
  assert.equal(pricePer100(120, 100, 'ml'), 120);
});

test('T6 panier : livraison, franco et multi-boutiques', () => {
  const items = ['dior-sauvage-edp', 'chanel-bleu-de-chanel-edp', 'cerave-gel-moussant-nettoyant'].map((s) => ({ formatId: cat.productBySlug.get(s).formats.at(-1).id, qty: 1 }));
  const r = compareBasket(cat, items, []);
  assert.ok(r.summary);
  const complete = r.scenarios.single.filter((s) => s.complete);
  for (const s of complete) assert.equal(s.total, Math.round((s.subtotal - s.discount + s.shipping) * 100) / 100);
  assert.ok(r.scenarios.multi.total <= Math.min(...complete.map((s) => s.total)) + 1e-9);
  const m = cat.merchants.find((x) => x.free_threshold);
  assert.equal(shippingFor(m, m.free_threshold), 0);
  assert.equal(shippingFor(m, m.free_threshold - 1), m.ship_fee);
});

test('codes promo : expiré refusé, minimum respecté', () => {
  const expired = cat.codes.find((c) => c.code === 'EXPIRE-DEMO');
  assert.equal(applyCode(expired, [{ price: 100, qty: 1, category: 'parfum' }]).applied, false);
  const d10 = cat.codes.find((c) => c.code === 'DEMO10');
  assert.equal(applyCode(d10, [{ price: 20, qty: 1, category: 'parfum' }]).applied, false);
  assert.equal(applyCode(d10, [{ price: 100, qty: 1, category: 'parfum' }]).discount, 10);
});

test('T9 promotions : les offres expirées ne sont pas actives', async () => {
  const c = new Client();
  const act = await c.req('GET', '/api/promotions?minDiscount=15');
  assert.ok(act.data.items.every((i) => !i.expired && i.discount >= 15));
  const all = await c.req('GET', '/api/promotions?includeExpired=1');
  assert.ok(all.data.total >= act.data.total);
});

test('historique : pas d’invention pour un produit sans relevé', async () => {
  const a = new Client(); await a.login(credentials.adminEmail, credentials.adminPassword);
  const b = cat.brands[0];
  const cr = await a.req('POST', '/api/admin/products', { name: 'Produit test', brandId: b.id, category: 'skincare', formats: [{ size: 50, unit: 'ml' }] });
  assert.equal(cr.status, 200);
  const h = await a.req('GET', `/api/products/${cr.data.slug}/history`);
  assert.equal(h.data.points.length, 0);
});

test('T5 compte, profil, favoris et recommandations', async () => {
  const c = new Client();
  const email = `t${Date.now()}@test.fr`;
  assert.equal((await c.req('POST', '/api/auth/register', { email, password: 'faible' })).status, 400);
  const reg = await c.req('POST', '/api/auth/register', { email, password: 'Motdepasse-Test1', acceptTerms: true, consentPerso: true });
  assert.equal(reg.status, 200);
  const up = await c.req('PUT', '/api/me', { profile: { consentPerso: true, parfum: { familles: ['gourmande'], notesAimees: ['Vanille'], notesEvitees: ['Oud'] } } });
  assert.equal(up.data.profile.parfum.notesAimees[0], 'Vanille');
  const rec = await c.req('GET', '/api/me/recommendations');
  assert.ok(rec.data.products.length > 0);
  for (const p of rec.data.products) { assert.ok(p.reasons.length); assert.ok(!cat.productBySlug.get(p.slug).allNotes.includes('Oud')); }
  const id = cat.productBySlug.get('dior-sauvage-edp').id;
  assert.equal((await c.req('POST', '/api/favorites/toggle', { productId: id })).data.favorite, true);
  assert.deepEqual((await c.req('GET', '/api/favorites/ids')).data.ids, [id]);
});

test('T8 alerte : création, modification du seuil, déclenchement vérifié uniquement', async () => {
  const u = new Client(); await u.login('user@velune.demo', 'Demo-Velune-2024!');
  const a = new Client(); await a.login(credentials.adminEmail, credentials.adminPassword);
  const p = cat.productBySlug.get('dior-j-adore-edp');
  const f = p.formats.at(-1);
  const trusted = f.offers.find((o) => o.trusted);
  assert.ok(trusted);
  const al = await u.req('POST', '/api/alerts', { formatId: f.id, targetPrice: 1, merchantIds: [trusted.merchantId] });
  assert.equal(al.status, 200); assert.equal(al.data.reached, false);
  const before = (await u.req('GET', '/api/notifications')).data.items.length;
  await a.req('PUT', `/api/admin/offers/${trusted.id}`, { price: 5, status: 'verified', available: true });
  assert.equal((await u.req('GET', '/api/notifications')).data.items.length, before); // seuil 1 non atteint
  await u.req('PUT', `/api/alerts/${al.data.id}`, { targetPrice: 10 });
  const n = (await u.req('GET', '/api/notifications')).data.items;
  assert.equal(n.length, before + 1);
  // offre non vérifiée : aucune notification
  const un = f.offers.find((o) => !o.merchant.verified && o.usable);
  if (un) {
    const al2 = await u.req('POST', '/api/alerts', { formatId: f.id, targetPrice: 3, merchantIds: [un.merchantId] });
    await a.req('PUT', `/api/admin/offers/${un.id}`, { price: 2, status: 'unverified', available: true });
    assert.equal((await u.req('GET', '/api/notifications')).data.items.length, before + 1);
    await u.req('DELETE', `/api/alerts/${al2.data.id}`);
  }
});

test('sécurité : admin protégé, CSRF, verrouillage', async () => {
  const anon = new Client();
  assert.equal((await anon.req('GET', '/api/admin/stats')).status, 401);
  const u = new Client(); await u.login('user@velune.demo', 'Demo-Velune-2024!');
  assert.equal((await u.req('GET', '/api/admin/stats')).status, 403);
  const res = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(res.status, 403);
  const a = new Client(); await a.login(credentials.adminEmail, credentials.adminPassword);
  const s = await a.req('GET', '/api/admin/stats');
  assert.equal(s.status, 200); assert.ok(s.data.products > 300);
  assert.ok((await a.req('GET', '/api/admin/audit')).data.entries.length > 0);
});

test('pages SEO et fichiers', async () => {
  const html = await (await fetch(base + '/produit/dior-sauvage-edp')).text();
  assert.match(html, /<title>Dior Sauvage/); assert.match(html, /application\/ld\+json/);
  assert.equal((await fetch(base + '/produit/inconnu')).status, 404);
  assert.match(await (await fetch(base + '/sitemap.xml')).text(), /<urlset/);
});

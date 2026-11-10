import { HttpError, bad } from '../lib/http.js';
import { slugify, norm } from '../lib/text.js';
import { checkAlerts } from '../lib/services.js';
import { tx } from '../db.js';
import { eanFor } from '../seed.js';
import { INGREDIENTS, NOTES, FAMILIES } from '../data/vocab.js';

const J = JSON.stringify;
const arr = (a) => (Array.isArray(a) ? a.map(String) : []);

export function registerAdmin(r, { db, cat, nowIso }) {
  const audit = (ctx, action, entity, id, detail) => db.prepare('INSERT INTO audit_log (admin_id,admin_email,action,entity,entity_id,detail,at) VALUES (?,?,?,?,?,?,?)').run(ctx.user.id, ctx.user.email, action, entity, String(id ?? ''), typeof detail === 'string' ? detail : J(detail ?? {}), nowIso());
  const A = (fn) => (ctx) => { ctx.requireAdmin(); return fn(ctx); };
  const page = (ctx) => ({ page: Math.max(1, +ctx.query.page || 1), size: Math.min(100, +ctx.query.size || 25) });
  const reload = () => cat.load();

  // ---- Statistiques
  r.get('/api/admin/stats', A(() => {
    const prods = cat.products;
    const incomplete = prods.filter((p) => isIncomplete(p));
    const views = db.prepare('SELECT product_id, COUNT(*) c FROM product_views GROUP BY product_id ORDER BY c DESC LIMIT 8').all().map((x) => ({ ...(cat.productById.get(x.product_id) ? { name: cat.productById.get(x.product_id).name, brand: cat.productById.get(x.product_id).brand, slug: cat.productById.get(x.product_id).slug } : {}), views: x.c }));
    const searches = db.prepare('SELECT q, COUNT(*) c FROM search_log GROUP BY lower(q) ORDER BY c DESC LIMIT 8').all();
    let active = 0, obsolete = 0, offers = 0;
    for (const f of cat.formatById.values()) for (const o of f.offers) { offers++; if (o.usable) active++; if (o.obsolete) obsolete++; }
    const c = (t, w = '') => db.prepare(`SELECT COUNT(*) c FROM ${t} ${w}`).get().c;
    return {
      products: prods.length, brands: cat.brands.length, merchants: cat.merchants.length, offers, activeOffers: active, obsoleteOffers: obsolete,
      noImage: prods.filter((p) => !p.imageSource).length, incomplete: incomplete.length, users: c('users'), pendingMatches: c('matches', "WHERE status='pending'"),
      openReports: c('reports', "WHERE status='open'"), deletionRequests: c('users', 'WHERE deletion_requested IS NOT NULL'), messages: c('messages'),
      topSearches: searches, topViewed: views,
    };
  }));

  function isIncomplete(p) {
    if (p.category === 'parfum') return !(p.top.length && p.heart.length && p.base.length && p.concentration && p.gender);
    if (p.category === 'skincare') return !(p.actives.length || p.inci) || !p.skin.length;
    return !p.description;
  }

  // ---- Produits
  r.get('/api/admin/products', A((ctx) => {
    const { page: pg, size } = page(ctx); const q = norm(ctx.query.q || '');
    let list = cat.products;
    if (q) list = list.filter((p) => p.nName.includes(q) || String(p.id) === q);
    if (ctx.query.category) list = list.filter((p) => p.category === ctx.query.category);
    if (ctx.query.issue === 'noimage') list = list.filter((p) => !p.imageSource);
    if (ctx.query.issue === 'incomplete') list = list.filter(isIncomplete);
    if (ctx.query.issue === 'unverified') list = list.filter((p) => !p.verified);
    return { total: list.length, items: list.slice((pg - 1) * size, pg * size).map((p) => ({ id: p.id, slug: p.slug, name: p.name, brand: p.brand, category: p.category, sub: p.sub, verified: p.verified, demo: p.demo, incomplete: isIncomplete(p), noImage: !p.imageSource, formats: p.formats.length, offers: p.formats.reduce((s, f) => s + f.offers.length, 0) })) };
  }));
  r.get('/api/admin/products/:id', A((ctx) => {
    const p = cat.productById.get(+ctx.params.id); if (!p) throw new HttpError(404, 'Produit introuvable.');
    return { ...p, formats: p.formats.map((f) => ({ id: f.id, size: f.size, unit: f.unit, ean: f.ean, ref: f.ref })), summary: undefined, deal: undefined, nameTokens: undefined };
  }));
  const productFields = (b) => {
    const name = String(b.name || '').trim(); if (!name || name.length > 150) throw bad('Nom requis.', { field: 'name' });
    if (!['parfum', 'skincare', 'maquillage', 'cheveux', 'corps'].includes(b.category)) throw bad('Catégorie invalide.', { field: 'category' });
    const knownNotes = new Set(NOTES.map((n) => n.name));
    const notes = (k) => arr(b[k]).filter((n) => knownNotes.has(n));
    for (const k of ['top', 'heart', 'base']) if (arr(b[k]).some((n) => !knownNotes.has(n))) throw bad(`Note inconnue dans « ${k} ». Utilisez la bibliothèque de notes.`, { field: k });
    const fams = arr(b.families).filter((f) => FAMILIES.some((x) => x.id === f));
    if (b.year && !(+b.year >= 1700 && +b.year <= new Date().getFullYear() + 1)) throw bad('Année invalide.', { field: 'year' });
    return { name, category: b.category, sub: b.sub ? String(b.sub).slice(0, 60) : null, description: b.description ? String(b.description).slice(0, 2000) : null, gender: ['F', 'H', 'M'].includes(b.gender) ? b.gender : null,
      year: b.year ? +b.year : null, perfumer: b.perfumer ? String(b.perfumer).slice(0, 80) : null, concentration: ['extrait', 'edp', 'edt', 'cologne'].includes(b.concentration) ? b.concentration : null,
      families: fams, accords: arr(b.accords).slice(0, 12), top: notes('top'), heart: notes('heart'), base: notes('base'), intensity: b.intensity ? Math.max(1, Math.min(5, +b.intensity)) : null,
      seasons: arr(b.seasons), occasions: arr(b.occasions), actives: arr(b.actives), skin: arr(b.skin), hair: arr(b.hair), inci: b.inci ? String(b.inci).slice(0, 4000) : null,
      texture: b.texture || null, finish: b.finish || null, coverage: b.coverage || null, source: b.source ? String(b.source).slice(0, 300) : null, imageSource: b.imageSource ? String(b.imageSource).slice(0, 300) : null };
  };
  const cols = `description=?,gender=?,year=?,perfumer=?,concentration=?,families=?,accords=?,notes_top=?,notes_heart=?,notes_base=?,intensity=?,seasons=?,occasions=?,actives=?,skin_types=?,hair_types=?,inci=?,texture=?,finish=?,coverage=?,source=?,image_source=?,subcategory=?,category=?,name=?,updated_at=?`;
  const vals = (f) => [f.description, f.gender, f.year, f.perfumer, f.concentration, J(f.families), J(f.accords), J(f.top), J(f.heart), J(f.base), f.intensity, J(f.seasons), J(f.occasions), J(f.actives), J(f.skin), J(f.hair), f.inci, f.texture, f.finish, f.coverage, f.source, f.imageSource, f.sub, f.category, f.name, nowIso()];
  r.post('/api/admin/products', A((ctx) => {
    const f = productFields(ctx.body);
    const brand = cat.brandById.get(+ctx.body.brandId); if (!brand) throw bad('Marque requise.', { field: 'brandId' });
    let slug = slugify(`${brand.name} ${f.name}${f.concentration ? ' ' + f.concentration : ''}`), i = 2; const base = slug;
    while (db.prepare('SELECT 1 FROM products WHERE slug=?').get(slug)) slug = `${base}-${i++}`;
    const res = db.prepare(`INSERT INTO products (slug,brand_id,verified,demo,popularity,created_at,status,${cols.split(',').map((c) => c.split('=')[0]).join(',')}) VALUES (?,?,0,0,0,?,'active',${vals(f).map(() => '?').join(',')})`).run(slug, brand.id, nowIso(), ...vals(f));
    const pid = Number(res.lastInsertRowid);
    for (const fm of Array.isArray(ctx.body.formats) ? ctx.body.formats : []) addFormat(pid, fm);
    audit(ctx, 'create', 'product', pid, { name: f.name }); reload(); return { id: pid, slug };
  }));
  function addFormat(pid, fm) {
    const size = +fm.size; if (!(size > 0)) throw bad('Taille de format invalide.');
    const unit = ['ml', 'g', 'unité'].includes(fm.unit) ? fm.unit : 'ml';
    const ean = fm.ean ? String(fm.ean).trim() : null;
    if (ean && !/^\d{8}$|^\d{13}$/.test(ean)) throw bad('EAN invalide (8 ou 13 chiffres).', { field: 'ean' });
    const x = db.prepare('INSERT INTO formats (product_id,size,unit,ean,ref_price) VALUES (?,?,?,?,?)').run(pid, size, unit, ean, fm.ref ? +fm.ref : null);
    return Number(x.lastInsertRowid);
  }
  r.put('/api/admin/products/:id', A((ctx) => {
    const p = cat.productById.get(+ctx.params.id); if (!p) throw new HttpError(404, 'Produit introuvable.');
    const f = productFields({ ...ctx.body, category: ctx.body.category || p.category });
    db.prepare(`UPDATE products SET ${cols}, brand_id=COALESCE(?,brand_id) WHERE id=?`).run(...vals(f), cat.brandById.has(+ctx.body.brandId) ? +ctx.body.brandId : null, p.id);
    audit(ctx, 'update', 'product', p.id, { name: f.name }); reload(); return { ok: true };
  }));
  r.post('/api/admin/products/:id/verify', A((ctx) => {
    const p = cat.productById.get(+ctx.params.id); if (!p) throw new HttpError(404, 'Produit introuvable.');
    db.prepare('UPDATE products SET verified=? WHERE id=?').run(ctx.body.verified === false ? 0 : 1, p.id);
    audit(ctx, ctx.body.verified === false ? 'unverify' : 'verify', 'product', p.id); reload(); return { ok: true };
  }));
  r.del('/api/admin/products/:id', A((ctx) => {
    const p = cat.productById.get(+ctx.params.id); if (!p) throw new HttpError(404, 'Produit introuvable.');
    db.prepare('DELETE FROM products WHERE id=?').run(p.id); audit(ctx, 'delete', 'product', p.id, { name: p.name }); reload(); return { ok: true };
  }));
  r.post('/api/admin/products/:id/formats', A((ctx) => {
    const p = cat.productById.get(+ctx.params.id); if (!p) throw new HttpError(404, 'Produit introuvable.');
    const id = addFormat(p.id, ctx.body); audit(ctx, 'add-format', 'product', p.id, ctx.body); reload(); return { id };
  }));
  r.del('/api/admin/formats/:id', A((ctx) => { db.prepare('DELETE FROM formats WHERE id=?').run(+ctx.params.id); audit(ctx, 'delete-format', 'format', ctx.params.id); reload(); return { ok: true }; }));
  // Fusion de doublons : conserve `keepId`, absorbe `removeId`
  r.post('/api/admin/products/merge', A((ctx) => {
    const keep = cat.productById.get(+ctx.body.keepId), rem = cat.productById.get(+ctx.body.removeId);
    if (!keep || !rem || keep.id === rem.id) throw bad('Deux produits distincts requis.');
    tx(db, () => {
      for (const f of rem.formats) {
        const same = keep.formats.find((k) => k.size === f.size && k.unit === f.unit);
        if (same) {
          db.prepare('UPDATE OR IGNORE offers SET format_id=? WHERE format_id=?').run(same.id, f.id);
          db.prepare('UPDATE OR IGNORE price_history SET format_id=? WHERE format_id=?').run(same.id, f.id);
          db.prepare('UPDATE alerts SET format_id=?, product_id=? WHERE format_id=?').run(same.id, keep.id, f.id);
          db.prepare('DELETE FROM formats WHERE id=?').run(f.id);
        } else db.prepare('UPDATE formats SET product_id=? WHERE id=?').run(keep.id, f.id);
      }
      db.prepare('UPDATE OR IGNORE list_items SET product_id=? WHERE product_id=?').run(keep.id, rem.id);
      db.prepare('UPDATE reviews SET product_id=? WHERE product_id=?').run(keep.id, rem.id);
      db.prepare('UPDATE alerts SET product_id=? WHERE product_id=?').run(keep.id, rem.id);
      db.prepare('DELETE FROM products WHERE id=?').run(rem.id);
    });
    audit(ctx, 'merge', 'product', keep.id, { removed: rem.id, removedName: rem.name }); reload(); return { ok: true };
  }));

  // ---- Marques
  r.get('/api/admin/brands', A(() => ({ brands: cat.brands.map((b) => ({ ...b, products: cat.products.filter((p) => p.brandId === b.id).length })) })));
  r.post('/api/admin/brands', A((ctx) => {
    const name = String(ctx.body.name || '').trim(); if (!name || name.length > 80) throw bad('Nom requis.', { field: 'name' });
    if (db.prepare('SELECT 1 FROM brands WHERE slug=?').get(slugify(name))) throw bad('Cette marque existe déjà.', { field: 'name' });
    const x = db.prepare('INSERT INTO brands (slug,name,description,fictional,demo,created_at) VALUES (?,?,?,0,0,?)').run(slugify(name), name, ctx.body.description || null, nowIso());
    audit(ctx, 'create', 'brand', x.lastInsertRowid, { name }); reload(); return { id: Number(x.lastInsertRowid) };
  }));
  r.put('/api/admin/brands/:id', A((ctx) => {
    const b = cat.brandById.get(+ctx.params.id); if (!b) throw new HttpError(404, 'Marque introuvable.');
    const name = String(ctx.body.name || b.name).trim(); if (!name || name.length > 80) throw bad('Nom invalide.');
    db.prepare('UPDATE brands SET name=?, description=? WHERE id=?').run(name, ctx.body.description ?? b.description, b.id);
    audit(ctx, 'update', 'brand', b.id, { name }); reload(); return { ok: true };
  }));
  r.post('/api/admin/brands/:id/assign', A((ctx) => {
    const b = cat.brandById.get(+ctx.params.id); if (!b) throw new HttpError(404, 'Marque introuvable.');
    const ids = (Array.isArray(ctx.body.productIds) ? ctx.body.productIds : []).map(Number).filter((id) => cat.productById.has(id));
    for (const id of ids) db.prepare('UPDATE products SET brand_id=? WHERE id=?').run(b.id, id);
    audit(ctx, 'assign-products', 'brand', b.id, { productIds: ids }); reload(); return { moved: ids.length };
  }));

  // ---- Marchands
  r.get('/api/admin/merchants', A(() => ({ merchants: cat.merchants.map((m) => ({ ...m, offers: [...cat.formatById.values()].reduce((s, f) => s + f.offers.filter((o) => o.merchantId === m.id).length, 0) })) })));
  const merchantFields = (b, cur = {}) => {
    const type = b.type ?? cur.type;
    if (!['officiel', 'revendeur_verifie', 'marketplace', 'tiers', 'non_verifie'].includes(type)) throw bad('Type de marchand invalide.', { field: 'type' });
    const name = String(b.name ?? cur.name ?? '').trim(); if (!name) throw bad('Nom requis.', { field: 'name' });
    const num = (v, d) => (v === '' || v == null ? d : Number(v));
    const fee = num(b.ship_fee, cur.ship_fee ?? 0); if (!(fee >= 0)) throw bad('Frais de livraison invalides.', { field: 'ship_fee' });
    const thr = num(b.free_threshold, cur.free_threshold ?? null); if (thr != null && !(thr >= 0)) throw bad('Seuil invalide.', { field: 'free_threshold' });
    const status = b.status ?? cur.status ?? 'active'; if (!['active', 'suspended'].includes(status)) throw bad('Statut invalide.');
    return { name, type, ship_fee: fee, free_threshold: thr, delivery_days: num(b.delivery_days, cur.delivery_days ?? 3), status, url: b.url ?? cur.url ?? null, criteria: b.criteria ?? cur.criteria ?? null, contact: b.contact ?? cur.contact ?? null, selected: b.selected != null ? (b.selected ? 1 : 0) : cur.selected ?? 0, verified: ['officiel', 'revendeur_verifie'].includes(type) ? (b.verified != null ? (b.verified ? 1 : 0) : cur.verified ?? 1) : 0 };
  };
  r.post('/api/admin/merchants', A((ctx) => {
    const m = merchantFields(ctx.body);
    const slug = slugify(m.name);
    if (db.prepare('SELECT 1 FROM merchants WHERE slug=?').get(slug)) throw bad('Ce marchand existe déjà.', { field: 'name' });
    const x = db.prepare('INSERT INTO merchants (slug,name,type,verified,ship_fee,free_threshold,delivery_days,status,url,criteria,contact,selected,demo) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0)').run(slug, m.name, m.type, m.verified, m.ship_fee, m.free_threshold, m.delivery_days, m.status, m.url, m.criteria, m.contact, m.selected);
    audit(ctx, 'create', 'merchant', x.lastInsertRowid, { name: m.name }); reload(); return { id: Number(x.lastInsertRowid) };
  }));
  r.put('/api/admin/merchants/:id', A((ctx) => {
    const cur = cat.merchantById.get(+ctx.params.id); if (!cur) throw new HttpError(404, 'Marchand introuvable.');
    const m = merchantFields(ctx.body, cur);
    db.prepare('UPDATE merchants SET name=?,type=?,verified=?,ship_fee=?,free_threshold=?,delivery_days=?,status=?,url=?,criteria=?,contact=?,selected=? WHERE id=?').run(m.name, m.type, m.verified, m.ship_fee, m.free_threshold, m.delivery_days, m.status, m.url, m.criteria, m.contact, m.selected, cur.id);
    audit(ctx, m.status !== cur.status ? (m.status === 'suspended' ? 'suspend' : 'reactivate') : 'update', 'merchant', cur.id, { name: m.name }); reload(); return { ok: true };
  }));
  r.post('/api/admin/merchants/:id/check', A((ctx) => {
    const m = cat.merchantById.get(+ctx.params.id); if (!m) throw new HttpError(404, 'Marchand introuvable.');
    db.prepare('UPDATE merchants SET last_check=? WHERE id=?').run(nowIso(), m.id); audit(ctx, 'verify-coordinates', 'merchant', m.id); reload(); return { ok: true };
  }));

  // ---- Offres
  r.get('/api/admin/offers', A((ctx) => {
    const { page: pg, size } = page(ctx); const q = norm(ctx.query.q || '');
    const rows = [];
    for (const p of cat.products) {
      if (q && !p.nName.includes(q)) continue;
      for (const f of p.formats) for (const o of f.offers) {
        if (ctx.query.merchant && o.merchantId !== +ctx.query.merchant) continue;
        if (ctx.query.state === 'obsolete' && !o.obsolete) continue;
        if (ctx.query.state === 'flagged' && !o.flagged) continue;
        if (ctx.query.state === 'unverified' && o.verifiedStatus !== 'unverified') continue;
        rows.push({ id: o.id, product: `${p.brand} ${p.name}`, slug: p.slug, format: f.label, merchant: o.merchant.name, price: o.price, priceOrig: o.priceOrig, available: o.available, status: o.verifiedStatus, obsolete: o.obsolete, expired: o.expired, flagged: o.flagged, fetchedAt: o.fetchedAt, expiresAt: o.expiresAt, url: o.url });
      }
    }
    return { total: rows.length, items: rows.slice((pg - 1) * size, pg * size) };
  }));
  const offerRow = (id) => { const o = db.prepare('SELECT * FROM offers WHERE id=?').get(id); if (!o) throw new HttpError(404, 'Offre introuvable.'); return o; };
  r.put('/api/admin/offers/:id', A((ctx) => {
    const o = offerRow(+ctx.params.id); const b = ctx.body;
    const price = b.price != null ? Number(b.price) : o.price; if (!(price > 0 && price < 100000)) throw bad('Prix invalide.', { field: 'price' });
    const orig = b.priceOrig === '' || b.priceOrig === null ? null : b.priceOrig != null ? Number(b.priceOrig) : o.price_orig;
    if (orig != null && !(orig > 0)) throw bad('Prix de référence invalide.', { field: 'priceOrig' });
    db.prepare('UPDATE offers SET price=?, price_orig=?, available=?, verified_status=?, fetched_at=?, flagged=?, expires_at=? WHERE id=?').run(price, orig, b.available != null ? (b.available ? 1 : 0) : o.available,
      ['verified', 'unverified', 'obsolete'].includes(b.status) ? b.status : o.verified_status, b.touch === false ? o.fetched_at : nowIso(), b.flagged != null ? (b.flagged ? 1 : 0) : o.flagged, b.expiresAt === '' ? null : b.expiresAt ?? o.expires_at, o.id);
    audit(ctx, 'update', 'offer', o.id, { from: o.price, to: price });
    reload(); const sent = checkAlerts(db, cat); return { ok: true, alertsTriggered: sent };
  }));
  r.post('/api/admin/offers/:id/flag', A((ctx) => {
    const o = offerRow(+ctx.params.id); db.prepare('UPDATE offers SET flagged=? WHERE id=?').run(ctx.body.flagged === false ? 0 : 1, o.id);
    audit(ctx, ctx.body.flagged === false ? 'unflag' : 'flag-obsolete', 'offer', o.id); reload(); return { ok: true };
  }));
  r.del('/api/admin/offers/:id', A((ctx) => { const o = offerRow(+ctx.params.id); db.prepare('DELETE FROM offers WHERE id=?').run(o.id); audit(ctx, 'delete', 'offer', o.id); reload(); return { ok: true }; }));
  r.post('/api/admin/offers', A((ctx) => {
    const f = cat.formatById.get(+ctx.body.formatId), m = cat.merchantById.get(+ctx.body.merchantId);
    if (!f || !m) throw bad('Format et marchand requis.');
    const price = Number(ctx.body.price); if (!(price > 0)) throw bad('Prix invalide.', { field: 'price' });
    const url = String(ctx.body.url || ''); if (!/^https?:\/\//.test(url)) throw bad('URL du produit chez le marchand requise (http/https).', { field: 'url' });
    if (db.prepare('SELECT 1 FROM offers WHERE format_id=? AND merchant_id=?').get(f.id, m.id)) throw bad('Une offre existe déjà pour ce marchand et ce format.');
    const x = db.prepare('INSERT INTO offers (format_id,merchant_id,price,price_orig,available,url,source,fetched_at,verified_status,demo) VALUES (?,?,?,?,1,?,?,?,?,0)').run(f.id, m.id, price, ctx.body.priceOrig ? Number(ctx.body.priceOrig) : null, url, 'saisie-admin', nowIso(), m.verified ? 'verified' : 'unverified');
    audit(ctx, 'create', 'offer', x.lastInsertRowid, { price }); reload(); return { id: Number(x.lastInsertRowid) };
  }));
  // Relevé de prix SIMULÉ (démonstration) : fait varier les prix et déclenche les alertes.
  r.post('/api/admin/offers/simulate-refresh', A((ctx) => {
    let n = 0;
    tx(db, () => {
      for (const o of db.prepare("SELECT o.* FROM offers o JOIN merchants m ON m.id=o.merchant_id WHERE m.status='active' AND o.flagged=0").all()) {
        const delta = 1 + (Math.random() - 0.55) * 0.12;
        const price = Math.max(1, Math.round(o.price * delta * 2) / 2);
        db.prepare('UPDATE offers SET price=?, fetched_at=?, verified_status=CASE WHEN verified_status=\'obsolete\' THEN \'verified\' ELSE verified_status END WHERE id=?').run(price, nowIso(), o.id); n++;
      }
    });
    audit(ctx, 'simulate-refresh', 'offer', '', { updated: n, note: 'données de démonstration' });
    reload(); const sent = checkAlerts(db, cat); return { updated: n, alertsTriggered: sent, note: 'Relevé simulé : aucune donnée réelle.' };
  }));

  // ---- Codes promo
  r.get('/api/admin/promo-codes', A(() => ({ codes: cat.codes.map((c) => ({ ...c, merchant: cat.merchantById.get(c.merchant_id)?.name })) })));
  const codeFields = (b) => {
    const code = String(b.code || '').trim().toUpperCase(); if (!/^[A-Z0-9-]{3,30}$/.test(code)) throw bad('Code invalide (3 à 30 caractères A-Z, 0-9, -).', { field: 'code' });
    if (!['percent', 'fixed', 'freeship'].includes(b.type)) throw bad('Type invalide.', { field: 'type' });
    const value = Number(b.value || 0); if (b.type === 'percent' && !(value > 0 && value <= 100)) throw bad('Pourcentage entre 1 et 100.', { field: 'value' });
    if (b.type === 'fixed' && !(value > 0)) throw bad('Montant invalide.', { field: 'value' });
    if (!cat.merchantById.has(+b.merchantId)) throw bad('Marchand requis.', { field: 'merchantId' });
    return { code, type: b.type, value, merchant: +b.merchantId, min: Number(b.minAmount || 0), expires: b.expiresAt || null, cond: b.conditions || null, cats: J(arr(b.categories)), active: b.active === false ? 0 : 1 };
  };
  r.post('/api/admin/promo-codes', A((ctx) => { const c = codeFields(ctx.body); const x = db.prepare('INSERT INTO promo_codes (code,merchant_id,type,value,min_amount,expires_at,conditions,categories,brands,verified_at,active,demo) VALUES (?,?,?,?,?,?,?,?,?,?,?,0)').run(c.code, c.merchant, c.type, c.value, c.min, c.expires, c.cond, c.cats, '[]', nowIso(), c.active); audit(ctx, 'create', 'promo-code', x.lastInsertRowid, { code: c.code }); reload(); return { id: Number(x.lastInsertRowid) }; }));
  r.put('/api/admin/promo-codes/:id', A((ctx) => { const c = codeFields(ctx.body); db.prepare('UPDATE promo_codes SET code=?,merchant_id=?,type=?,value=?,min_amount=?,expires_at=?,conditions=?,categories=?,active=?,verified_at=? WHERE id=?').run(c.code, c.merchant, c.type, c.value, c.min, c.expires, c.cond, c.cats, c.active, nowIso(), +ctx.params.id); audit(ctx, 'update', 'promo-code', ctx.params.id, { code: c.code }); reload(); return { ok: true }; }));
  r.del('/api/admin/promo-codes/:id', A((ctx) => { db.prepare('DELETE FROM promo_codes WHERE id=?').run(+ctx.params.id); audit(ctx, 'delete', 'promo-code', ctx.params.id); reload(); return { ok: true }; }));

  // ---- Utilisateurs, signalements, messages
  r.get('/api/admin/users', A((ctx) => {
    const q = `%${String(ctx.query.q || '').toLowerCase()}%`;
    return { users: db.prepare('SELECT id,email,name,role,status,deletion_requested,created_at FROM users WHERE lower(email) LIKE ? OR lower(COALESCE(name,\'\')) LIKE ? ORDER BY id DESC LIMIT 200').all(q, q) };
  }));
  r.put('/api/admin/users/:id/status', A((ctx) => {
    const u = db.prepare('SELECT * FROM users WHERE id=?').get(+ctx.params.id); if (!u) throw new HttpError(404, 'Utilisateur introuvable.');
    if (u.id === ctx.user.id || u.role === 'admin') throw bad('Action impossible sur un compte administrateur.');
    const status = ctx.body.status === 'suspended' ? 'suspended' : 'active';
    db.prepare('UPDATE users SET status=? WHERE id=?').run(status, u.id);
    if (status === 'suspended') db.prepare('DELETE FROM sessions WHERE user_id=?').run(u.id);
    audit(ctx, status === 'suspended' ? 'suspend' : 'reactivate', 'user', u.id, { email: u.email }); return { ok: true };
  }));
  r.del('/api/admin/users/:id', A((ctx) => {
    const u = db.prepare('SELECT * FROM users WHERE id=?').get(+ctx.params.id); if (!u) throw new HttpError(404, 'Utilisateur introuvable.');
    if (u.role === 'admin') throw bad('Un compte administrateur ne peut pas être supprimé ici.');
    tx(db, () => { db.prepare('UPDATE reviews SET user_id=NULL, author=? WHERE user_id=?').run('Utilisateur supprimé', u.id); db.prepare('DELETE FROM search_log WHERE user_id=?').run(u.id); db.prepare('DELETE FROM users WHERE id=?').run(u.id); });
    audit(ctx, 'delete-account', 'user', u.id, { reason: u.deletion_requested ? 'demande de suppression' : 'admin' }); return { ok: true };
  }));
  r.get('/api/admin/reports', A(() => ({ reports: db.prepare('SELECT * FROM reports ORDER BY id DESC LIMIT 200').all() })));
  r.put('/api/admin/reports/:id', A((ctx) => { db.prepare('UPDATE reports SET status=? WHERE id=?').run(ctx.body.status === 'open' ? 'open' : 'resolved', +ctx.params.id); audit(ctx, 'report-status', 'report', ctx.params.id, ctx.body); return { ok: true }; }));
  r.get('/api/admin/messages', A(() => ({ messages: db.prepare('SELECT * FROM messages ORDER BY id DESC LIMIT 200').all() })));
  r.get('/api/admin/outbox', A(() => ({ emails: db.prepare('SELECT * FROM email_outbox ORDER BY id DESC LIMIT 100').all() })));

  // ---- Rapprochement produits
  r.get('/api/admin/matches', A((ctx) => ({
    matches: db.prepare('SELECT * FROM matches WHERE status=? ORDER BY confidence').all(ctx.query.status || 'pending').map((m) => ({ ...m, product: cat.productById.get(m.product_id) ? `${cat.productById.get(m.product_id).brand} ${cat.productById.get(m.product_id).name}` : null, merchant: cat.merchantById.get(m.merchant_id)?.name })),
  })));
  r.post('/api/admin/matches/:id', A((ctx) => {
    const m = db.prepare('SELECT * FROM matches WHERE id=?').get(+ctx.params.id); if (!m) throw new HttpError(404, 'Rapprochement introuvable.');
    const status = ctx.body.decision === 'validate' ? 'validated' : 'rejected';
    db.prepare('UPDATE matches SET status=?, product_id=COALESCE(?,product_id) WHERE id=?').run(status, ctx.body.productId ? +ctx.body.productId : null, m.id);
    audit(ctx, `match-${status}`, 'match', m.id, { title: m.feed_title }); return { ok: true };
  }));
  r.get('/api/admin/audit', A((ctx) => ({ entries: db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT ?').all(Math.min(500, +ctx.query.limit || 100)) })));
  r.get('/api/admin/ingredients', A(() => ({ ingredients: INGREDIENTS.map((i) => i.name) })));
  void eanFor;
}

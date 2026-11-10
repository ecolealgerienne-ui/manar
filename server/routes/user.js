import { HttpError, bad } from '../lib/http.js';
import { hashPassword, verifyPassword, validatePassword, validEmail, newToken, hashToken } from '../lib/auth.js';
import { checkAlerts, recommend } from '../lib/services.js';
import { tx } from '../db.js';

const SESSION_MS = 14 * 86400000;
const DUMMY_HASH = hashPassword('dummy-password-for-timing');

const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name, role: u.role, profile: JSON.parse(u.profile || '{}'), createdAt: u.created_at, deletionRequested: u.deletion_requested });

// Nettoyage et validation du profil beauté (tout est facultatif)
export function sanitizeProfile(p = {}) {
  const arr = (a, n = 30, len = 60) => (Array.isArray(a) ? a.map((x) => String(x).slice(0, len)).slice(0, n) : []);
  const s = (x, len = 40) => (x == null || x === '' ? null : String(x).slice(0, len));
  const n = (x, lo, hi) => { const v = Number(x); return Number.isFinite(v) && v >= lo && v <= hi ? v : null; };
  const pf = p.parfum || {}, sk = p.skincare || {}, mk = p.maquillage || {}, hr = p.cheveux || {};
  return {
    consentPerso: p.consentPerso !== false,
    parfum: { familles: arr(pf.familles), notesAimees: arr(pf.notesAimees), notesEvitees: arr(pf.notesEvitees), intensite: n(pf.intensite, 1, 5), possedes: arr(pf.possedes, 30, 100), marques: arr(pf.marques), budget: n(pf.budget, 5, 2000) },
    skincare: { peau: s(sk.peau), preoccupations: arr(sk.preoccupations), actifsRecherches: arr(sk.actifsRecherches), actifsEvites: arr(sk.actifsEvites), produits: arr(sk.produits) },
    maquillage: { categories: arr(mk.categories), teintes: arr(mk.teintes), finitions: arr(mk.finitions), marques: arr(mk.marques), budget: n(mk.budget, 5, 2000) },
    cheveux: { type: s(hr.type), texture: s(hr.texture), besoins: arr(hr.besoins), produits: arr(hr.produits) },
  };
}

export function registerUser(r, { db, cat, nowIso, limiters, secureCookie }) {
  const setCookie = (ctx, token, maxAge) => {
    ctx.res.setHeader('Set-Cookie', `vsid=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secureCookie(ctx.req) ? '; Secure' : ''}`);
  };
  const startSession = (ctx, userId) => {
    const token = newToken();
    db.prepare('INSERT INTO sessions (token_hash,user_id,expires) VALUES (?,?,?)').run(hashToken(token), userId, Date.now() + SESSION_MS);
    setCookie(ctx, token, SESSION_MS / 1000);
  };
  const defaultList = (uid) => {
    let l = db.prepare('SELECT * FROM lists WHERE user_id=? AND is_default=1').get(uid);
    if (!l) { const x = db.prepare('INSERT INTO lists (user_id,name,is_default,created_at) VALUES (?,?,1,?)').run(uid, 'Favoris', nowIso()); l = { id: Number(x.lastInsertRowid) }; }
    return l;
  };

  r.post('/api/auth/register', (ctx) => {
    if (!limiters.auth(ctx.ip)) throw new HttpError(429, 'Trop de tentatives. Réessayez plus tard.');
    const { email, password, name } = ctx.body;
    const e = String(email || '').trim().toLowerCase();
    if (!validEmail(e)) throw bad('Adresse email invalide.', { field: 'email' });
    const pe = validatePassword(password); if (pe) throw bad(pe, { field: 'password' });
    if (name && String(name).length > 80) throw bad('Nom trop long.', { field: 'name' });
    if (ctx.body.acceptTerms !== true) throw bad('Vous devez accepter les conditions d’utilisation.', { field: 'acceptTerms' });
    if (db.prepare('SELECT 1 FROM users WHERE email=?').get(e)) throw bad('Un compte existe déjà avec cette adresse.', { field: 'email' });
    const profile = sanitizeProfile({ ...(ctx.body.profile || {}), consentPerso: ctx.body.consentPerso === true });
    const res = db.prepare('INSERT INTO users (email,pw_hash,name,profile,created_at) VALUES (?,?,?,?,?)').run(e, hashPassword(password), name ? String(name).trim() : null, JSON.stringify(profile), nowIso());
    const uid = Number(res.lastInsertRowid);
    defaultList(uid);
    startSession(ctx, uid);
    return publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(uid));
  });

  r.post('/api/auth/login', (ctx) => {
    if (!limiters.auth(ctx.ip)) throw new HttpError(429, 'Trop de tentatives. Réessayez plus tard.');
    const e = String(ctx.body.email || '').trim().toLowerCase();
    const u = db.prepare('SELECT * FROM users WHERE email=?').get(e);
    const generic = new HttpError(401, 'Identifiants incorrects.');
    if (!u) { verifyPassword(String(ctx.body.password || ''), DUMMY_HASH); throw generic; }
    if (u.locked_until > Date.now()) throw new HttpError(429, 'Compte temporairement verrouillé après plusieurs échecs. Réessayez dans quelques minutes.');
    if (!verifyPassword(String(ctx.body.password || ''), u.pw_hash)) {
      const f = u.failed_logins + 1;
      db.prepare('UPDATE users SET failed_logins=?, locked_until=? WHERE id=?').run(f >= 5 ? 0 : f, f >= 5 ? Date.now() + 15 * 60000 : 0, u.id);
      throw generic;
    }
    if (u.status !== 'active') throw new HttpError(403, 'Ce compte est suspendu. Contactez-nous pour plus d’informations.');
    db.prepare('UPDATE users SET failed_logins=0, locked_until=0 WHERE id=?').run(u.id);
    startSession(ctx, u.id);
    return publicUser(u);
  });
  r.post('/api/auth/logout', (ctx) => {
    if (ctx.sessionToken) db.prepare('DELETE FROM sessions WHERE token_hash=?').run(hashToken(ctx.sessionToken));
    setCookie(ctx, '', 0);
    return { ok: true };
  });

  r.get('/api/me', (ctx) => ({ user: ctx.user ? publicUser(ctx.user) : null }));
  r.put('/api/me', (ctx) => {
    const u = ctx.requireUser();
    const name = ctx.body.name != null ? String(ctx.body.name).trim().slice(0, 80) : u.name;
    const profile = ctx.body.profile ? sanitizeProfile(ctx.body.profile) : JSON.parse(u.profile || '{}');
    if (ctx.body.profile && profile.consentPerso === false) db.prepare('DELETE FROM search_log WHERE user_id=?').run(u.id);
    db.prepare('UPDATE users SET name=?, profile=? WHERE id=?').run(name, JSON.stringify(profile), u.id);
    return publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(u.id));
  });
  r.put('/api/me/password', (ctx) => {
    const u = ctx.requireUser();
    if (!verifyPassword(String(ctx.body.current || ''), u.pw_hash)) throw bad('Mot de passe actuel incorrect.', { field: 'current' });
    const pe = validatePassword(ctx.body.password); if (pe) throw bad(pe, { field: 'password' });
    db.prepare('UPDATE users SET pw_hash=? WHERE id=?').run(hashPassword(ctx.body.password), u.id);
    db.prepare('DELETE FROM sessions WHERE user_id=? AND token_hash<>?').run(u.id, hashToken(ctx.sessionToken));
    return { ok: true };
  });
  r.get('/api/me/export', (ctx) => {
    const u = ctx.requireUser();
    const q = (sql) => db.prepare(sql).all(u.id);
    return { exportedAt: nowIso(), user: publicUser(u), lists: q('SELECT * FROM lists WHERE user_id=?'), listItems: q('SELECT li.* FROM list_items li JOIN lists l ON l.id=li.list_id WHERE l.user_id=?'), alerts: q('SELECT * FROM alerts WHERE user_id=?'), baskets: q('SELECT * FROM baskets WHERE user_id=?'), searches: q('SELECT q,results,at FROM search_log WHERE user_id=?'), notifications: q('SELECT kind,message,created_at FROM notifications WHERE user_id=?'), reviews: q('SELECT product_id,rating,text,created_at FROM reviews WHERE user_id=?') };
  });
  r.del('/api/me', (ctx) => {
    const u = ctx.requireUser();
    if (u.role === 'admin') throw new HttpError(403, 'Un compte administrateur ne peut pas être supprimé ici.');
    if (!verifyPassword(String(ctx.body.password || ''), u.pw_hash)) throw bad('Mot de passe incorrect.', { field: 'password' });
    tx(db, () => {
      db.prepare('DELETE FROM search_log WHERE user_id=?').run(u.id);
      db.prepare('UPDATE reviews SET user_id=NULL, author=? WHERE user_id=?').run('Utilisateur supprimé', u.id);
      db.prepare('DELETE FROM email_outbox WHERE user_id=?').run(u.id);
      db.prepare('DELETE FROM users WHERE id=?').run(u.id);
    });
    setCookie(ctx, '', 0);
    return { ok: true };
  });
  r.post('/api/me/deletion-request', (ctx) => {
    const u = ctx.requireUser();
    db.prepare('UPDATE users SET deletion_requested=? WHERE id=?').run(nowIso(), u.id);
    return { ok: true };
  });
  r.del('/api/me/search-history', (ctx) => { const u = ctx.requireUser(); db.prepare('DELETE FROM search_log WHERE user_id=?').run(u.id); return { ok: true }; });

  // ---------- Listes / favoris
  const itemCard = (productId) => {
    const p = cat.productById.get(productId); if (!p) return null;
    return { ...cat.card(p), formats: p.formats.map((f) => ({ id: f.id, label: f.label })), onPromo: p.summary.maxDiscount > 0 };
  };
  const listsOf = (uid) => db.prepare('SELECT * FROM lists WHERE user_id=? ORDER BY is_default DESC, id').all(uid).map((l) => ({
    id: l.id, name: l.name, isDefault: !!l.is_default,
    items: db.prepare('SELECT product_id FROM list_items WHERE list_id=? ORDER BY added_at DESC').all(l.id).map((x) => itemCard(x.product_id)).filter(Boolean),
  }));
  r.get('/api/lists', (ctx) => { const u = ctx.requireUser(); defaultList(u.id); return { lists: listsOf(u.id) }; });
  r.post('/api/lists', (ctx) => {
    const u = ctx.requireUser(); const name = String(ctx.body.name || '').trim();
    if (!name || name.length > 60) throw bad('Nom de liste requis (60 caractères max).');
    if (db.prepare('SELECT COUNT(*) c FROM lists WHERE user_id=?').get(u.id).c >= 30) throw bad('Nombre maximal de listes atteint.');
    const x = db.prepare('INSERT INTO lists (user_id,name,created_at) VALUES (?,?,?)').run(u.id, name, nowIso());
    return { id: Number(x.lastInsertRowid) };
  });
  const ownList = (ctx) => { const u = ctx.requireUser(); const l = db.prepare('SELECT * FROM lists WHERE id=? AND user_id=?').get(+ctx.params.id, u.id); if (!l) throw new HttpError(404, 'Liste introuvable.'); return l; };
  r.put('/api/lists/:id', (ctx) => { const l = ownList(ctx); const name = String(ctx.body.name || '').trim(); if (!name || name.length > 60) throw bad('Nom de liste requis.'); db.prepare('UPDATE lists SET name=? WHERE id=?').run(name, l.id); return { ok: true }; });
  r.del('/api/lists/:id', (ctx) => { const l = ownList(ctx); if (l.is_default) throw bad('La liste Favoris ne peut pas être supprimée.'); db.prepare('DELETE FROM lists WHERE id=?').run(l.id); return { ok: true }; });
  r.post('/api/lists/:id/items', (ctx) => {
    const l = ownList(ctx); const pid = +ctx.body.productId;
    if (!cat.productById.has(pid)) throw bad('Produit inconnu.');
    db.prepare('INSERT OR IGNORE INTO list_items (list_id,product_id,added_at) VALUES (?,?,?)').run(l.id, pid, nowIso());
    return { ok: true };
  });
  r.del('/api/lists/:id/items/:pid', (ctx) => { const l = ownList(ctx); db.prepare('DELETE FROM list_items WHERE list_id=? AND product_id=?').run(l.id, +ctx.params.pid); return { ok: true }; });
  r.post('/api/favorites/toggle', (ctx) => {
    const u = ctx.requireUser(); const pid = +ctx.body.productId;
    if (!cat.productById.has(pid)) throw bad('Produit inconnu.');
    const l = defaultList(u.id);
    const ex = db.prepare('SELECT 1 FROM list_items WHERE list_id=? AND product_id=?').get(l.id, pid);
    if (ex) db.prepare('DELETE FROM list_items WHERE list_id=? AND product_id=?').run(l.id, pid);
    else db.prepare('INSERT INTO list_items (list_id,product_id,added_at) VALUES (?,?,?)').run(l.id, pid, nowIso());
    return { favorite: !ex };
  });
  r.get('/api/favorites/ids', (ctx) => {
    const u = ctx.requireUser();
    return { ids: db.prepare('SELECT DISTINCT li.product_id id FROM list_items li JOIN lists l ON l.id=li.list_id WHERE l.user_id=? AND l.is_default=1').all(u.id).map((x) => x.id) };
  });
  r.post('/api/favorites/merge', (ctx) => {
    const u = ctx.requireUser(); const l = defaultList(u.id);
    for (const id of (Array.isArray(ctx.body.productIds) ? ctx.body.productIds.slice(0, 200) : []).map(Number)) if (cat.productById.has(id)) db.prepare('INSERT OR IGNORE INTO list_items (list_id,product_id,added_at) VALUES (?,?,?)').run(l.id, id, nowIso());
    return { ok: true };
  });

  // ---------- Paniers enregistrés
  r.get('/api/baskets', (ctx) => { const u = ctx.requireUser(); return { baskets: db.prepare('SELECT id,name,items,updated_at FROM baskets WHERE user_id=? ORDER BY updated_at DESC').all(u.id).map((b) => ({ ...b, items: JSON.parse(b.items) })) }; });
  r.post('/api/baskets', (ctx) => {
    const u = ctx.requireUser();
    const items = (Array.isArray(ctx.body.items) ? ctx.body.items : []).slice(0, 20).map((i) => ({ formatId: +i.formatId, qty: Math.max(1, Math.min(20, +i.qty || 1)) })).filter((i) => cat.formatById.has(i.formatId));
    if (!items.length) throw bad('Le panier est vide.');
    const name = String(ctx.body.name || 'Mon panier').trim().slice(0, 60) || 'Mon panier';
    if (db.prepare('SELECT COUNT(*) c FROM baskets WHERE user_id=?').get(u.id).c >= 20) throw bad('Nombre maximal de paniers atteint.');
    const x = db.prepare('INSERT INTO baskets (user_id,name,items,updated_at) VALUES (?,?,?,?)').run(u.id, name, JSON.stringify(items), nowIso());
    return { id: Number(x.lastInsertRowid) };
  });
  r.del('/api/baskets/:id', (ctx) => { const u = ctx.requireUser(); db.prepare('DELETE FROM baskets WHERE id=? AND user_id=?').run(+ctx.params.id, u.id); return { ok: true }; });

  // ---------- Alertes
  const alertView = (a) => {
    const f = cat.formatById.get(a.format_id); const p = f && cat.productById.get(f.productId); if (!p) return null;
    const mids = JSON.parse(a.merchant_ids || '[]');
    const offers = f.offers.filter((o) => (!mids.length || mids.includes(o.merchantId)));
    const best = offers.filter((o) => o.usable).sort((x, y) => x.price - y.price)[0];
    const bestTrusted = offers.filter((o) => o.trusted).sort((x, y) => x.price - y.price)[0];
    return { id: a.id, active: !!a.active, targetPrice: a.target_price, lastTriggered: a.last_triggered, createdAt: a.created_at, merchantIds: mids,
      product: { id: p.id, slug: p.slug, name: p.name, brand: p.brand, image: `/img/p/${p.slug}.svg` }, format: { id: f.id, label: f.label },
      currentPrice: best?.price ?? null, currentTrustedPrice: bestTrusted?.price ?? null, reached: !!(bestTrusted && bestTrusted.price <= a.target_price) };
  };
  r.get('/api/alerts', (ctx) => { const u = ctx.requireUser(); return { alerts: db.prepare('SELECT * FROM alerts WHERE user_id=? ORDER BY id DESC').all(u.id).map(alertView).filter(Boolean) }; });
  r.post('/api/alerts', (ctx) => {
    const u = ctx.requireUser();
    const f = cat.formatById.get(+ctx.body.formatId); if (!f) throw bad('Format inconnu.', { field: 'formatId' });
    const target = Number(ctx.body.targetPrice);
    if (!(target > 0 && target < 100000)) throw bad('Prix cible invalide.', { field: 'targetPrice' });
    const mids = (Array.isArray(ctx.body.merchantIds) ? ctx.body.merchantIds : []).map(Number).filter((id) => cat.merchantById.has(id));
    if (db.prepare('SELECT COUNT(*) c FROM alerts WHERE user_id=?').get(u.id).c >= 50) throw bad('Nombre maximal d’alertes atteint.');
    const x = db.prepare('INSERT INTO alerts (user_id,product_id,format_id,target_price,merchant_ids,created_at) VALUES (?,?,?,?,?,?)').run(u.id, f.productId, f.id, target, JSON.stringify(mids), nowIso());
    const id = Number(x.lastInsertRowid);
    checkAlerts(db, cat, { alertId: id });
    return alertView(db.prepare('SELECT * FROM alerts WHERE id=?').get(id));
  });
  const ownAlert = (ctx) => { const u = ctx.requireUser(); const a = db.prepare('SELECT * FROM alerts WHERE id=? AND user_id=?').get(+ctx.params.id, u.id); if (!a) throw new HttpError(404, 'Alerte introuvable.'); return a; };
  r.put('/api/alerts/:id', (ctx) => {
    const a = ownAlert(ctx);
    const target = ctx.body.targetPrice != null ? Number(ctx.body.targetPrice) : a.target_price;
    if (!(target > 0 && target < 100000)) throw bad('Prix cible invalide.', { field: 'targetPrice' });
    const active = ctx.body.active != null ? (ctx.body.active ? 1 : 0) : a.active;
    const mids = Array.isArray(ctx.body.merchantIds) ? JSON.stringify(ctx.body.merchantIds.map(Number).filter((id) => cat.merchantById.has(id))) : a.merchant_ids;
    // un nouveau seuil réinitialise la mémoire de notification
    db.prepare('UPDATE alerts SET target_price=?, active=?, merchant_ids=?, last_notified_price=? WHERE id=?').run(target, active, mids, target !== a.target_price || active !== a.active ? null : a.last_notified_price, a.id);
    if (active) checkAlerts(db, cat, { alertId: a.id });
    return alertView(db.prepare('SELECT * FROM alerts WHERE id=?').get(a.id));
  });
  r.del('/api/alerts/:id', (ctx) => { const a = ownAlert(ctx); db.prepare('DELETE FROM alerts WHERE id=?').run(a.id); return { ok: true }; });

  // ---------- Notifications
  r.get('/api/notifications', (ctx) => {
    const u = ctx.requireUser();
    const items = db.prepare('SELECT id,kind,message,link,read,created_at FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 100').all(u.id);
    return { items, unread: items.filter((i) => !i.read).length };
  });
  r.post('/api/notifications/read', (ctx) => { const u = ctx.requireUser(); db.prepare('UPDATE notifications SET read=1 WHERE user_id=?').run(u.id); return { ok: true }; });
  r.del('/api/notifications/:id', (ctx) => { const u = ctx.requireUser(); db.prepare('DELETE FROM notifications WHERE id=? AND user_id=?').run(+ctx.params.id, u.id); return { ok: true }; });
  r.get('/api/notifications/count', (ctx) => ({ unread: ctx.user ? db.prepare('SELECT COUNT(*) c FROM notifications WHERE user_id=? AND read=0').get(ctx.user.id).c : 0 }));

  // ---------- Tableau de bord & recommandations
  r.get('/api/me/dashboard', (ctx) => {
    const u = ctx.requireUser();
    const profile = JSON.parse(u.profile || '{}');
    const lists = listsOf(u.id);
    const favs = lists.flatMap((l) => l.items);
    const catCount = {}, noteCount = {}, brandCount = {};
    for (const f of favs) {
      catCount[f.category] = (catCount[f.category] || 0) + 1; brandCount[f.brand] = (brandCount[f.brand] || 0) + 1;
      for (const n of cat.productById.get(f.id).allNotes) noteCount[n] = (noteCount[n] || 0) + 1;
    }
    const top = (o, n = 6) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([name, count]) => ({ name, count }));
    const searches = profile.consentPerso === false ? [] : db.prepare('SELECT q, MAX(at) at FROM search_log WHERE user_id=? GROUP BY lower(q) ORDER BY at DESC LIMIT 8').all(u.id);
    const alerts = db.prepare('SELECT * FROM alerts WHERE user_id=? ORDER BY id DESC LIMIT 5').all(u.id).map(alertView).filter(Boolean);
    const rec = recommend(db, cat, u, { limit: 8 });
    return {
      user: publicUser(u), favoriteCategories: top(catCount),
      favoriteNotes: [...new Map([...(profile.parfum?.notesAimees || []).map((n) => [n, { name: n, source: 'profil' }]), ...top(noteCount, 6).map((n) => [n.name, { ...n, source: 'favoris' }])]).values()].slice(0, 8),
      favoriteBrands: [...new Set([...(profile.parfum?.marques || []), ...top(brandCount).map((b) => b.name)])].slice(0, 8),
      saved: favs.slice(0, 8), searches, alerts, recommendations: rec,
      unread: db.prepare('SELECT COUNT(*) c FROM notifications WHERE user_id=? AND read=0').get(u.id).c,
    };
  });
  r.get('/api/me/recommendations', (ctx) => recommend(db, cat, ctx.requireUser(), { limit: 24 }));
}

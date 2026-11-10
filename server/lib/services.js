// Services métier : panier multi-boutiques, alertes de prix, recommandations personnalisées.
import { merchantCost, applyCode, round2, shippingFor } from './pricing.js';
import { similarity, findSimilar } from './similarity.js';
import { norm } from './text.js';
import { FAMILIES } from '../data/vocab.js';

const nowIso = () => new Date().toISOString();

// ---------------- Panier ----------------
export function compareBasket(catalog, rawItems, codeStrings = [], now = Date.now()) {
  const items = [];
  for (const it of rawItems.slice(0, 20)) {
    const f = catalog.formatById.get(+it.formatId);
    if (!f) continue;
    const p = catalog.productById.get(f.productId);
    const qty = Math.max(1, Math.min(20, Math.floor(+it.qty || 1)));
    const offers = new Map(f.offers.filter((o) => o.usable).map((o) => [o.merchantId, o]));
    items.push({ formatId: f.id, productId: p.id, slug: p.slug, name: p.name, brand: p.brand, category: p.category, format: f.label, qty, image: `/img/p/${p.slug}.svg`, offers });
  }
  if (!items.length) return { items: [], scenarios: null, warnings: [], codes: [] };

  const merchants = catalog.merchants.filter((m) => m.status === 'active');
  const wanted = new Set(codeStrings.map((c) => String(c).trim().toUpperCase()).filter(Boolean));
  const codeReport = [];
  const codeFor = new Map();
  for (const w of wanted) {
    const code = catalog.codes.find((c) => c.code.toUpperCase() === w);
    if (!code) { codeReport.push({ code: w, valid: false, reason: 'Code inconnu.' }); continue; }
    codeFor.set(code.merchant_id, code);
  }
  const mById = (id) => catalog.merchantById.get(id);

  const lineFor = (item, mid) => {
    const o = item.offers.get(mid);
    return o && { price: o.price, qty: item.qty, category: item.category, offer: o, item };
  };
  const costOf = (assign /* Map mid -> lines[] */) => {
    let total = 0, shipping = 0, discount = 0, subtotal = 0; const parts = [];
    for (const [mid, lines] of assign) {
      const c = merchantCost(mById(mid), lines, codeFor.get(mid), now);
      total += c.total; shipping += c.shipping; discount += c.discount; subtotal += c.subtotal;
      parts.push({ merchantId: mid, merchant: mById(mid).name, merchantType: mById(mid).type, deliveryDays: mById(mid).delivery_days, ...c,
        lines: lines.map((l) => ({ slug: l.item.slug, name: l.item.name, brand: l.item.brand, format: l.item.format, qty: l.qty, unitPrice: l.price, offerId: l.offer.id, status: l.offer.verifiedStatus, fetchedAt: l.offer.fetchedAt })) });
    }
    return { total: round2(total), shipping: round2(shipping), discount: round2(discount), subtotal: round2(subtotal), shops: parts.length, parts };
  };

  // Scénario A : une seule boutique
  const single = [];
  for (const m of merchants) {
    const lines = items.map((i) => lineFor(i, m.id));
    const missing = items.filter((_, k) => !lines[k]).map((i) => `${i.brand} ${i.name} (${i.format})`);
    if (missing.length) { single.push({ merchantId: m.id, merchant: m.name, complete: false, missing }); continue; }
    const c = costOf(new Map([[m.id, lines]]));
    single.push({ merchantId: m.id, merchant: m.name, merchantType: m.type, complete: true, ...c, ...c.parts[0], deliveryDays: m.delivery_days, parts: undefined });
  }
  const complete = single.filter((s) => s.complete).sort((a, b) => a.total - b.total);

  // Scénario B : répartition optimale (exhaustive si l'espace est petit, sinon recherche locale)
  const opts = items.map((i) => [...i.offers.keys()]);
  const unavailable = items.filter((_, k) => !opts[k].length).map((i) => `${i.brand} ${i.name} (${i.format})`);
  let multi = null, exact = true;
  if (!unavailable.length) {
    const space = opts.reduce((a, o) => a * o.length, 1);
    const evalAssign = (choice) => {
      const m = new Map();
      choice.forEach((mid, k) => { if (!m.has(mid)) m.set(mid, []); m.get(mid).push(lineFor(items[k], mid)); });
      return costOf(m);
    };
    let best = null;
    if (space <= 120000) {
      const choice = new Array(items.length);
      const rec = (k) => {
        if (k === items.length) { const c = evalAssign(choice); if (!best || c.total < best.total - 1e-9 || (Math.abs(c.total - best.total) < 1e-9 && c.shops < best.shops)) best = c; return; }
        for (const mid of opts[k]) { choice[k] = mid; rec(k + 1); }
      };
      rec(0);
    } else {
      exact = false;
      let choice = items.map((_, k) => opts[k].reduce((a, b) => (items[k].offers.get(a).price <= items[k].offers.get(b).price ? a : b)));
      best = evalAssign(choice);
      for (let pass = 0; pass < 6; pass++) {
        let improved = false;
        for (let k = 0; k < items.length; k++) for (const mid of opts[k]) {
          if (mid === choice[k]) continue;
          const t = [...choice]; t[k] = mid; const c = evalAssign(t);
          if (c.total < best.total - 1e-9) { best = c; choice = t; improved = true; }
        }
        if (!improved) break;
      }
    }
    multi = best;
  }

  // Résultats
  const cheapest = multi && (!complete[0] || multi.total < complete[0].total) ? { kind: 'multi', ...multi } : complete[0] ? { kind: 'single', ...complete[0] } : multi ? { kind: 'multi', ...multi } : null;
  const practical = complete[0] ? { kind: 'single', ...complete[0] } : cheapest;
  const worstSingle = complete.length ? complete[complete.length - 1].total : null;
  const warnings = [];
  const unverified = new Set();
  for (const part of (cheapest?.parts || (cheapest ? [cheapest] : []))) for (const l of part.lines || []) if (l.status !== 'verified') unverified.add(part.merchant);
  warnings.push('Estimation indicative : les prix, la disponibilité et les frais de livraison doivent être vérifiés sur le site du marchand avant achat. Les totaux ne sont pas garantis.');
  if (unverified.size) warnings.push(`Offres non vérifiées chez : ${[...unverified].join(', ')}.`);
  if (!exact) warnings.push('Le nombre de combinaisons étant élevé, la meilleure répartition est approchée par recherche locale (non prouvée optimale).');
  // codes
  for (const [mid, code] of codeFor) {
    const lines = items.map((i) => lineFor(i, mid)).filter(Boolean);
    const ap = lines.length ? applyCode(code, lines, now) : { applied: false, reason: 'Aucun produit du panier chez ce marchand.' };
    codeReport.push({ code: code.code, merchant: mById(mid).name, valid: ap.applied, reason: ap.reason || null, conditions: code.conditions, minAmount: code.min_amount, discount: ap.discount, freeShip: ap.freeShip });
  }
  const availableCodes = catalog.codes.filter((c) => c.active && (!c.expires_at || Date.parse(c.expires_at) > now) && !wanted.has(c.code.toUpperCase()))
    .map((c) => ({ code: c.code, merchant: mById(c.merchant_id)?.name, conditions: c.conditions, minAmount: c.min_amount, type: c.type, value: c.value }));

  return {
    items: items.map(({ offers, ...i }) => ({ ...i, availableAt: offers.size })),
    scenarios: {
      single: single.map((s) => ({ ...s, lines: s.lines })),
      multi: multi ? { ...multi, exact } : null,
      unavailable,
    },
    summary: cheapest && {
      cheapest: { kind: cheapest.kind, total: cheapest.total, shops: cheapest.shops ?? 1, shipping: cheapest.shipping, discount: cheapest.discount, merchant: cheapest.merchant },
      practical: practical && { kind: practical.kind, total: practical.total, shops: practical.shops ?? 1, shipping: practical.shipping, merchant: practical.merchant },
      savingsVsWorstSingle: worstSingle != null ? round2(worstSingle - cheapest.total) : null,
      differenceBetweenScenarios: multi && complete[0] ? round2(complete[0].total - multi.total) : null,
      bestSingleTotal: complete[0]?.total ?? null,
      multiTotal: multi?.total ?? null,
    },
    codes: codeReport, availableCodes, warnings,
  };
}

// ---------------- Alertes ----------------
export function checkAlerts(db, catalog, { alertId } = {}) {
  const alerts = alertId ? db.prepare('SELECT * FROM alerts WHERE id=? AND active=1').all(alertId) : db.prepare('SELECT * FROM alerts WHERE active=1').all();
  let sent = 0;
  for (const a of alerts) {
    const f = catalog.formatById.get(a.format_id); if (!f) continue;
    const mids = JSON.parse(a.merchant_ids || '[]');
    // uniquement les offres VÉRIFIÉES, disponibles, non expirées, non périmées
    const ok = f.offers.filter((o) => o.trusted && o.price <= a.target_price && (!mids.length || mids.includes(o.merchantId))).sort((x, y) => x.price - y.price)[0];
    if (!ok) continue;
    if (a.last_notified_price != null && ok.price >= a.last_notified_price) continue;
    const p = catalog.productById.get(f.productId);
    const user = db.prepare('SELECT id,email FROM users WHERE id=?').get(a.user_id);
    if (!user) continue;
    const msg = `${p.brand} ${p.name} (${f.label}) est à ${ok.price.toFixed(2).replace('.', ',')} € chez ${ok.merchant.name}, sous votre seuil de ${a.target_price.toFixed(2).replace('.', ',')} €. Offre vérifiée le ${new Date(ok.fetchedAt).toLocaleDateString('fr-FR')}.`;
    db.prepare('INSERT INTO notifications (user_id,kind,message,link,created_at) VALUES (?,?,?,?,?)').run(a.user_id, 'alert', msg, `/produit/${p.slug}`, nowIso());
    db.prepare('INSERT INTO email_outbox (user_id,to_email,subject,body,created_at) VALUES (?,?,?,?,?)').run(a.user_id, user.email, `MANOU — alerte de prix : ${p.name}`, msg, nowIso());
    db.prepare('UPDATE alerts SET last_triggered=?, last_notified_price=? WHERE id=?').run(nowIso(), ok.price, a.id);
    sent++;
  }
  return sent;
}

// ---------------- Recommandations ----------------
export function recommend(db, catalog, user, { limit = 12 } = {}) {
  const profile = JSON.parse(user.profile || '{}');
  const favIds = db.prepare('SELECT DISTINCT li.product_id id FROM list_items li JOIN lists l ON l.id=li.list_id WHERE l.user_id=?').all(user.id).map((r) => r.id);
  const favs = favIds.map((id) => catalog.productById.get(id)).filter(Boolean);
  const pp = profile.parfum || {}, ps = profile.skincare || {}, pm = profile.maquillage || {}, ph = profile.cheveux || {};
  const prefFam = pp.familles || [], likedNotes = (pp.notesAimees || []).map(norm), avoided = (pp.notesEvitees || []).map(norm);
  const brandsPref = new Set([...(pp.marques || []), ...(pm.marques || [])].map(norm));
  favs.forEach((f) => brandsPref.add(norm(f.brand)));
  const hasProfile = !!(prefFam.length || likedNotes.length || pp.marques?.length || ps.peau || ps.actifsRecherches?.length || pm.categories?.length || ph.type || favs.length);
  const scored = [];
  for (const p of catalog.products) {
    if (p.summary.minPrice == null) continue;
    if (favIds.includes(p.id)) continue;
    const reasons = []; let s = 0;
    if (p.category === 'parfum') {
      if (avoided.some((n) => p.allNotes.some((x) => norm(x) === n))) continue;
      const fam = p.families.filter((f) => prefFam.includes(f));
      if (fam.length) { s += 30 * fam.length / Math.max(1, prefFam.length); reasons.push(`Famille appréciée : ${fam.map((f) => FAMILIES.find((x) => x.id === f).name.toLowerCase()).join(', ')}`); }
      const nt = p.allNotes.filter((x) => likedNotes.includes(norm(x)));
      if (nt.length) { s += 35 * nt.length / Math.max(1, likedNotes.length); reasons.push(`Contient vos notes favorites : ${nt.join(', ').toLowerCase()}`); }
      if (pp.intensite && p.intensity) { const d = 1 - Math.abs(p.intensity - pp.intensite) / 4; s += 8 * d; if (d >= 0.75) reasons.push('Intensité proche de votre préférence'); }
      if (pp.budget) { if (p.summary.minPrice <= pp.budget) { s += 8; reasons.push(`Dans votre budget (≤ ${pp.budget} €)`); } else s -= 15; }
    } else if (p.category === 'skincare') {
      if (ps.peau && p.skin.includes(ps.peau)) { s += 15; reasons.push(`Indiqué par le fabricant pour peau ${ps.peau}`); }
      const act = p.actives.filter((a) => (ps.actifsRecherches || []).map(norm).includes(norm(a)));
      if (act.length) { s += 30; reasons.push(`Contient : ${act.join(', ').toLowerCase()}`); }
      if (p.actives.some((a) => (ps.actifsEvites || []).map(norm).includes(norm(a)))) continue;
    } else if (p.category === 'maquillage') {
      if ((pm.categories || []).map(norm).includes(norm(p.sub))) { s += 25; reasons.push(`Catégorie préférée : ${p.sub}`); }
      if ((pm.finitions || []).includes(p.finish)) { s += 15; reasons.push(`Finition appréciée : ${p.finish}`); }
    } else if (p.category === 'cheveux') {
      if (ph.type && p.hair.includes(ph.type)) { s += 25; reasons.push(`Pour cheveux ${ph.type}`); }
    }
    if (brandsPref.has(norm(p.brand))) { s += 15; reasons.push(`Marque appréciée : ${p.brand}`); }
    // alternatives aux favoris
    let bestSim = 0, simTo = null;
    for (const f of favs) { const sm = similarity(f, p); if (sm && sm.score > bestSim) { bestSim = sm.score; simTo = f; } }
    if (bestSim >= 55) { s += bestSim * 0.4; reasons.push(`Proche de votre favori ${simTo.name} (score indicatif ${bestSim} %)`); }
    if (s > 0 && reasons.length) scored.push({ p, s, reasons });
  }
  scored.sort((a, b) => b.s - a.s);
  const card = (x) => ({ ...catalog.card(x.p), reasons: x.reasons, score: Math.round(x.s) });
  const products = scored.slice(0, limit).map(card);
  const newcomers = scored.filter((x) => (x.p.year || 0) >= 2018 || x.p.id > catalog.products.length - 80).slice(0, 6).map(card);
  const promos = scored.filter((x) => x.p.summary.maxDiscount >= 15 && brandsPref.has(norm(x.p.brand))).slice(0, 6).map(card);
  const alternatives = [];
  for (const f of favs.slice(0, 4)) {
    const alt = findSimilar(catalog, f, { cheaper: true, limit: 2, minScore: 45 });
    for (const a of alt) alternatives.push({ ...a.product, reasons: [`Alternative à ${f.name} : ${a.similarity.summary}`], score: a.similarity.score });
  }
  return { hasProfile, products, newcomers, promos, alternatives };
}
export { shippingFor };

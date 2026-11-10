import { HttpError, bad } from '../lib/http.js';
import { FAMILIES, NOTES, NOTE_GROUPS, CATEGORIES, SUBCATEGORIES, SKIN_TYPES, HAIR_TYPES, SEASONS, OCCASIONS, CONCENTRATIONS, INGREDIENTS, GUIDES, FAQ } from '../data/vocab.js';
import { PAGES } from '../data/pages.js';
import { runSearch, suggest, perfumeFinder } from '../lib/search.js';
import { findSimilar, similarity, genderName } from '../lib/similarity.js';
import { historyStats, round2 } from '../lib/pricing.js';
import { compareBasket } from '../lib/services.js';
import { norm } from '../lib/text.js';

const POPULAR_DEFAULT = ['Dior Sauvage', 'Parfum vanillé musqué moins de 100 €', 'Crème hydratante acide hyaluronique', 'Fond de teint couvrance légère', 'Parfum similaire à Baccarat Rouge 540', 'Parfum floral sans rose'];

export function registerPublic(r, { db, cat, nowIso }) {
  const popularSearches = () => {
    const rows = db.prepare("SELECT q, COUNT(*) c FROM search_log WHERE results>0 AND at > ? GROUP BY lower(q) ORDER BY c DESC LIMIT 6").all(new Date(Date.now() - 30 * 86400000).toISOString()).map((x) => x.q);
    return [...new Set([...rows, ...POPULAR_DEFAULT])].slice(0, 6);
  };

  r.get('/api/meta', () => ({
    families: FAMILIES, noteGroups: NOTE_GROUPS, notes: NOTES.map((n) => ({ name: n.name, group: n.group })), categories: CATEGORIES.filter((c, i, a) => a.findIndex((x) => x.slug === c.slug) === i || true),
    subcategories: SUBCATEGORIES, skinTypes: SKIN_TYPES, hairTypes: HAIR_TYPES, seasons: SEASONS, occasions: OCCASIONS, concentrations: CONCENTRATIONS.map(({ id, name }) => ({ id, name })),
    merchants: cat.merchants.filter((m) => m.status === 'active').map(publicMerchant), brands: cat.brands.map((b) => ({ slug: b.slug, name: b.name })),
    ingredients: INGREDIENTS.map((i) => i.name), demo: true, popularSearches: popularSearches(),
    guides: GUIDES.map(({ slug, title, desc }) => ({ slug, title, desc })),
  }));

  r.get('/api/merchants', () => ({ merchants: cat.merchants.map(publicMerchant) }));

  r.get('/api/search', (ctx) => {
    const res = runSearch(cat, ctx.query, { user: ctx.user });
    if (ctx.query.q && (ctx.query.page || '1') === '1') {
      const uid = ctx.user && JSON.parse(ctx.user.profile || '{}').consentPerso !== false ? ctx.user.id : null;
      db.prepare('INSERT INTO search_log (user_id,q,results,at) VALUES (?,?,?,?)').run(uid, String(ctx.query.q).slice(0, 200), res.total, nowIso());
    }
    return res;
  });
  r.get('/api/suggest', (ctx) => suggest(cat, String(ctx.query.q || '').slice(0, 80), popularSearches()));
  r.get('/api/perfumes/finder', (ctx) => perfumeFinder(cat, ctx.query));

  r.get('/api/home', () => {
    const usable = cat.products.filter((p) => p.summary.minPrice != null);
    const bestOffers = [...usable].filter((p) => p.summary.maxDiscount > 0 && p.summary.trustedAny).sort((a, b) => b.summary.maxDiscount - a.summary.maxDiscount).slice(0, 8).map((p) => cat.card(p));
    const bestPromotions = [...usable].filter((p) => p.deal?.enough && p.deal.score > 0.03).sort((a, b) => b.deal.score - a.deal.score).slice(0, 8)
      .map((p) => ({ ...cat.card(p), dealLabel: p.deal.label, vsAvg: Math.round(p.deal.vsAvg * 100), avg: p.deal.avg, min: p.deal.min }));
    const perfumes = usable.filter((p) => p.category === 'parfum');
    const families = FAMILIES.map((f) => ({ id: f.id, name: f.name, desc: f.desc, count: perfumes.filter((p) => p.families.includes(f.id)).length }));
    const noteCount = {};
    for (const p of perfumes) for (const n of p.allNotes) noteCount[n] = (noteCount[n] || 0) + 1;
    const popularNotes = Object.entries(noteCount).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([name, count]) => ({ name, count }));
    const trending = [...perfumes].sort((a, b) => b.popularity - a.popularity).slice(0, 8).map((p) => cat.card(p));
    const newcomers = [...perfumes].sort((a, b) => (b.year || 0) - (a.year || 0) || b.id - a.id).slice(0, 8).map((p) => cat.card(p));
    const brandCount = {};
    for (const p of cat.products) brandCount[p.brandSlug] = (brandCount[p.brandSlug] || 0) + 1;
    const popularBrands = cat.brands.map((b) => ({ slug: b.slug, name: b.name, count: brandCount[b.slug] || 0, fictional: !!b.fictional })).filter((b) => !b.fictional).sort((a, b) => b.count - a.count).slice(0, 12);
    const catCounts = {};
    for (const p of cat.products) catCounts[p.category] = (catCounts[p.category] || 0) + 1;
    return { bestOffers, bestPromotions, families, popularNotes, trending, newcomers, popularBrands, catCounts, lastUpdate: usable.map((p) => p.summary.lastFetched).filter(Boolean).sort().pop() };
  });

  // -------- Produit
  r.get('/api/products/:slug', (ctx) => {
    const p = cat.productBySlug.get(ctx.params.slug);
    if (!p) throw new HttpError(404, 'Produit introuvable.');
    db.prepare('INSERT INTO product_views (product_id,at) VALUES (?,?)').run(p.id, nowIso());
    return productDetail(p);
  });

  function productDetail(p) {
    const formats = p.formats.map((f) => {
      const hist = cat.history(f.id, 365);
      const usable = f.offers.filter((o) => o.usable);
      const best = usable[0] || null;
      return {
        id: f.id, label: f.label, size: f.size, unit: f.unit, ean: f.ean,
        offers: f.offers.map((o) => ({ ...o, merchantName: o.merchant.name })),
        best: best && { price: best.price, per100: best.per100, perUnit: best.perUnit, merchant: best.merchant.name, total: best.total },
        history: historyStats(hist.slice(-120), best?.price ?? f.ref),
        historyPoints: hist.length,
      };
    });
    const reviews = db.prepare("SELECT author,rating,text,demo,created_at FROM reviews WHERE product_id=? AND status='published' ORDER BY created_at DESC LIMIT 20").all(p.id);
    const rating = reviews.length ? Math.round((reviews.reduce((s, x) => s + x.rating, 0) / reviews.length) * 10) / 10 : null;
    const cheaper = findSimilar(cat, p, { cheaper: true, limit: 6, minScore: 40 });
    const similar = findSimilar(cat, p, { limit: 8, minScore: 40 });
    return {
      product: {
        id: p.id, slug: p.slug, name: p.name, brand: p.brand, brandSlug: p.brandSlug, category: p.category, sub: p.sub, description: p.description, gender: p.gender, genderName: genderName(p.gender),
        year: p.year, perfumer: p.perfumer, concentration: p.concentration, families: p.families.map((id) => FAMILIES.find((f) => f.id === id)?.name || id), familyIds: p.families,
        accords: p.accords, top: p.top, heart: p.heart, base: p.base, intensity: p.intensity, seasons: p.seasons, occasions: p.occasions, actives: p.actives, skin: p.skin, hair: p.hair, inci: p.inci,
        texture: p.texture, finish: p.finish, coverage: p.coverage, shades: p.shades, image: `/img/p/${p.slug}.svg`, imageSource: p.imageSource, source: p.source, demo: p.demo, verified: p.verified,
      },
      formats, valueCompare: valueCompare(p, formats), reviews, rating, similar, cheaper,
      deal: p.deal, summary: p.summary,
      priceTypes: {
        announced: 'Prix annoncé par le marchand (offre en cours).',
        observed: 'Prix historiquement observé par MANOU (relevés enregistrés ; ici fictifs en démonstration).',
        reference: 'Prix de référence annoncé par le marchand dans sa promotion (non vérifié par MANOU).',
      },
    };
  }

  function valueCompare(p, formats) {
    const all = [];
    for (const f of formats) {
      const avg = f.history?.enough ? f.history.avg : null;
      for (const o of f.offers) if (o.usable) all.push({ ...o, formatLabel: f.label, formatId: f.id, histAvg: avg });
    }
    if (!all.length) return null;
    const pick = (cmp) => all.reduce((a, b) => (cmp(b) < cmp(a) ? b : a));
    const mk = (o) => ({ offerId: o.id, merchant: o.merchantName, format: o.formatLabel, price: o.price, total: o.total, per100: o.per100, perUnit: o.perUnit, url: o.url,
      savings: { announcedAbs: o.priceOrig ? round2(o.priceOrig - o.price) : null, announcedPct: o.discount || null, vsHistoryAvgAbs: o.histAvg ? round2(o.histAvg - o.price) : null, vsHistoryAvgPct: o.histAvg ? Math.round(((o.histAvg - o.price) / o.histAvg) * 100) : null } });
    const worstUnit = Math.max(...all.filter((o) => o.perUnit != null).map((o) => o.perUnit));
    const cheapest = pick((o) => o.price), unit = pick((o) => o.perUnit ?? Infinity), final = pick((o) => o.total);
    const withHist = all.filter((o) => o.histAvg);
    const hist = withHist.length ? withHist.reduce((a, b) => ((b.histAvg - b.price) / b.histAvg > (a.histAvg - a.price) / a.histAvg ? b : a)) : null;
    // meilleur format : prix unitaire le plus bas par format
    const byFormat = formats.filter((f) => f.best).map((f) => ({ format: f.label, formatId: f.id, perUnit: f.best.perUnit, per100: f.best.per100, price: f.best.price }));
    const bestFormat = byFormat.length ? byFormat.reduce((a, b) => (b.perUnit < a.perUnit ? b : a)) : null;
    const base = byFormat.length ? byFormat[0] : null;
    return {
      cheapest: mk(cheapest), bestUnit: mk(unit), bestFinal: mk(final), bestHistorical: hist ? mk(hist) : null,
      bestFormat: bestFormat && { ...bestFormat, savingVsSmallestPct: base && base.perUnit ? Math.round(((base.perUnit - bestFormat.perUnit) / base.perUnit) * 100) : 0 },
      formats: byFormat.map((f) => ({ ...f, vsSmallestPct: base ? Math.round(((f.perUnit - base.perUnit) / base.perUnit) * 100) : 0 })),
      unitSavingPct: worstUnit && unit.perUnit != null ? Math.round(((worstUnit - unit.perUnit) / worstUnit) * 100) : 0,
      note: 'Économie unitaire (prix au ml), réduction affichée (prix de référence du marchand) et économie vs historique observé sont trois notions distinctes.',
    };
  }

  r.get('/api/products/:slug/history', (ctx) => {
    const p = cat.productBySlug.get(ctx.params.slug);
    if (!p) throw new HttpError(404, 'Produit introuvable.');
    const f = p.formats.find((x) => x.id === +ctx.query.format) || p.formats[p.formats.length - 1];
    if (!f) throw new HttpError(404, 'Format introuvable.');
    const days = [7, 30, 90, 180, 365].includes(+ctx.query.period) ? +ctx.query.period : 30;
    const pts = cat.history(f.id, days);
    const best = f.offers.find((o) => o.usable);
    const cur = best?.price ?? null;
    const stats = pts.length ? { min: Math.min(...pts.map((x) => x.price)), max: Math.max(...pts.map((x) => x.price)), avg: round2(pts.reduce((s, x) => s + x.price, 0) / pts.length), last: pts.at(-1).day, count: pts.length } : null;
    return {
      format: { id: f.id, label: f.label }, period: days, points: pts, stats, current: cur,
      demo: pts.length > 0, notice: pts.length ? 'Historique fictif généré pour la démonstration : ce ne sont pas des relevés réels.' : 'Pas encore d’historique : ce produit vient d’être ajouté. MANOU n’invente pas de données.',
      referencePrice: best?.priceOrig ?? null,
    };
  });

  r.get('/api/products/:slug/similar', (ctx) => {
    const p = cat.productBySlug.get(ctx.params.slug);
    if (!p) throw new HttpError(404, 'Produit introuvable.');
    const maxPrice = ctx.query.maxPrice ? +ctx.query.maxPrice : undefined;
    return { product: cat.card(p), items: findSimilar(cat, p, { cheaper: ctx.query.cheaper === '1', limit: 24, minScore: +ctx.query.minScore || 30, maxPrice }), method: 'Score indicatif (0–100 %) calculé à partir de critères affichés ; ce n’est pas une mesure scientifique et un produit similaire n’est jamais une copie.' };
  });
  r.get('/api/compare/:a/:b', (ctx) => {
    const a = cat.productBySlug.get(ctx.params.a), b = cat.productBySlug.get(ctx.params.b);
    if (!a || !b) throw new HttpError(404, 'Produit introuvable.');
    return { a: cat.card(a), b: cat.card(b), similarity: similarity(a, b) };
  });

  r.post('/api/products/:slug/reviews', (ctx) => {
    const u = ctx.requireUser();
    const p = cat.productBySlug.get(ctx.params.slug);
    if (!p) throw new HttpError(404, 'Produit introuvable.');
    const rating = Math.round(+ctx.body.rating), text = String(ctx.body.text || '').trim();
    if (!(rating >= 1 && rating <= 5)) throw bad('Note comprise entre 1 et 5 requise.');
    if (text.length < 10 || text.length > 1000) throw bad('Votre avis doit contenir entre 10 et 1000 caractères.');
    db.prepare('INSERT INTO reviews (product_id,user_id,author,rating,text,demo,created_at) VALUES (?,?,?,?,?,0,?)').run(p.id, u.id, (u.name || 'Utilisateur').slice(0, 40), rating, text, nowIso());
    return { ok: true };
  });

  // -------- Marques
  r.get('/api/brands', (ctx) => {
    const counts = {};
    const cats = {};
    for (const p of cat.products) { counts[p.brandId] = (counts[p.brandId] || 0) + 1; (cats[p.brandId] ||= new Set()).add(p.category); }
    let list = cat.brands.filter((b) => counts[b.id]).map((b) => ({ slug: b.slug, name: b.name, count: counts[b.id], categories: [...cats[b.id]], fictional: !!b.fictional }));
    if (ctx.query.category) list = list.filter((b) => b.categories.includes(ctx.query.category));
    if (ctx.query.letter) list = list.filter((b) => norm(b.name)[0] === norm(ctx.query.letter)[0]);
    if (ctx.query.q) list = list.filter((b) => norm(b.name).includes(norm(ctx.query.q)));
    return { brands: list.sort((a, b) => a.name.localeCompare(b.name, 'fr')) };
  });
  r.get('/api/brands/:slug', (ctx) => {
    const b = cat.brandBySlug.get(ctx.params.slug);
    if (!b) throw new HttpError(404, 'Marque introuvable.');
    const prods = cat.products.filter((p) => p.brandId === b.id);
    const withPrice = prods.filter((p) => p.summary.minPrice != null);
    return {
      brand: { slug: b.slug, name: b.name, description: b.description, fictional: !!b.fictional, logo: `/img/b/${b.slug}.svg` },
      count: prods.length, categories: [...new Set(prods.map((p) => p.category))],
      products: prods.map((p) => cat.card(p)),
      bestOffers: [...withPrice].filter((p) => p.summary.maxDiscount > 0).sort((a, c) => c.summary.maxDiscount - a.summary.maxDiscount).slice(0, 4).map((p) => cat.card(p)),
      newest: [...prods].sort((a, c) => (c.year || 0) - (a.year || 0) || c.id - a.id).slice(0, 4).map((p) => cat.card(p)),
    };
  });

  // -------- Promotions
  r.get('/api/promotions', (ctx) => {
    const q = ctx.query; const now = Date.now();
    const items = [];
    for (const p of cat.products) {
      if (q.category && p.category !== q.category && !(q.category === 'cheveux-corps' && ['cheveux', 'corps'].includes(p.category))) continue;
      if (q.brand && p.brandSlug !== q.brand) continue;
      for (const f of p.formats) for (const o of f.offers) {
        if (!o.priceOrig) continue;
        if (!o.usable && !(q.includeExpired === '1' && o.expired)) continue;
        if (q.merchant && o.merchant.slug !== q.merchant) continue;
        if (q.minDiscount && o.discount < +q.minDiscount) continue;
        if (q.maxPrice && o.price > +q.maxPrice) continue;
        if (q.freeShipping === '1' && o.shipping !== 0) continue;
        if (q.limited === '1' && !o.expiresAt) continue;
        if (q.expiresWithin && !(o.expiresAt && Date.parse(o.expiresAt) - now <= +q.expiresWithin * 86400000 && Date.parse(o.expiresAt) > now)) continue;
        const h = f === p.formats[0] ? null : null; void h;
        items.push({ offerId: o.id, product: cat.card(p), format: f.label, merchant: o.merchant.name, merchantType: o.merchant.type, price: o.price, priceOrig: o.priceOrig, discount: o.discount, shipping: o.shipping, expiresAt: o.expiresAt, expired: o.expired || (o.expiresAt && Date.parse(o.expiresAt) < now), status: o.verifiedStatus, fetchedAt: o.fetchedAt, per100: o.per100, deal: p.deal?.enough ? { label: p.deal.label, vsAvg: Math.round(p.deal.vsAvg * 100) } : null, dealScore: p.deal?.score ?? -1 });
      }
    }
    const sort = q.sort || 'discount';
    items.sort(sort === 'deal' ? (a, b) => b.dealScore - a.dealScore : sort === 'price' ? (a, b) => a.price - b.price : (a, b) => b.discount - a.discount);
    const page = Math.max(1, +q.page || 1);
    return { total: items.length, items: items.slice((page - 1) * 24, page * 24), page };
  });

  r.get('/api/promo-codes', (ctx) => {
    const now = Date.now();
    let list = cat.codes.map((c) => {
      const m = cat.merchantById.get(c.merchant_id);
      const expired = !!(c.expires_at && Date.parse(c.expires_at) < now);
      return { id: c.id, code: c.code, type: c.type, value: c.value, minAmount: c.min_amount, expiresAt: c.expires_at, conditions: c.conditions, categories: JSON.parse(c.categories || '[]'), merchant: m?.name, merchantSlug: m?.slug, merchantType: m?.type, verifiedAt: c.verified_at, expired, active: !!c.active && !expired, freeShipping: c.type === 'freeship' };
    });
    if (ctx.query.merchant) list = list.filter((c) => c.merchantSlug === ctx.query.merchant);
    if (ctx.query.freeShipping === '1') list = list.filter((c) => c.freeShipping);
    if (ctx.query.category) list = list.filter((c) => !c.categories.length || c.categories.includes(ctx.query.category));
    if (ctx.query.includeExpired !== '1') list = list.filter((c) => c.active);
    return { codes: list, notice: 'La validité d’un code et ses conditions doivent être vérifiées sur le site du marchand.' };
  });

  // -------- Ingrédients, guides, pages
  r.get('/api/ingredients', () => ({
    ingredients: INGREDIENTS.map((i) => ({ ...i, products: cat.products.filter((p) => p.actives.includes(i.name)).length })),
    disclaimer: 'Informations documentaires, sans valeur de recommandation médicale. En cas de doute, demandez conseil à un professionnel de santé.',
  }));
  r.get('/api/guides/:slug', (ctx) => { const g = GUIDES.find((x) => x.slug === ctx.params.slug); if (!g) throw new HttpError(404, 'Guide introuvable.'); return g; });
  r.get('/api/pages/:slug', (ctx) => { const p = PAGES[ctx.params.slug]; if (!p) throw new HttpError(404, 'Page introuvable.'); return p; });
  r.get('/api/faq', () => ({ faq: FAQ }));

  r.post('/api/contact', (ctx) => {
    const { name, email, subject, body } = ctx.body;
    if (!name || String(name).length > 100) throw bad('Nom requis.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email || '')) throw bad('Adresse email invalide.');
    if (!body || String(body).length < 10 || String(body).length > 3000) throw bad('Message de 10 à 3000 caractères requis.');
    db.prepare('INSERT INTO messages (name,email,subject,body,created_at) VALUES (?,?,?,?,?)').run(String(name).slice(0, 100), email, String(subject || '').slice(0, 150), String(body), nowIso());
    return { ok: true };
  }, { limit: 'contact' });
  r.post('/api/reports', (ctx) => {
    const msg = String(ctx.body.message || '').trim();
    if (msg.length < 5 || msg.length > 1000) throw bad('Décrivez le problème (5 à 1000 caractères).');
    db.prepare('INSERT INTO reports (user_id,product_id,offer_id,message,created_at) VALUES (?,?,?,?,?)').run(ctx.user?.id ?? null, ctx.body.productId ? +ctx.body.productId : null, ctx.body.offerId ? +ctx.body.offerId : null, msg, nowIso());
    return { ok: true };
  }, { limit: 'contact' });

  // -------- Panier (calcul sans compte)
  r.post('/api/basket/compare', (ctx) => {
    if (!Array.isArray(ctx.body.items)) throw bad('Liste d’articles requise.');
    return compareBasket(cat, ctx.body.items, Array.isArray(ctx.body.codes) ? ctx.body.codes.slice(0, 10) : []);
  });
  r.post('/api/products/lookup', (ctx) => {
    const ids = Array.isArray(ctx.body.ids) ? ctx.body.ids.slice(0, 100).map(Number) : [];
    return { items: ids.map((id) => cat.productById.get(id)).filter(Boolean).map((p) => ({ ...cat.card(p), formats: p.formats.map((f) => ({ id: f.id, label: f.label, best: f.offers.find((o) => o.usable)?.price ?? null })) })) };
  });
}

export function publicMerchant(m) {
  return { id: m.id, slug: m.slug, name: m.name, type: m.type, verified: !!m.verified, lastCheck: m.last_check, criteria: m.criteria, shipFee: m.ship_fee, freeThreshold: m.free_threshold, deliveryDays: m.delivery_days, selected: !!m.selected, status: m.status };
}

// Catalogue en mémoire (produits, marques, marchands, offres) reconstruit depuis SQLite.
import { norm, slugify } from './text.js';
import { offerState, pricePerUnit, pricePer100, shippingFor, discountPct, round2, historyStats } from './pricing.js';

const parse = (s, d = []) => { try { return JSON.parse(s ?? ''); } catch { return d; } };

export class Catalog {
  constructor(db) { this.db = db; this.load(); }

  load() {
    const db = this.db;
    this.brands = db.prepare('SELECT * FROM brands ORDER BY name').all().map((b) => ({ ...b }));
    this.brandById = new Map(this.brands.map((b) => [b.id, b]));
    this.brandBySlug = new Map(this.brands.map((b) => [b.slug, b]));
    this.merchants = db.prepare('SELECT * FROM merchants').all().map((m) => ({ ...m }));
    this.merchantById = new Map(this.merchants.map((m) => [m.id, m]));
    const formats = db.prepare('SELECT * FROM formats ORDER BY size').all();
    const fByProd = new Map();
    this.formatById = new Map();
    for (const f of formats) {
      const o = { id: f.id, productId: f.product_id, size: f.size, unit: f.unit, ean: f.ean, ref: f.ref_price, label: f.unit === 'unité' ? 'Unité' : `${f.size} ${f.unit}`, offers: [] };
      this.formatById.set(f.id, o);
      if (!fByProd.has(f.product_id)) fByProd.set(f.product_id, []);
      fByProd.get(f.product_id).push(o);
    }
    this.products = db.prepare("SELECT * FROM products WHERE status='active'").all().map((p) => {
      const brand = this.brandById.get(p.brand_id);
      const o = {
        id: p.id, slug: p.slug, name: p.name, brandId: p.brand_id, brand: brand.name, brandSlug: brand.slug, category: p.category, sub: p.subcategory,
        description: p.description, gender: p.gender, year: p.year, perfumer: p.perfumer, concentration: p.concentration,
        families: parse(p.families), accords: parse(p.accords), top: parse(p.notes_top), heart: parse(p.notes_heart), base: parse(p.notes_base),
        intensity: p.intensity, seasons: parse(p.seasons), occasions: parse(p.occasions), actives: parse(p.actives), skin: parse(p.skin_types), hair: parse(p.hair_types),
        inci: p.inci, texture: p.texture, finish: p.finish, coverage: p.coverage, shades: parse(p.shades), imageSource: p.image_source, source: p.source,
        verified: !!p.verified, demo: !!p.demo, popularity: p.popularity, createdAt: p.created_at,
        formats: fByProd.get(p.id) || [],
      };
      o.nName = norm(`${brand.name} ${p.name}`);
      o.nameTokens = o.nName.split(' ').filter(Boolean);
      o.allNotes = [...new Set([...o.top, ...o.heart, ...o.base])];
      return o;
    });
    this.productById = new Map(this.products.map((p) => [p.id, p]));
    this.productBySlug = new Map(this.products.map((p) => [p.slug, p]));
    this.loadOffers();
  }

  loadOffers(now = Date.now()) {
    for (const f of this.formatById.values()) f.offers = [];
    const rows = this.db.prepare('SELECT * FROM offers').all();
    for (const o of rows) {
      const f = this.formatById.get(o.format_id); const m = this.merchantById.get(o.merchant_id);
      if (!f || !m) continue;
      f.offers.push(this.decorate(o, f, m, now));
    }
    for (const f of this.formatById.values()) f.offers.sort((a, b) => a.price - b.price);
    for (const p of this.products) this.summarize(p);
    for (const p of this.products) p.deal = this.dealFor(p);
    this.codes = this.db.prepare('SELECT * FROM promo_codes').all();
  }

  decorate(o, f, m, now) {
    const st = offerState(o, m, now);
    const ship = shippingFor(m, o.price);
    return {
      id: o.id, formatId: f.id, merchantId: m.id, merchant: { id: m.id, slug: m.slug, name: m.name, type: m.type, verified: !!m.verified, lastCheck: m.last_check, criteria: m.criteria, deliveryDays: m.delivery_days, selected: !!m.selected, freeThreshold: m.free_threshold, shipFee: m.ship_fee },
      expiresAt: o.expires_at, price: o.price, priceOrig: o.price_orig && o.price_orig > o.price ? o.price_orig : null, discount: discountPct(o.price, o.price_orig),
      available: !!o.available, url: o.url, source: o.source, fetchedAt: o.fetched_at, verifiedStatus: st.status, usable: st.usable, trusted: st.trusted, obsolete: st.obsolete, expired: st.expired, flagged: !!o.flagged, demo: !!o.demo,
      perUnit: pricePerUnit(o.price, f.size), per100: pricePer100(o.price, f.size, f.unit), shipping: ship, total: round2(o.price + ship),
    };
  }

  // Résumé prix d'un produit pour les cartes et le tri
  summarize(p) {
    let best = null; const merchants = new Set(); let maxDiscount = 0, bestUnit = null, anyOffers = 0, staleCount = 0;
    for (const f of p.formats) {
      for (const o of f.offers) {
        anyOffers++;
        if (o.obsolete) { staleCount++; continue; }
        if (!o.usable) continue;
        merchants.add(o.merchantId);
        if (!best || o.price < best.price) best = { ...o, format: f };
        if (o.discount > maxDiscount) maxDiscount = o.discount;
        if (o.perUnit != null && (bestUnit == null || o.perUnit < bestUnit)) bestUnit = o.perUnit;
      }
    }
    p.summary = {
      minPrice: best?.price ?? null, minFormat: best ? best.format.label : null, minFormatId: best?.format.id ?? null, minOfferId: best?.id ?? null,
      priceOrig: best?.priceOrig ?? null, discount: best?.discount ?? 0, maxDiscount, merchantsCount: merchants.size, bestPerUnit: bestUnit, hasOffers: anyOffers > 0, staleCount,
      trustedAny: p.formats.some((f) => f.offers.some((o) => o.trusted)),
      lastFetched: p.formats.flatMap((f) => f.offers.map((o) => o.fetchedAt)).sort().pop() ?? null,
    };
    return p.summary;
  }

  history(formatId, days = 365) {
    const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    return this.db.prepare('SELECT day, price FROM price_history WHERE format_id=? AND day>=? ORDER BY day').all(formatId, since).map((r) => ({ day: r.day, price: r.price }));
  }

  // Signal « deal » basé sur l'historique du format le moins cher
  dealFor(p) {
    const s = p.summary; if (!s.minFormatId || s.minPrice == null) return null;
    const pts = this.history(s.minFormatId, 365);
    const st = historyStats(pts, s.minPrice);
    return st.enough ? st : { enough: false };
  }

  card(p, size) {
    let s = p.summary;
    if (size) { // prix du format demandé s'il existe
      const f = p.formats.find((x) => Math.abs(x.size - size) < 0.001);
      const o = f?.offers.filter((x) => x.usable).sort((a, b) => a.price - b.price)[0];
      if (o) s = { ...s, minPrice: o.price, minFormat: f.label, priceOrig: o.priceOrig, discount: o.discount };
    }
    return {
      id: p.id, slug: p.slug, name: p.name, brand: p.brand, brandSlug: p.brandSlug, category: p.category, sub: p.sub, gender: p.gender, concentration: p.concentration,
      families: p.families, image: `/img/p/${p.slug}.svg`, demo: p.demo,
      minPrice: s.minPrice, minFormat: s.minFormat, priceOrig: s.priceOrig, discount: s.discount, maxDiscount: s.maxDiscount, merchantsCount: s.merchantsCount, hasOffers: s.hasOffers,
    };
  }
}
export { slugify };

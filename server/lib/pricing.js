// Calculs de prix : prix unitaire, livraison, remises, valeur. Toutes les fonctions sont pures.
export const STALE_DAYS = 7;
export const round2 = (x) => Math.round(x * 100) / 100;

export function unitInfo(size, unit) {
  if (unit === 'ml') return { base: 'ml', per: 100, label: '100 ml' };
  if (unit === 'g') return { base: 'g', per: 100, label: '100 g' };
  return { base: 'unité', per: 1, label: 'unité' };
}
// prix par ml / g / unité
export const pricePerUnit = (price, size) => (size > 0 ? price / size : null);
export const pricePer100 = (price, size, unit) => {
  const u = unitInfo(size, unit);
  return size > 0 ? round2((price / size) * u.per) : null;
};

export function shippingFor(merchant, subtotal) {
  if (merchant.free_threshold != null && subtotal >= merchant.free_threshold) return 0;
  return merchant.ship_fee ?? 0;
}

export function discountPct(price, orig) {
  if (!orig || orig <= price) return 0;
  return Math.round(((orig - price) / orig) * 100);
}

// État effectif d'une offre (périmée si non relevée depuis STALE_DAYS, signalée ou expirée)
export function offerState(o, merchant, now = Date.now()) {
  const fetched = Date.parse(o.fetched_at);
  const ageDays = (now - fetched) / 86400000;
  const expired = !!(o.expires_at && Date.parse(o.expires_at) < now);
  const stale = ageDays > STALE_DAYS;
  const obsolete = !!o.flagged || o.verified_status === 'obsolete' || stale || expired;
  const merchantOk = merchant.status === 'active';
  const status = obsolete ? 'obsolete' : o.verified_status === 'verified' ? 'verified' : 'unverified';
  return {
    obsolete, stale, expired, status,
    usable: !!o.available && !obsolete && merchantOk,
    trusted: !!o.available && status === 'verified' && merchantOk,
    ageHours: Math.round(ageDays * 24),
  };
}

// Statistiques d'historique + qualification honnête de l'offre.
export function historyStats(points, current) {
  if (!points || points.length < 20) return { enough: false, count: points?.length || 0 };
  const vals = points.map((p) => p.price);
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const min = Math.min(...vals), max = Math.max(...vals);
  const vsAvg = avg > 0 ? (avg - current) / avg : 0;
  const nearMin = current <= min * 1.02;
  let label = null;
  if (nearMin && vsAvg >= 0.05) label = 'Prix au plus bas observé';
  else if (vsAvg >= 0.1) label = 'Bon prix vs historique';
  else if (vsAvg <= -0.1) label = 'Au-dessus de la moyenne observée';
  return { enough: true, count: points.length, avg: round2(avg), min, max, vsAvg: round2(vsAvg * 100) / 100, nearMin, label, score: vsAvg + (nearMin ? 0.05 : 0) };
}

// ---- Codes promo
export function checkCode(code, now = Date.now()) {
  if (!code.active) return { valid: false, reason: 'Code désactivé.' };
  if (code.expires_at && Date.parse(code.expires_at) < now) return { valid: false, reason: 'Code expiré.' };
  return { valid: true };
}
// Applique un code à un lot d'articles d'un même marchand : renvoie remise et livraison offerte éventuelle.
export function applyCode(code, items, now = Date.now()) {
  const c = checkCode(code, now);
  if (!c.valid) return { applied: false, reason: c.reason, discount: 0, freeShip: false };
  const cats = JSON.parse(code.categories || '[]');
  const eligible = items.filter((i) => !cats.length || cats.includes(i.category));
  const eligibleSub = eligible.reduce((s, i) => s + i.price * i.qty, 0);
  const sub = items.reduce((s, i) => s + i.price * i.qty, 0);
  if (!eligible.length) return { applied: false, reason: 'Aucun produit éligible dans le panier.', discount: 0, freeShip: false };
  if (sub < code.min_amount) return { applied: false, reason: `Montant minimum d’achat : ${code.min_amount} €.`, discount: 0, freeShip: false };
  if (code.type === 'percent') return { applied: true, discount: round2(eligibleSub * code.value / 100), freeShip: false };
  if (code.type === 'fixed') return { applied: true, discount: round2(Math.min(code.value, eligibleSub)), freeShip: false };
  if (code.type === 'freeship') return { applied: true, discount: 0, freeShip: true };
  return { applied: false, reason: 'Type de code inconnu.', discount: 0, freeShip: false };
}

// Coût d'un lot chez un marchand.
export function merchantCost(merchant, items, code, now) {
  const subtotal = round2(items.reduce((s, i) => s + i.price * i.qty, 0));
  const ap = code ? applyCode(code, items, now) : { applied: false, discount: 0, freeShip: false };
  const afterDiscount = round2(subtotal - ap.discount);
  const shipping = items.length ? (ap.freeShip ? 0 : shippingFor(merchant, afterDiscount)) : 0;
  return { subtotal, discount: ap.discount, codeApplied: ap.applied ? code.code : null, codeReason: code && !ap.applied ? ap.reason : null, shipping, total: round2(afterDiscount + shipping) };
}

// Moteur de recherche : analyse de requête en langage naturel, filtres combinables, score de correspondance.
import { norm, fuzzyEq, lev, tolerance } from './text.js';
import { FAMILIES, NOTES, CATEGORIES, SKIN_TYPES, HAIR_TYPES, NEEDS, INGREDIENTS, CONCENTRATIONS, SUBCATEGORIES, SEASONS, OCCASIONS } from '../data/vocab.js';
import { findSimilar } from './similarity.js';

const STOP = new Set('le la les un une des de du d l a au aux pour avec et ou en qui sur dans par je cherche veux voudrais trouver recherche moi mon ma mes avoir qu est ce ces cette un parfum parfums produit produits finition couvrance note notes accord accords type peau cheveux soin soins'.split(' '));
// mots conservés comme tokens "neutres" mais jamais traités comme termes de nom
const CONNECT = new Set(['ni', 'ou', 'et', ',']);
const EXCLUDE_TRIGGERS = new Set(['sans', 'sauf', 'hors', 'exclure', 'excluant', 'eviter', 'evite', 'pas']);

const addPhrase = (map, phrase, entry) => { const k = norm(phrase); if (k && !map.has(k)) map.set(k, entry); };

export function buildVocab(catalog) {
  const phrases = new Map();
  for (const f of FAMILIES) { addPhrase(phrases, f.name, { type: 'family', value: f.id }); f.syn.forEach((s) => addPhrase(phrases, s, { type: 'family', value: f.id })); }
  // notes avant familles pour les homonymes (ambre, etc.)
  const notePhr = new Map();
  for (const n of NOTES) { addPhrase(notePhr, n.name, { type: 'note', value: n.name }); n.syn.forEach((s) => addPhrase(notePhr, s, { type: 'note', value: n.name })); }
  for (const [k, v] of notePhr) phrases.set(k, v);
  for (const c of CATEGORIES) { addPhrase(phrases, c.name, { type: 'category', value: c.id }); c.syn.forEach((s) => addPhrase(phrases, s, { type: 'category', value: c.id })); }
  for (const [cat, subs] of Object.entries(SUBCATEGORIES)) for (const s of subs) addPhrase(phrases, s, { type: 'sub', value: norm(s), category: cat });
  const subAlias = { creme: ['creme'], serum: ['serum'], nettoyant: ['nettoyant', 'skincare'], masque: ['masque'], exfoliant: ['exfoliant', 'skincare'], tonique: ['toner', 'skincare'], lotion: ['toner', 'skincare'], toner: ['toner', 'skincare'], huile: ['huile'], shampoing: ['shampooing', 'cheveux'], shampooing: ['shampooing', 'cheveux'], 'apres-shampooing': ['apres-shampooing', 'cheveux'], 'apres shampooing': ['apres-shampooing', 'cheveux'], 'masque capillaire': ['masque', 'cheveux'], gommage: ['gommage', 'corps'], 'gel douche': ['gel douche', 'corps'], deodorant: ['deodorant', 'corps'], 'fond de teint': ['fond de teint', 'maquillage'], correcteur: ['correcteur', 'maquillage'], poudre: ['poudre', 'maquillage'], blush: ['blush', 'maquillage'], bronzer: ['bronzer', 'maquillage'], highlighter: ['highlighter', 'maquillage'], illuminateur: ['highlighter', 'maquillage'], mascara: ['mascara', 'maquillage'], eyeliner: ['eyeliner', 'maquillage'], 'rouge a levres': ['rouge a levres', 'maquillage'], 'rouge levres': ['rouge a levres', 'maquillage'], lipstick: ['rouge a levres', 'maquillage'], palette: ['palette', 'maquillage'], pinceaux: ['pinceaux', 'maquillage'], pinceau: ['pinceaux', 'maquillage'], 'creme solaire': ['protection solaire', 'skincare'], 'protection solaire': ['protection solaire', 'skincare'] };
  for (const [a, [v, cat]] of Object.entries(subAlias)) addPhrase(phrases, a, { type: 'sub', value: v, category: cat });
  for (const t of SKIN_TYPES) { addPhrase(phrases, `peau ${t}`, { type: 'skin', value: t }); addPhrase(phrases, `peaux ${t}s`, { type: 'skin', value: t }); addPhrase(phrases, `peau ${t.replace(/e$/, 'e')}`, { type: 'skin', value: t }); }
  for (const t of HAIR_TYPES) addPhrase(phrases, `cheveux ${t}`, { type: 'hair', value: t });
  for (const n of NEEDS) n.syn.forEach((s) => addPhrase(phrases, s, { type: 'need', value: n.id }));
  for (const i of INGREDIENTS) { addPhrase(phrases, i.name, { type: 'ingredient', value: i.name }); i.syn.forEach((s) => addPhrase(phrases, s, { type: 'ingredient', value: i.name })); }
  for (const c of CONCENTRATIONS) { addPhrase(phrases, c.name, { type: 'conc', value: c.id }); c.syn.forEach((s) => addPhrase(phrases, s, { type: 'conc', value: c.id })); }
  for (const [w, g] of Object.entries({ femme: 'F', feminin: 'F', feminine: 'F', 'pour elle': 'F', 'pour femme': 'F', homme: 'H', masculin: 'H', 'pour lui': 'H', 'pour homme': 'H', mixte: 'M', unisexe: 'M', unisex: 'M' })) addPhrase(phrases, w, { type: 'gender', value: g });
  for (const [w, v] of Object.entries({ mat: 'mat', mate: 'mat', matte: 'mat', lumineuse: 'lumineuse', lumineux: 'lumineuse', glow: 'lumineuse', satinee: 'satinée', satine: 'satinée', naturelle: 'naturelle', naturel: 'naturelle', brillante: 'brillante', brillant: 'brillante', gloss: 'brillante' })) addPhrase(phrases, w, { type: 'finish', value: v });
  for (const [w, v] of Object.entries({ legere: 'légère', leger: 'légère', moyenne: 'moyenne', elevee: 'élevée', forte: 'élevée', haute: 'élevée', totale: 'élevée', 'couvrance legere': 'légère', 'couvrance moyenne': 'moyenne', 'couvrance elevee': 'élevée', 'couvrance forte': 'élevée' })) addPhrase(phrases, w, { type: 'coverage', value: v });
  for (const s of SEASONS) addPhrase(phrases, s, { type: 'season', value: s });
  for (const o of OCCASIONS) addPhrase(phrases, o, { type: 'occasion', value: o });
  addPhrase(phrases, 'soiree', { type: 'occasion', value: 'soirée' }); addPhrase(phrases, 'ete', { type: 'season', value: 'été' });
  for (const b of catalog.brands) { addPhrase(phrases, b.name, { type: 'brand', value: b.id }); }
  for (const [k, v] of [['ysl', 'Yves Saint Laurent'], ['jpg', 'Jean Paul Gaultier'], ['mfk', 'Maison Francis Kurkdjian'], ['ck', 'Calvin Klein'], ['dg', 'Dolce&Gabbana'], ['d&g', 'Dolce&Gabbana'], ['mac', 'MAC'], ['la roche posay', "La Roche-Posay"], ['lrp', "La Roche-Posay"], ['pdm', 'Parfums de Marly'], ['loreal', "L'Oréal Paris"], ['loccitane', "L'Occitane"], ['armani', 'Giorgio Armani'], ['gaultier', 'Jean Paul Gaultier'], ['saint laurent', 'Yves Saint Laurent'], ['rabanne', 'Paco Rabanne'], ['jo malone', 'Jo Malone London'], ['mugler', 'Mugler'], ['kurkdjian', 'Maison Francis Kurkdjian']]) {
    const b = catalog.brands.find((x) => x.name === v); if (b) addPhrase(phrases, k, { type: 'brand', value: b.id });
  }
  // mots de noms de produits (pour tolérance aux fautes)
  const nameTokens = new Map();
  for (const p of catalog.products) for (const t of p.nameTokens) nameTokens.set(t, (nameTokens.get(t) || 0) + 1);
  const fuzzyList = [...phrases.keys()].filter((k) => !k.includes(' ') && k.length >= 4);
  const nameList = [...nameTokens.keys()].filter((k) => k.length >= 3);
  return { phrases, nameTokens, fuzzyList, nameList, maxPhraseWords: Math.max(...[...phrases.keys()].map((k) => k.split(' ').length)) };
}

const NUM = '(\\d+(?:[.,]\\d+)?)';
const num = (s) => parseFloat(String(s).replace(',', '.'));

export function parseQuery(raw, vocab) {
  let q = norm(raw);
  const c = { brands: [], notes: [], notesExcl: [], families: [], familiesExcl: [], ingredients: [], ingredientsExcl: [], names: [], unknown: [], needs: [], skin: [], hair: [], finish: [], coverage: [], conc: [], gender: null, seasons: [], occasions: [], subs: [], category: null, priceMax: null, priceMin: null, size: null, similarTo: null, cheaper: false, ignored: [] };
  const take = (re, fn) => { q = q.replace(re, (...m) => { fn(m); return ' '; }); };
  // intention « similaire à … »
  take(/\b(moins cher|pas cher|economique|bon marche)\b/g, () => { c.cheaper = true; });
  let simText = null;
  take(/\b(similaires?|alternatives?|equivalents?|ressemble(?:nt)?|proches?|dupes?)\s*(?:a|de|du|au|aux|d)?\s+(.+)$/, (m) => { simText = m[2]; });
  if (!simText) take(/\b(?:comme|type)\s+(.+)$/, (m) => { simText = m[1]; });
  let target = simText;
  if (simText) q = q.replace(/\s+/g, ' ').trim();
  const full = q;
  // Prix et formats
  const pq = simText ? full + ' ' + simText : full;
  let work = simText ? ` ${full} ` : ` ${q} `;
  const strip = (s) => { work = work.replace(s.re, (...m) => { s.fn(m); return ' '; }); };
  strip({ re: new RegExp(`\\bentre ${NUM} ?(?:€|euros?|eur)? ?et ${NUM} ?(?:€|euros?|eur)?`), fn: (m) => { c.priceMin = num(m[1]); c.priceMax = num(m[2]); } });
  strip({ re: new RegExp(`\\bde ${NUM} ?(?:€|euros?|eur)? a ${NUM} ?(?:€|euros?|eur)\\b`), fn: (m) => { c.priceMin = num(m[1]); c.priceMax = num(m[2]); } });
  strip({ re: new RegExp(`\\b(?:a )?(?:moins de|maximum|max|jusqu a|jusqu au|inferieur(?:e)? a|sous|budget(?: de| max)?|<=?)\\s*${NUM} ?(?:€|euros?|eur)?(?!\\s?(?:ml|cl|g)\\b)`), fn: (m) => { c.priceMax = num(m[1]); } });
  strip({ re: new RegExp(`\\b(?:a partir de|plus de|au moins|minimum|min|superieur(?:e)? a|>=?)\\s*${NUM} ?(?:€|euros?|eur)?(?!\\s?(?:ml|cl|g)\\b)`), fn: (m) => { c.priceMin = num(m[1]); } });
  strip({ re: new RegExp(`\\b${NUM} ?(ml|cl|g|gr|grammes?)\\b`), fn: (m) => { c.size = m[2] === 'cl' ? num(m[1]) * 10 : num(m[1]); } });
  strip({ re: new RegExp(`\\b(?:pour )?${NUM} ?(?:€|euros?|eur)\\b`), fn: (m) => { if (c.priceMax == null) c.priceMax = num(m[1]); } });
  void pq;
  const mainText = simText ? work : work;
  if (simText) { c._simRaw = target; }
  const parsed = analyseTokens(mainText, vocab, c);
  if (simText) {
    const tgt = ` ${target} `.replace(new RegExp(`\\b${NUM} ?(?:€|euros?|eur|ml)\\b`, 'g'), ' ').replace(/\s+/g, ' ').trim();
    c.similarTo = tgt;
  }
  return parsed;
}

function analyseTokens(text, vocab, c) {
  const toks = text.replace(/[,;]/g, ' , ').split(/\s+/).filter(Boolean);
  let excl = false;
  for (let i = 0; i < toks.length;) {
    const t = toks[i];
    if (EXCLUDE_TRIGGERS.has(t)) { excl = true; i++; continue; }
    if (t === ',' ) { i++; continue; }
    if (CONNECT.has(t)) { i++; continue; }
    // plus long groupe de mots exact
    let hit = null, len = 0;
    for (let n = Math.min(vocab.maxPhraseWords, toks.length - i); n >= 1; n--) {
      const ph = toks.slice(i, i + n).join(' ');
      if (vocab.phrases.has(ph)) { hit = vocab.phrases.get(ph); len = n; break; }
    }
    // flou : un mot de nom de produit proche l'emporte à distance égale (« Sauvge » → Sauvage, pas Sauge)
    if (!hit && t.length >= 4 && !vocab.nameTokens.has(t)) {
      let best = null, bd = 9, nd = 9;
      for (const k of vocab.nameList) { const tol = tolerance(Math.min(t.length, k.length)); const d = lev(t, k, tol); if (d <= tol && d < nd) nd = d; }
      for (const k of vocab.fuzzyList) { const tol = tolerance(Math.min(t.length, k.length)); const d = lev(t, k, tol); if (d <= tol && d < bd && Math.abs(t.length - k.length) <= 2) { bd = d; best = k; } }
      if (best && bd < nd) { hit = vocab.phrases.get(best); len = 1; }
    }
    if (hit) {
      place(c, hit, excl);
      i += len;
      const next = toks[i];
      if (!(next && CONNECT.has(next)) && next !== ',') excl = false;
      continue;
    }
    if (STOP.has(t) || /^\d+$/.test(t) && false) { i++; continue; }
    // terme libre : nom de produit connu ?
    let nm = vocab.nameTokens.has(t) ? t : null;
    if (!nm && t.length >= 3) {
      let bd = 9;
      for (const k of vocab.nameList) { const tol = tolerance(Math.min(t.length, k.length)); const d = lev(t, k, tol); if (d <= tol && d < bd) { bd = d; nm = k; } }
    }
    if (nm) c.names.push(nm); else c.unknown.push(t);
    excl = false;
    i++;
  }
  return c;
}

function place(c, hit, excl) {
  const push = (arr, v) => { if (!arr.includes(v)) arr.push(v); };
  switch (hit.type) {
    case 'brand': push(c.brands, hit.value); break;
    case 'note': push(excl ? c.notesExcl : c.notes, hit.value); break;
    case 'family': push(excl ? c.familiesExcl : c.families, hit.value); break;
    case 'ingredient': push(excl ? c.ingredientsExcl : c.ingredients, hit.value); break;
    case 'category': c.category = hit.value; break;
    case 'sub': push(c.subs, hit.value); if (hit.category && !c.category) c.category = hit.category; break;
    case 'skin': push(c.skin, hit.value); break;
    case 'hair': push(c.hair, hit.value); break;
    case 'need': push(c.needs, hit.value); break;
    case 'conc': push(c.conc, hit.value); break;
    case 'gender': c.gender = hit.value; break;
    case 'finish': push(c.finish, hit.value); break;
    case 'coverage': push(c.coverage, hit.value); break;
    case 'season': push(c.seasons, hit.value); break;
    case 'occasion': push(c.occasions, hit.value); break;
  }
}

// --- Correspondance d'une note (couches + accords)
const accordOfNote = { Vanille: 'vanillé', 'Musc blanc': 'musqué', Ambre: 'ambré', Rose: 'rosé', Oud: 'oud', Caramel: 'caramel', Praliné: 'praliné', Cuir: 'cuir', Tabac: 'tabac', Encens: 'encens', Safran: 'safran', Cannelle: 'cannelle', Lavande: 'lavande', Patchouli: 'terreux', Poivre: 'poivré', Amande: 'amande', Café: 'café', Chocolat: 'chocolaté' };
export function noteMatch(p, note) {
  const n = norm(note);
  if ([...p.top, ...p.heart, ...p.base].some((x) => norm(x) === n)) return 1;
  const ac = accordOfNote[note];
  if (ac && p.accords.some((a) => norm(a) === norm(ac))) return 0.7;
  return 0;
}
const hasNote = (p, note) => noteMatch(p, note) > 0;

const SIZE_TOL = 0.001;

export function runSearch(catalog, params = {}, ctx = {}) {
  const vocab = catalog.vocab || (catalog.vocab = buildVocab(catalog));
  const q = (params.q || '').trim().slice(0, 200);
  const c = q ? parseQuery(q, vocab) : parseQuery('', vocab);
  const P = params;
  // paramètres explicites (filtres UI) qui complètent la requête
  const list = (v) => (Array.isArray(v) ? v : v ? String(v).split(',').filter(Boolean) : []);
  const catParam = P.category || null;
  if (catParam) c.category = catParam;
  c.priceMin = P.minPrice != null && P.minPrice !== '' ? +P.minPrice : c.priceMin;
  c.priceMax = P.maxPrice != null && P.maxPrice !== '' ? +P.maxPrice : c.priceMax;
  const brandIds = [...new Set([...c.brands, ...list(P.brands).map((s) => catalog.brandBySlug.get(s)?.id).filter(Boolean)])];
  const brandsExplicit = list(P.brands).length > 0;
  const merchantIds = list(P.merchants).map(Number).filter(Boolean);
  const fams = [...new Set([...c.families, ...list(P.families)])];
  const notesIn = [...new Set([...c.notes, ...list(P.notes)])];
  const notesEx = [...new Set([...c.notesExcl, ...list(P.notesExcl)])];
  if (P.gender) c.gender = P.gender;
  if (P.sub) c.subs.push(norm(P.sub));
  for (const [k, key] of [['conc', 'conc'], ['skin', 'skin'], ['hair', 'hair'], ['finish', 'finish'], ['coverage', 'coverage'], ['seasons', 'seasons'], ['occasions', 'occasions']]) for (const v of list(P[k])) if (!c[key].includes(v)) c[key].push(v);
  const needsWordSearch = !!(c.names.length);
  const explain = [];
  let simRef = null, simMode = false;

  // mode « similaire à X »
  if (c.similarTo) {
    simRef = resolveProduct(catalog, vocab, c.similarTo);
    simMode = !!simRef;
  }

  // l'existence de notes implique l'univers parfum
  if (!c.category && (notesIn.length || notesEx.length || fams.length)) c.category = 'parfum';
  const hasConstraint = !!(q || brandIds.length || c.category || c.subs.length || notesIn.length || fams.length || c.ingredients.length || c.priceMax != null);

  const cand = [];
  const sims = new Map();
  let universe = catalog.products;
  if (simMode) {
    const sl = findSimilar(catalog, simRef, { cheaper: c.cheaper, limit: 200, minScore: 25 });
    universe = sl.map((s) => catalog.productById.get(s.product.id));
    sl.forEach((s) => sims.set(s.product.id, s.similarity));
  }
  const catNeed = (p) => (c.category === 'cheveux' || c.category === 'corps') && P.category === 'cheveux-corps' ? true : true;
  void catNeed;
  for (const p of universe) {
    // catégorie (la page « cheveux-corps » combine les deux)
    if (c.category) {
      const cc = c.category === 'cheveux-corps' ? ['cheveux', 'corps'] : [c.category];
      if (!cc.includes(p.category)) continue;
    }
    if (brandIds.length && !brandIds.includes(p.brandId)) continue;
    if (c.gender && p.category === 'parfum' && !(p.gender === c.gender || p.gender === 'M')) continue;
    if (fams.length === 0 && c.familiesExcl.some((f) => p.families.includes(f))) continue;
    if (c.familiesExcl.some((f) => p.families.includes(f))) continue;
    if (notesEx.some((n) => hasNote(p, n))) continue;
    if (c.ingredientsExcl.some((i) => p.actives.includes(i))) continue;
    if (c.conc.length && !c.conc.includes(p.concentration)) continue;
    if (c.skin.length && p.category !== 'parfum' && !c.skin.some((s) => p.skin.includes(s))) continue;
    if (c.hair.length && !c.hair.some((s) => p.hair.includes(s))) continue;
    if (c.seasons.length && !c.seasons.some((s) => p.seasons.includes(s))) continue;
    if (c.occasions.length && !c.occasions.some((s) => p.occasions.includes(s))) continue;
    if (c.subs.length && !c.subs.some((s) => norm(p.sub || '').startsWith(s) || norm(p.sub || '') === s)) continue;
    // termes de nom requis
    let nameScore = 0;
    if (c.names.length) {
      let ok = true;
      for (const t of c.names) {
        if (p.nameTokens.includes(t)) nameScore += 25;
        else if (p.nameTokens.some((x) => fuzzyEq(x, t))) nameScore += 18;
        else { ok = false; break; }
      }
      if (!ok) continue;
    }
    // notes / familles / ingrédients : couverture
    let cov = [];
    let covNotes = 0;
    if (notesIn.length) { covNotes = notesIn.reduce((s, n) => s + noteMatch(p, n), 0) / notesIn.length; if (covNotes === 0) continue; cov.push(covNotes); }
    if (fams.length) { const f = fams.filter((x) => p.families.includes(x)).length / fams.length; if (f === 0 && !notesIn.length) continue; if (f === 0) cov.push(0.15); else cov.push(f); }
    if (c.ingredients.length) { const f = c.ingredients.filter((i) => p.actives.includes(i)).length / c.ingredients.length; if (f === 0) continue; cov.push(f); }
    if (c.finish.length || c.coverage.length) { // critères de teint : pondérés, au moins un doit correspondre
      const hits = [];
      if (c.finish.length) hits.push(p.finish && c.finish.includes(p.finish) ? 1 : 0);
      if (c.coverage.length) hits.push(p.coverage && c.coverage.includes(p.coverage) ? 1 : 0);
      const f = hits.reduce((a, b) => a + b, 0) / hits.length;
      if (f === 0) continue;
      cov.push(f);
    }
    // prix
    const s = p.summary;
    if (P.available !== '0' && (c.priceMax != null || c.priceMin != null || P.onlyAvailable === '1')) { if (s.minPrice == null) continue; }
    if (c.priceMax != null || c.priceMin != null) {
      if (!priceInRange(p, c.priceMin, c.priceMax, merchantIds)) continue;
    }
    if (P.available === '1' && s.merchantsCount === 0) continue;
    if (merchantIds.length && !p.formats.some((f) => f.offers.some((o) => o.usable && merchantIds.includes(o.merchantId)))) continue;
    if (P.promo === '1' && !(s.maxDiscount > 0)) continue;
    if (P.freeShipping === '1' && !p.formats.some((f) => f.offers.some((o) => o.usable && o.shipping === 0))) continue;
    if (P.verified === '1' && !p.formats.some((f) => f.offers.some((o) => o.usable && o.merchant.verified))) continue;
    if (P.minDiscount && !(s.maxDiscount >= +P.minDiscount)) continue;

    // score
    let score = nameScore;
    if (brandIds.length && !brandsExplicit) score += 18;
    if (cov.length) score += 50 * (cov.reduce((a, b) => a + b, 0) / cov.length);
    const needBoost = c.needs.reduce((acc, id) => { const nd = NEEDS.find((x) => x.id === id); return acc + ((nd.actives || []).filter((a) => p.actives.includes(a)).length ? 8 : 0) + ((nd.skin || []).some((x) => p.skin.includes(x)) ? 4 : 0); }, 0);
    score += needBoost;
    if (c.gender && p.gender === c.gender) score += 4;
    if (c.size && p.formats.some((f) => Math.abs(f.size - c.size) < SIZE_TOL)) score += 6;
    score += Math.min(8, p.popularity / 14);
    const match = simMode ? sims.get(p.id)?.score : cov.length ? Math.round((cov.reduce((a, b) => a + b, 0) / cov.length) * 100) : null;
    cand.push({ p, score, match });
  }

  // texte libre inconnu : aucun résultat si rien d'exploitable
  const nothingRecognised = q && !hasRecognised(c) && !simMode;
  let results = nothingRecognised ? [] : cand;
  if (simMode) results = cand.map((x) => ({ ...x, score: (sims.get(x.p.id)?.score || 0) }));

  // facettes (avant filtres de facettes explicites) — simple : marques et catégories des résultats
  const facets = { brands: countBy(results, (r) => r.p.brand, (r) => r.p.brandSlug), categories: countBy(results, (r) => r.p.category), merchants: {} };

  // tri
  const sort = P.sort || (simMode ? 'relevance' : 'relevance');
  const priceOf = (r) => r.p.summary.minPrice ?? Infinity;
  const sorters = {
    relevance: (a, b) => b.score - a.score || priceOf(a) - priceOf(b),
    price_asc: (a, b) => priceOf(a) - priceOf(b),
    price_desc: (a, b) => (b.p.summary.minPrice ?? -1) - (a.p.summary.minPrice ?? -1),
    discount: (a, b) => b.p.summary.maxDiscount - a.p.summary.maxDiscount,
    new: (a, b) => (b.p.year || 0) - (a.p.year || 0) || Date.parse(b.p.createdAt) - Date.parse(a.p.createdAt) || b.p.id - a.p.id,
    popularity: (a, b) => b.p.popularity - a.p.popularity,
    value: (a, b) => (a.p.summary.bestPerUnit ?? Infinity) - (b.p.summary.bestPerUnit ?? Infinity),
  };
  results.sort(sorters[sort] || sorters.relevance);

  const sizePref = c.size;
  const page = Math.max(1, +P.page || 1), size = Math.min(60, +P.pageSize || 24);
  const slice = results.slice((page - 1) * size, page * size);
  const items = slice.map(({ p, match }) => {
    const card = catalog.card(p, sizePref);
    const why = whyList(p, { notesIn, fams, c, brandIds, catalog });
    const out = { ...card, match, why, vendors: p.summary.merchantsCount };
    if (simMode) out.similarity = sims.get(p.id);
    return out;
  });

  // résumé des filtres actifs compris
  const active = [];
  if (simRef) active.push({ label: `Similaire à ${simRef.brand} ${simRef.name}`, key: 'similar' });
  if (simMode && c.cheaper) active.push({ label: 'Moins cher', key: 'cheaper' });
  for (const id of c.brands) active.push({ label: catalog.brandById.get(id).name, key: 'brand' });
  if (c.category) active.push({ label: CATEGORIES.find((x) => x.id === c.category)?.name || c.category, key: 'category' });
  for (const s of c.subs) active.push({ label: s, key: 'sub' });
  for (const n of notesIn) active.push({ label: `Note : ${n}`, key: 'note' });
  for (const n of notesEx) active.push({ label: `Sans ${n}`, key: 'noteExcl', excluded: true });
  for (const f of fams) active.push({ label: `Famille : ${FAMILIES.find((x) => x.id === f)?.name}`, key: 'family' });
  for (const f of c.familiesExcl) active.push({ label: `Sans famille ${FAMILIES.find((x) => x.id === f)?.name}`, key: 'familyExcl', excluded: true });
  for (const i of c.ingredients) active.push({ label: `Actif : ${i}`, key: 'ingredient' });
  for (const s of c.skin) active.push({ label: `Peau ${s}`, key: 'skin' });
  for (const s of c.hair) active.push({ label: `Cheveux ${s}`, key: 'hair' });
  for (const s of c.finish) active.push({ label: `Finition ${s}`, key: 'finish' });
  for (const s of c.coverage) active.push({ label: `Couvrance ${s}`, key: 'coverage' });
  for (const s of c.conc) active.push({ label: CONCENTRATIONS.find((x) => x.id === s)?.name, key: 'conc' });
  for (const s of c.seasons) active.push({ label: `Saison : ${s}`, key: 'season' });
  for (const s of c.occasions) active.push({ label: `Occasion : ${s}`, key: 'occasion' });
  if (c.gender) active.push({ label: { F: 'Féminin', H: 'Masculin', M: 'Mixte' }[c.gender], key: 'gender' });
  if (c.priceMax != null) active.push({ label: `≤ ${c.priceMax} €`, key: 'priceMax' });
  if (c.priceMin != null) active.push({ label: `≥ ${c.priceMin} €`, key: 'priceMin' });
  if (c.size) active.push({ label: `${c.size} ml`, key: 'size' });
  for (const n of c.names) active.push({ label: `Nom : ${n}`, key: 'name' });

  void needsWordSearch; void explain; void hasConstraint; void ctx;
  return {
    q, total: results.length, page, pageSize: size, items, facets, active,
    ignored: c.unknown, sort, similarTo: simRef ? { slug: simRef.slug, name: simRef.name, brand: simRef.brand } : null,
    notFound: c.similarTo && !simRef ? c.similarTo : null,
    parsed: { priceMax: c.priceMax, priceMin: c.priceMin, notes: notesIn, notesExcl: notesEx, families: fams, size: c.size, category: c.category },
    sizePref,
  };
}

function hasRecognised(c) {
  return !!(c.brands.length || c.names.length || c.notes.length || c.notesExcl.length || c.families.length || c.familiesExcl.length || c.ingredients.length || c.ingredientsExcl.length || c.category || c.subs.length || c.needs.length || c.skin.length || c.hair.length || c.finish.length || c.coverage.length || c.conc.length || c.gender || c.seasons.length || c.occasions.length || c.priceMax != null || c.priceMin != null || c.size);
}

function priceInRange(p, min, max, merchantIds) {
  for (const f of p.formats) for (const o of f.offers) {
    if (!o.usable) continue;
    if (merchantIds.length && !merchantIds.includes(o.merchantId)) continue;
    if ((min == null || o.price >= min) && (max == null || o.price <= max)) return true;
  }
  return false;
}
function countBy(arr, key, slug) {
  const m = {};
  for (const r of arr) { const k = key(r); m[k] = m[k] || { count: 0, slug: slug ? slug(r) : k }; m[k].count++; }
  return m;
}
function whyList(p, { notesIn, fams, c, brandIds, catalog }) {
  const w = [];
  if (brandIds.length && brandIds.includes(p.brandId)) w.push(`Marque : ${p.brand}`);
  if (notesIn.length) { const got = notesIn.filter((n) => hasNote(p, n)); w.push(`${got.length}/${notesIn.length} note(s) recherchée(s) : ${got.join(', ').toLowerCase()}`); }
  if (fams.length) { const got = fams.filter((f) => p.families.includes(f)); if (got.length) w.push(`Famille : ${got.map((f) => FAMILIES.find((x) => x.id === f).name.toLowerCase()).join(', ')}`); }
  if (c.ingredients.length) w.push(`Actifs : ${c.ingredients.filter((i) => p.actives.includes(i)).join(', ').toLowerCase()}`);
  void catalog;
  return w;
}

// Résolution d'un texte vers un produit précis (pour « similaire à … »)
export function resolveProduct(catalog, vocab, text) {
  const toks = norm(text).split(' ').filter((t) => t && !STOP.has(t) && !/^(ml|eau|parfum|edp|edt)$/.test(t) && !/^\d+$/.test(t) || /^\d{2,}$/.test(t) && false);
  const all = norm(text).split(' ').filter((t) => t && !['de', 'la', 'le', 'a', 'du', 'des', 'moins', 'cher'].includes(t));
  const words = [...new Set([...toks, ...all.filter((t) => /^\d{2,3}$/.test(t) && !/^(30|50|100|75|200)$/.test(t))])];
  if (!words.length) return null;
  let best = null, bs = 0;
  for (const p of catalog.products) {
    let hit = 0;
    for (const t of words) if (p.nameTokens.includes(t)) hit += 1; else if (p.nameTokens.some((x) => fuzzyEq(x, t))) hit += 0.75;
    const sc = hit / words.length;
    if (sc > bs || (sc === bs && best && p.popularity > best.popularity)) { bs = sc; best = p; }
  }
  return bs >= 0.6 ? best : null;
}

// --- Suggestions (autocomplétion)
export function suggest(catalog, q, popular = []) {
  const vocab = catalog.vocab || (catalog.vocab = buildVocab(catalog));
  const n = norm(q);
  if (!n) return { products: [], brands: [], categories: [], notes: [], popular: popular.slice(0, 6) };
  const match = (s) => { const t = norm(s); return t.startsWith(n) ? 3 : t.split(' ').some((w) => w.startsWith(n)) ? 2 : t.includes(n) ? 1 : 0; };
  const fz = (s) => n.length >= 4 && norm(s).split(' ').some((w) => fuzzyEq(w, n));
  const products = catalog.products.map((p) => ({ p, s: Math.max(match(p.brand + ' ' + p.name), match(p.name) + 0.5), f: fz(p.name) || fz(p.brand) })).filter((x) => x.s > 0 || x.f)
    .sort((a, b) => b.s - a.s || b.p.popularity - a.p.popularity).slice(0, 6).map((x) => ({ id: x.p.id, slug: x.p.slug, name: x.p.name, brand: x.p.brand, category: x.p.category, image: `/img/p/${x.p.slug}.svg`, minPrice: x.p.summary.minPrice }));
  const brands = catalog.brands.filter((b) => match(b.name) || fz(b.name)).slice(0, 4).map((b) => ({ slug: b.slug, name: b.name }));
  const categories = CATEGORIES.filter((c) => match(c.name) || c.syn.some((s) => match(s))).map((c) => ({ id: c.id, name: c.name, slug: c.slug }));
  const notes = NOTES.filter((x) => match(x.name) || x.syn.some((s) => match(s))).slice(0, 5).map((x) => x.name);
  void vocab;
  return { products, brands, categories, notes, popular: popular.filter((s) => norm(s).includes(n)).slice(0, 4) };
}

// --- Recherche olfactive avancée
export function perfumeFinder(catalog, P) {
  const L = (v) => (Array.isArray(v) ? v : v ? String(v).split(',').filter(Boolean) : []);
  const req = L(P.notes), excl = L(P.notesExcl), pref = L(P.notesPref), sec = L(P.notesSec);
  const topN = L(P.top), heartN = L(P.heart), baseN = L(P.base);
  const fams = L(P.families), accords = L(P.accords).map(norm), seasons = L(P.seasons), occasions = L(P.occasions), concs = L(P.conc);
  const budget = P.budget ? +P.budget : null;
  const intensity = P.intensity ? +P.intensity : null;
  const out = [];
  for (const p of catalog.products) {
    if (p.category !== 'parfum') continue;
    if (P.gender && !(p.gender === P.gender || p.gender === 'M')) continue;
    if (concs.length && !concs.includes(p.concentration)) continue;
    if (excl.some((n) => hasNote(p, n))) continue;
    if (budget != null && !(p.summary.minPrice != null && priceInRange(p, null, budget, []))) continue;
    if (seasons.length && !seasons.some((s) => p.seasons.includes(s))) continue;
    if (occasions.length && !occasions.some((s) => p.occasions.includes(s))) continue;
    const parts = []; // [label, poids, valeur, détail]
    if (req.length) parts.push(['Notes recherchées', 5, req.reduce((s, n) => s + noteMatch(p, n), 0) / req.length, req.filter((n) => hasNote(p, n))]);
    if (topN.length) parts.push(['Notes de tête', 2, topN.filter((n) => p.top.includes(n)).length / topN.length, topN.filter((n) => p.top.includes(n))]);
    if (heartN.length) parts.push(['Notes de cœur', 2, heartN.filter((n) => p.heart.includes(n)).length / heartN.length, heartN.filter((n) => p.heart.includes(n))]);
    if (baseN.length) parts.push(['Notes de fond', 2, baseN.filter((n) => p.base.includes(n)).length / baseN.length, baseN.filter((n) => p.base.includes(n))]);
    if (pref.length) parts.push(['Notes préférées', 2.5, pref.reduce((s, n) => s + noteMatch(p, n), 0) / pref.length, pref.filter((n) => hasNote(p, n))]);
    if (sec.length) parts.push(['Notes secondaires', 1, sec.reduce((s, n) => s + noteMatch(p, n), 0) / sec.length, sec.filter((n) => hasNote(p, n))]);
    if (fams.length) parts.push(['Familles', 3, fams.filter((f) => p.families.includes(f)).length / fams.length, fams.filter((f) => p.families.includes(f))]);
    if (accords.length) parts.push(['Accords', 2, accords.filter((a) => p.accords.map(norm).includes(a)).length / accords.length, accords.filter((a) => p.accords.map(norm).includes(a))]);
    if (intensity) parts.push(['Intensité', 1.5, p.intensity ? 1 - Math.abs(p.intensity - intensity) / 4 : 0.4, [`${p.intensity ?? '?'}/5`]]);
    if (!parts.length) parts.push(['Popularité', 1, p.popularity / 100, []]);
    const tw = parts.reduce((s, x) => s + x[1], 0);
    const score = Math.round((parts.reduce((s, x) => s + x[1] * x[2], 0) / tw) * 100);
    // un parfum ne contenant qu'une note sur plusieurs recherchées ne peut pas être « parfait »
    if (req.length > 1 && req.filter((n) => hasNote(p, n)).length === 1 && score > 70) continue;
    if (parts.length && parts[0][2] === 0 && (req.length || pref.length || fams.length) && score < 15) continue;
    if (req.length && req.every((n) => !hasNote(p, n)) && !pref.length && !fams.length && !topN.length && !heartN.length && !baseN.length) continue;
    const criteria = parts.map(([label, w, v, det]) => ({ label, value: Math.round(v * 100), detail: det }));
    out.push({ ...catalog.card(p), match: score, criteria });
  }
  out.sort((a, b) => b.match - a.match || (a.minPrice ?? 1e9) - (b.minPrice ?? 1e9));
  return { total: out.length, items: out.slice(0, 60) };
}
export { hasNote, priceInRange };

// Beauty Match : similarité indicative entre produits, toujours accompagnée de ses critères.
import { norm } from './text.js';

const setOf = (a) => new Set((a || []).map((x) => norm(x)));
function jac(a, b) {
  const A = setOf(a), B = setOf(b);
  if (!A.size && !B.size) return { v: 0, shared: [] };
  const shared = [...A].filter((x) => B.has(x));
  return { v: shared.length / new Set([...A, ...B]).size, shared };
}
const orig = (list, shared) => (list || []).filter((x) => shared.includes(norm(x)));
const concRank = { cologne: 0, edt: 1, edp: 2, extrait: 3 };
const concName = { extrait: 'extrait de parfum', edp: 'eau de parfum', edt: 'eau de toilette', cologne: 'eau de Cologne' };
const hexRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const hexDist = (a, b) => Math.sqrt(hexRgb(a).reduce((s, v, i) => s + (v - hexRgb(b)[i]) ** 2, 0)) / 441.7;
const genderName = (g) => ({ F: 'féminin', H: 'masculin', M: 'mixte' }[g] || 'non précisé');

// Écart de prix au ml/unité en % (négatif = moins cher que la référence)
export function priceDelta(ref, cand) {
  const a = ref.summary.bestPerUnit, b = cand.summary.bestPerUnit;
  if (a == null || b == null || a === 0) return null;
  return Math.round(((b - a) / a) * 100);
}

export function similarity(ref, cand) {
  if (ref.id === cand.id || ref.category !== cand.category) return null;
  const criteria = [], reasons = [], diffs = [];
  let score = 0;
  const add = (label, value, weight, note) => { score += value * weight; criteria.push({ label, value: Math.round(value * 100), weight, note }); };
  const delta = priceDelta(ref, cand);
  const budgetV = delta == null ? 0.5 : Math.max(0, 1 - Math.abs(delta) / 100);

  if (ref.category === 'parfum') {
    const layers = [['top', 1], ['heart', 1.5], ['base', 1.3]];
    let sh = 0, un = 0; const sharedNotes = new Set();
    for (const [k, w] of layers) {
      const A = setOf(ref[k]), B = setOf(cand[k]);
      for (const x of new Set([...A, ...B])) { un += w; if (A.has(x) && B.has(x)) { sh += w; sharedNotes.add(x); } }
    }
    const allA = setOf(ref.allNotes), allB = setOf(cand.allNotes);
    for (const x of allA) if (allB.has(x) && !sharedNotes.has(x)) { sh += 0.5; sharedNotes.add(x); } // note présente dans une autre couche
    const notesV = un ? Math.min(1, sh / un) : 0;
    add('Notes', notesV, 38, `${sharedNotes.size} note(s) commune(s)`);
    const acc = jac(ref.accords, cand.accords); add('Accords', acc.v, 22, `${acc.shared.length} accord(s) commun(s)`);
    const fam = jac(ref.families, cand.families); add('Familles', fam.v, 20, fam.shared.length ? 'famille commune' : 'familles différentes');
    const cr = concRank[ref.concentration], cc = concRank[cand.concentration];
    add('Concentration', cr == null || cc == null ? 0.5 : cr === cc ? 1 : Math.abs(cr - cc) === 1 ? 0.5 : 0, 8, cr === cc ? 'identique' : 'différente');
    add('Intensité', ref.intensity && cand.intensity ? 1 - Math.abs(ref.intensity - cand.intensity) / 4 : 0.5, 7, ref.intensity && cand.intensity ? `${cand.intensity}/5 vs ${ref.intensity}/5` : 'donnée manquante');
    add('Budget', budgetV, 5, delta == null ? 'prix indisponible' : 'proximité du prix au ml');

    const sn = orig(ref.allNotes, [...sharedNotes]).map((n) => n.toLowerCase());
    if (sn.length) reasons.push(`Notes communes : ${sn.join(', ')}.`);
    if (acc.shared.length) reasons.push(`Accords communs : ${orig(ref.accords, acc.shared).join(', ')}.`);
    if (fam.shared.length) reasons.push(`Même famille olfactive : ${orig(ref.families, fam.shared).join(', ')}.`);
    if (cr === cc && cr != null) reasons.push(`Même concentration (${concName[ref.concentration]}).`);
    const onlyRef = ref.allNotes.filter((n) => !allB.has(norm(n))).slice(0, 3), onlyCand = cand.allNotes.filter((n) => !allA.has(norm(n))).slice(0, 3);
    if (onlyRef.length) diffs.push(`Absent de l’alternative : ${onlyRef.join(', ').toLowerCase()}.`);
    if (onlyCand.length) diffs.push(`Propre à l’alternative : ${onlyCand.join(', ').toLowerCase()}.`);
    if (cr !== cc && cr != null && cc != null) diffs.push(`Concentration différente (${concName[cand.concentration]} vs ${concName[ref.concentration]}).`);
    if (ref.gender !== cand.gender) diffs.push(`Genre commercialisé différent (${genderName(cand.gender)} vs ${genderName(ref.gender)}).`);
    if (ref.intensity && cand.intensity && Math.abs(ref.intensity - cand.intensity) >= 2) diffs.push(`Intensité différente (${cand.intensity}/5 vs ${ref.intensity}/5).`);
  } else if (ref.category === 'maquillage') {
    if (ref.sub !== cand.sub) return null;
    const fin = ref.finish && ref.finish === cand.finish ? 1 : 0; add('Finition', fin, 25, fin ? 'identique' : 'différente');
    const cov = ref.coverage && ref.coverage === cand.coverage ? 1 : ref.coverage || cand.coverage ? 0 : 0.5; add('Couvrance', cov, 20, cov === 1 ? 'identique' : 'différente');
    const tex = ref.texture && ref.texture === cand.texture ? 1 : 0; add('Texture', tex, 15, tex ? 'identique' : 'différente');
    let sh = 0.3;
    if (ref.shades.length && cand.shades.length) sh = 1 - Math.min(1, Math.min(...ref.shades.flatMap((a) => cand.shades.map((b) => hexDist(a.hex, b.hex)))) * 4);
    add('Teintes proches', sh, 25, 'distance colorimétrique indicative');
    add('Fonction', 1, 5, ref.sub);
    add('Budget', budgetV, 10, 'proximité de prix');
    reasons.push(`Même fonction : ${ref.sub}.`);
    if (fin) reasons.push(`Même finition : ${ref.finish}.`);
    if (cov === 1 && ref.coverage) reasons.push(`Même couvrance : ${ref.coverage}.`);
    if (tex) reasons.push(`Même texture : ${ref.texture}.`);
    if (sh > 0.6) reasons.push('Teintes proches dans la gamme.');
    if (ref.finish && ref.finish !== cand.finish) diffs.push(`Finition différente (${cand.finish} vs ${ref.finish}).`);
  } else { // skincare, cheveux, corps
    const sameSub = ref.sub === cand.sub;
    add('Fonction', sameSub ? 1 : 0.3, 25, sameSub ? ref.sub : 'fonction voisine');
    const act = jac(ref.actives, cand.actives); add('Actifs', act.v, 35, `${act.shared.length} actif(s) commun(s)`);
    const hair = ref.category === 'cheveux';
    const sk = hair ? jac(ref.hair, cand.hair) : jac(ref.skin, cand.skin); add(hair ? 'Type de cheveux' : 'Type de peau', sk.v, 15, 'indications du fabricant');
    const tex = ref.texture && ref.texture === cand.texture ? 1 : 0.3; add('Texture', tex, 10, ref.texture || 'inconnue');
    const a = ref.formats.at(-1)?.size, b = cand.formats.at(-1)?.size;
    add('Format', a && b ? 1 - Math.min(1, Math.abs(a - b) / Math.max(a, b)) : 0.5, 5, 'contenance comparable');
    add('Budget', budgetV, 10, 'proximité de prix');
    if (sameSub) reasons.push(`Même fonction : ${ref.sub}.`);
    if (act.shared.length) reasons.push(`Actifs communs : ${orig(ref.actives, act.shared).join(', ').toLowerCase()}.`);
    if (sk.shared.length) reasons.push(`${hair ? 'Cheveux' : 'Peaux'} ciblé(e)s en commun : ${orig(hair ? ref.hair : ref.skin, sk.shared).join(', ')}.`);
    if (tex === 1 && ref.texture) reasons.push(`Même texture : ${ref.texture}.`);
    const onlyRef = (ref.actives || []).filter((x) => !setOf(cand.actives).has(norm(x)));
    if (onlyRef.length) diffs.push(`Actif(s) absent(s) de l’alternative : ${onlyRef.join(', ').toLowerCase()}.`);
  }

  if (delta != null) {
    if (delta < -4) reasons.push(`Son prix au ${ref.formats[0]?.unit === 'unité' ? 'produit' : 'ml'} est inférieur de ${Math.abs(delta)} %.`);
    else if (delta > 4) diffs.push(`Son prix est supérieur de ${delta} %.`);
  }
  const total = criteria.reduce((s, c) => s + c.weight, 0);
  return { score: Math.round((score / total) * 100), criteria, reasons, differences: diffs, summary: reasons.slice(0, 3).join(' '), priceDelta: delta };
}

export function findSimilar(catalog, ref, { cheaper = false, limit = 8, minScore = 35, maxPrice } = {}) {
  const out = [];
  for (const c of catalog.products) {
    const s = similarity(ref, c);
    if (!s || s.score < minScore || c.summary.minPrice == null) continue;
    if (cheaper && !(s.priceDelta != null && s.priceDelta < -4)) continue;
    if (maxPrice != null && c.summary.minPrice > maxPrice) continue;
    out.push({ product: catalog.card(c), similarity: s });
  }
  out.sort((a, b) => b.similarity.score - a.similarity.score);
  return out.slice(0, limit);
}
export { genderName };

// Génération du jeu de données de DÉMONSTRATION. Tout est fictif et marqué demo=1.
import { tx } from './db.js';
import { rng, slugify, hashStr } from './lib/text.js';
import { hashPassword } from './lib/auth.js';
import { NOTES, FAMILIES } from './data/vocab.js';
import { REAL_PERFUMES, FICTIONAL_HOUSES, FAMILY_POOLS, NAME_PARTS } from './data/perfumes.js';
import { SKINCARE, MAKEUP, HAIR, BODY, SHADES } from './data/cosmetics.js';
import { randomBytes } from 'node:crypto';

const DAY = 86400000;
const iso = (d) => new Date(d).toISOString();
const J = JSON.stringify;
const famName = Object.fromEntries(FAMILIES.map((f) => [f.id, f.name]));
const NOTE_ACCORD = { Vanille: 'vanillé', 'Musc blanc': 'musqué', Ambre: 'ambré', Rose: 'rosé', Jasmin: 'jasmin', Santal: 'boisé crémeux', Cèdre: 'boisé sec', Oud: 'oud', Patchouli: 'terreux', Vétiver: 'vétiver', 'Fève tonka': 'tonka', Caramel: 'caramel', Praliné: 'praliné', Chocolat: 'chocolaté', Amande: 'amande', Café: 'café', Cuir: 'cuir', Tabac: 'tabac', Encens: 'encens', Safran: 'safran', Poivre: 'poivré', Cannelle: 'cannelle', Lavande: 'lavande', 'Notes marines': 'marin', Menthe: 'frais mentholé', Bergamote: 'agrumes', Citron: 'agrumes', Mandarine: 'agrumes', Pamplemousse: 'agrumes', Iris: 'poudré', Violette: 'poudré', Tubéreuse: 'floral blanc', 'Fleur d’oranger': 'floral blanc', Cerise: 'fruité', Poire: 'fruité', Pomme: 'fruité', Pêche: 'fruité', Framboise: 'fruité', Cassis: 'fruité', Figue: 'fruité', Ananas: 'fruité' };

export function eanFor(n) { // EAN-13 interne (préfixe 29 = usage interne, jamais un vrai code-barres)
  const base = ('29' + String(n).padStart(10, '0')).slice(0, 12);
  let s = 0; for (let i = 0; i < 12; i++) s += +base[i] * (i % 2 ? 3 : 1);
  return base + ((10 - (s % 10)) % 10);
}

function deriveSeasons(fams) {
  const out = new Set();
  for (const f of fams) {
    if (['hesperidee', 'aquatique', 'aromatique', 'florale'].includes(f)) out.add('printemps'), out.add('été');
    if (['orientale', 'gourmande', 'cuiree', 'epicee'].includes(f)) out.add('automne'), out.add('hiver');
    if (['boisee', 'chypree', 'fougere'].includes(f)) out.add('automne'), out.add('printemps');
  }
  return ['printemps', 'été', 'automne', 'hiver'].filter((s) => out.has(s));
}
const deriveOccasions = (int) => (int >= 4 ? ['soirée', 'rendez-vous', 'cérémonie'] : int <= 2 ? ['quotidien', 'bureau', 'sport'] : ['quotidien', 'bureau', 'rendez-vous']);

export function seed(db, { adminPassword } = {}) {
  const r = rng(20240601);
  const now = Date.now();
  const nowIso = iso(now);
  const out = { credentials: {} };

  tx(db, () => {
    // ---- Marques
    const brandIds = new Map();
    const addBrand = (name, fictional = false, desc = null) => {
      if (brandIds.has(name)) return brandIds.get(name);
      const res = db.prepare('INSERT INTO brands (slug,name,description,fictional,created_at) VALUES (?,?,?,?,?)').run(
        slugify(name), name, desc || (fictional ? 'Marque fictive de démonstration.' : 'Marque citée à titre d’exemple dans le catalogue de démonstration. Aucune relation commerciale ; informations non vérifiées.'), fictional ? 1 : 0, nowIso);
      brandIds.set(name, Number(res.lastInsertRowid));
      return brandIds.get(name);
    };

    const slugs = new Set();
    const uniqueSlug = (s) => { let x = s, i = 2; while (slugs.has(x)) x = `${s}-${i++}`; slugs.add(x); return x; };
    let ean = 1000;
    const insProduct = db.prepare(`INSERT INTO products (slug,name,brand_id,category,subcategory,description,gender,year,perfumer,concentration,families,accords,notes_top,notes_heart,notes_base,intensity,seasons,occasions,actives,skin_types,hair_types,inci,texture,finish,coverage,shades,image_source,source,verified,demo,popularity,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
    const insFormat = db.prepare('INSERT INTO formats (product_id,size,unit,ean,ref_price) VALUES (?,?,?,?,?)');
    const productMeta = []; // {pid, formats:[{id,ref}], category, brand}

    const addProduct = (p, formats) => {
      const f = p.families || [];
      const res = insProduct.run(
        uniqueSlug(slugify(`${p.brand} ${p.name}${p.concentration ? ' ' + p.concentration : ''}`)), p.name, addBrand(p.brand), p.category, p.subcategory ?? null, p.description,
        p.gender ?? null, p.year || null, null, p.concentration ?? null, J(f), J(p.accords || []), J(p.top || []), J(p.heart || []), J(p.base || []),
        p.intensity ?? null, J(p.seasons || []), J(p.occasions || []), J(p.actives || []), J(p.skin || []), J(p.hair || []), null, p.texture ?? null,
        p.finish ?? null, p.coverage ?? null, J(p.shades || []), 'illustration-démo', 'catalogue-démo', 0, 1, r.int(5, 100), nowIso, nowIso);
      const pid = Number(res.lastInsertRowid);
      const fm = formats.map(([size, unit, ref]) => {
        const fr = insFormat.run(pid, size, unit, eanFor(ean++), ref);
        return { id: Number(fr.lastInsertRowid), ref, size, unit };
      });
      productMeta.push({ pid, formats: fm, category: p.category, brand: p.brand });
    };

    const noteSet = new Set(NOTES.map((n) => n.name));
    const accordsOf = (fams, ...lists) => {
      const a = [];
      for (const n of lists.flat()) { const x = NOTE_ACCORD[n]; if (x && !a.includes(x)) a.push(x); }
      const famAcc = fams.map((f) => famName[f].split(' ')[0].toLowerCase());
      return [...new Set([...a.slice(0, 4), ...famAcc])].slice(0, 6);
    };
    const perfumeFormats = (p100, conc) => {
      const sizes = p100 < 60 ? [50, 100] : conc === 'cologne' ? [30, 100] : p100 > 200 ? [50, 100] : [30, 50, 100];
      return sizes.map((s) => [s, 'ml', Math.round(p100 * Math.pow(s / 100, 0.8))]);
    };
    const GEN = { F: 'féminin', H: 'masculin', M: 'mixte' };
    const mkPerfumeDesc = (name, brand, g, fams, top, heart, base, fict) =>
      `${name} est un parfum ${GEN[g]} de ${brand}, de famille ${fams.map((f) => famName[f].toLowerCase()).join(' / ')}, construit autour de ${[...top, ...heart, ...base].slice(0, 4).join(', ').toLowerCase()}. ${fict ? 'Parfum entièrement fictif' : 'Fiche de démonstration'} : informations non vérifiées par la marque.`;

    // ---- Parfums réels (données de démonstration)
    for (const line of REAL_PERFUMES.split('\n')) {
      const [brand, name, year, g, conc, fams, top, heart, base, int, p100] = line.split('|');
      const T = top.split(','), H = heart.split(','), B = base.split(',');
      for (const n of [...T, ...H, ...B]) if (!noteSet.has(n)) throw new Error('Note inconnue: ' + n + ' (' + name + ')');
      const f = fams.split(',');
      addProduct({ brand, name, category: 'parfum', subcategory: 'parfum', gender: g, year: +year, concentration: conc, families: f, top: T, heart: H, base: B, intensity: +int,
        accords: accordsOf(f, B, H, T), seasons: deriveSeasons(f), occasions: deriveOccasions(+int), description: mkPerfumeDesc(name, brand, g, f, T, H, B, false) },
      perfumeFormats(+p100, conc));
    }
    // ---- Parfums fictifs (jusqu'à 200 au total)
    const houses = FICTIONAL_HOUSES;
    for (const [h, d] of houses) addBrand(h, true, d);
    const fkeys = Object.keys(FAMILY_POOLS);
    const usedNames = new Set();
    let total = REAL_PERFUMES.split('\n').length;
    while (total < 205) {
      const [house] = r.pick(houses);
      const fam = r.pick(fkeys);
      const f2 = r() < 0.4 ? r.pick(fkeys.filter((x) => x !== fam)) : null;
      const pool = FAMILY_POOLS[fam];
      const pool2 = f2 ? FAMILY_POOLS[f2] : pool;
      const pickN = (arr, n) => r.shuffle([...new Set(arr)]).slice(0, n);
      const T = pickN(pool.top, 2), H = pickN([...pool.heart, ...pool2.heart], r.int(2, 3)), B = pickN([...pool.base, ...pool2.base], r.int(2, 3));
      const name = `${r.pick(NAME_PARTS.a)} ${r.pick(NAME_PARTS.b)}`;
      if (usedNames.has(house + name)) continue;
      usedNames.add(house + name);
      const fams = f2 ? [fam, f2] : [fam];
      const g = r.pick(['F', 'H', 'M', 'M', 'F', 'H']);
      const conc = r.pick(['edp', 'edp', 'edt', 'edp', 'extrait']);
      const int = r.int(2, 5);
      const p100 = conc === 'extrait' ? r.int(110, 190) : conc === 'edt' ? r.int(45, 85) : r.int(60, 140);
      addProduct({ brand: house, name, category: 'parfum', subcategory: 'parfum', gender: g, year: 0, concentration: conc, families: fams, top: T, heart: H, base: B, intensity: int,
        accords: accordsOf(fams, B, H, T), seasons: deriveSeasons(fams), occasions: deriveOccasions(int), description: mkPerfumeDesc(name, house, g, fams, T, H, B, true) },
      perfumeFormats(p100, conc));
      total++;
    }

    // ---- Skincare
    const sizeFmt = (size, price, unit = 'ml') => [[size, unit, price]];
    for (const line of SKINCARE.split('\n')) {
      const [brand, name, sub, size, price, actives, skin, texture] = line.split('|').map((x) => x.trim());
      const act = actives ? actives.split(',') : [];
      const sk = skin === 'toutes' || !skin ? ['sèche', 'grasse', 'mixte', 'normale', 'sensible'] : skin.split(',');
      const extraSize = +size >= 100 ? [] : [[Math.round(+size * 0.5 / 5) * 5 || 15, 'ml', Math.round(+price * 0.62 * 10) / 10]];
      addProduct({ brand, name, category: 'skincare', subcategory: sub, actives: act, skin: sk, texture,
        description: `${name} — ${sub} ${brand}${act.length ? ` contenant ${act.join(', ').toLowerCase()}` : ''}. Fiche de démonstration : liste INCI non renseignée ; les informations proviennent du catalogue de démo, non vérifiées.` },
      [...extraSize, [+size, 'ml', +price]]);
    }
    // ---- Maquillage
    for (const line of MAKEUP.split('\n')) {
      const [brand, name, sub, price, finish, coverage, texture, set] = line.split('|');
      const shades = (SHADES[set] || []).map(([n, hex]) => ({ n, hex }));
      addProduct({ brand, name, category: 'maquillage', subcategory: sub, finish, coverage: coverage === '—' ? null : coverage, texture, shades,
        description: `${name} — ${sub} ${brand}, finition ${finish}${coverage !== '—' ? `, couvrance ${coverage}` : ''}. Fiche de démonstration : informations non vérifiées.` },
      [[1, 'unité', +price]]);
    }
    // ---- Cheveux
    for (const line of HAIR.split('\n')) {
      const [brand, name, sub, size, price, types, actives] = line.split('|');
      const unit = +size === 1 ? 'unité' : 'ml';
      addProduct({ brand, name, category: 'cheveux', subcategory: sub, hair: types ? types.split(',') : [], actives: actives ? actives.split(',') : [],
        description: `${name} — ${sub} ${brand}${types ? ` pour cheveux ${types.replace(/,/g, ', ')}` : ''}. Fiche de démonstration : informations non vérifiées.` },
      [[+size, unit, +price]]);
    }
    // ---- Corps
    for (const line of BODY.split('\n')) {
      const [brand, name, sub, size, price, actives] = line.split('|');
      addProduct({ brand, name, category: 'corps', subcategory: sub, actives: actives ? actives.split(',') : [],
        description: `${name} — ${sub} ${brand}. Fiche de démonstration : informations non vérifiées.` },
      [[+size, 'ml', +price]]);
    }

    // ---- Marchands (tous fictifs)
    const merchants = [
      ['boutique-officielle-demo', 'Boutique Officielle (démo)', 'officiel', 1, 4.9, 50, 2, 'Site officiel de la marque (fictif). Vérifié : identité légale, mentions légales.'],
      ['parfumerie-lumiere', 'Parfumerie Lumière (démo)', 'revendeur_verifie', 1, 5.9, 69, 3, 'Revendeur professionnel fictif : SIRET et distribution sélective contrôlés (démo).'],
      ['beaute-directe', 'Beauté Directe (démo)', 'revendeur_verifie', 1, 4.5, 59, 2, 'Revendeur professionnel fictif : SIRET et avis clients contrôlés (démo).'],
      ['cosmetique-express', 'Cosmétique Express (démo)', 'marketplace', 0, 3.9, 49, 4, 'Place de marché fictive : vendeurs multiples, authenticité non garantie.'],
      ['galerie-beaute', 'Galerie Beauté (démo)', 'revendeur_verifie', 1, 6.5, 99, 3, 'Grand magasin fictif : revendeur agréé (démo).'],
      ['prixmini-parfums', 'PrixMini Parfums (démo)', 'tiers', 0, 2.9, null, 6, 'Vendeur tiers fictif : informations légales partielles.'],
      ['marche-beaute', 'Marché Beauté (démo)', 'marketplace', 0, 4.0, 60, 5, 'Place de marché fictive.'],
      ['outletparfum24', 'OutletParfum24 (démo)', 'non_verifie', 0, 1.9, null, 8, 'Vendeur fictif non vérifié : aucune vérification effectuée.'],
    ];
    const bias = [1.0, 0.97, 0.94, 0.9, 1.0, 0.86, 0.92, 0.82];
    const mIds = merchants.map((m, i) => {
      const res = db.prepare('INSERT INTO merchants (slug,name,type,verified,last_check,ship_fee,free_threshold,delivery_days,status,url,criteria,selected,contact) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run(
        m[0], m[1], m[2], m[3], m[3] ? iso(now - r.int(2, 20) * DAY) : null, m[4], m[5], m[6], 'active', `https://${m[0]}.demo.invalid`, m[7], i < 3 || i === 4 ? 1 : 0, `contact@${m[0]}.demo.invalid`);
      return Number(res.lastInsertRowid);
    });

    // ---- Offres + historique
    const insOffer = db.prepare('INSERT INTO offers (format_id,merchant_id,price,price_orig,available,url,source,fetched_at,verified_status,expires_at,demo) VALUES (?,?,?,?,?,?,?,?,?,?,1)');
    const insHist = db.prepare('INSERT OR REPLACE INTO price_history (format_id,day,price,kind) VALUES (?,?,?,?)');
    const prodSlug = db.prepare('SELECT slug FROM products WHERE id=?');
    for (const pm of productMeta) {
      const slug = prodSlug.get(pm.pid).slug;
      // Marchands proposant ce produit (l'ensemble varie par produit, déterministe)
      const nM = r.int(3, 7);
      const chosen = r.shuffle([0, 1, 2, 3, 4, 5, 6, 7]).slice(0, nM);
      for (const f of pm.formats) {
        let bestValid = Infinity;
        for (const mi of chosen) {
          if (r() < 0.12) continue; // certains marchands n'ont pas tous les formats
          const jitter = 0.97 + r() * 0.1;
          const price = Math.max(1.5, Math.round(f.ref * bias[mi] * jitter * 2) / 2);
          const promo = r() < 0.4;
          const orig = promo ? Math.round(price * (1.1 + r() * 0.28) * 2) / 2 : null;
          const stale = r() < 0.07;
          // Quelques promotions à durée limitée, dont certaines déjà expirées (démonstration du statut « expirée »)
          const expiresAt = promo ? (r() < 0.18 ? iso(now + r.int(1, 6) * DAY) : r() < 0.06 ? iso(now - r.int(1, 3) * DAY) : null) : null;
          const fetched = stale ? now - r.int(8, 16) * DAY : now - r.int(1, 40) * 3600000;
          const m = merchants[mi];
          const status = m[3] ? (stale ? 'obsolete' : 'verified') : 'unverified';
          const available = r() < 0.9 ? 1 : 0;
          insOffer.run(f.id, mIds[mi], price, orig, available, `https://${m[0]}.demo.invalid/produit/${slug}?format=${f.size}${f.unit}`, 'catalogue-démo', iso(fetched), status, expiresAt);
          if (available && status === 'verified' && price < bestValid) bestValid = price;
        }
        const cur = Number.isFinite(bestValid) ? bestValid : f.ref;
        // Historique FICTIF : 30 points journaliers puis hebdomadaires sur 1 an
        const mean = f.ref * (0.93 + r() * 0.1);
        let v = mean;
        const pts = [];
        for (let d = 0; d <= 364; d += d < 30 ? 1 : 7) pts.push(d);
        for (const d of pts.reverse()) {
          v = v + (mean - v) * 0.3 + (r() - 0.5) * mean * 0.06;
          if (r() < 0.04) v *= 0.88;
          const price = d === 0 ? cur : Math.max(1, Math.round(v * 2) / 2);
          insHist.run(f.id, new Date(now - d * DAY).toISOString().slice(0, 10), price, 'demo');
        }
      }
    }

    // ---- Codes promo (fictifs)
    const insCode = db.prepare('INSERT INTO promo_codes (code,merchant_id,type,value,min_amount,expires_at,conditions,categories,brands,verified_at,active) VALUES (?,?,?,?,?,?,?,?,?,?,1)');
    const codes = [
      ['DEMO10', 1, 'percent', 10, 40, 30, 'Valable sur tout le site, hors produits déjà soldés.', [], []],
      ['BIENVENUE15', 2, 'percent', 15, 60, 45, 'Première commande uniquement.', [], []],
      ['PARFUM5', 1, 'fixed', 5, 30, 20, 'Catégorie parfums uniquement.', ['parfum'], []],
      ['LIVRAISON0', 3, 'freeship', 0, 35, 15, 'Livraison offerte dès 35 € d’achat.', [], []],
      ['SOIN20', 3, 'percent', 20, 50, 10, 'Skincare uniquement, plafonné à 20 €.', ['skincare'], []],
      ['GALERIE8', 5, 'fixed', 8, 80, 25, 'Dès 80 € d’achat.', [], []],
      ['MAKEUP12', 4, 'percent', 12, 25, 12, 'Maquillage uniquement.', ['maquillage'], []],
      ['FREESHIP50', 6, 'freeship', 0, 50, 60, 'Livraison gratuite dès 50 €.', [], []],
      ['HAIR10', 7, 'percent', 10, 20, 18, 'Cheveux et corps.', ['cheveux', 'corps'], []],
      ['EXPIRE-DEMO', 2, 'percent', 25, 30, -5, 'Code expiré (démonstration du statut expiré).', [], []],
      ['OUTLET5', 8, 'fixed', 5, 25, 30, 'Vendeur non vérifié : conditions non contrôlées.', [], []],
      ['ETE-LUMIERE', 2, 'percent', 8, 0, 90, 'Sans minimum d’achat.', [], []],
    ];
    for (const [code, mid, type, value, min, days, cond, cats, brs] of codes)
      insCode.run(code, mIds[mid - 1], type, value, min, iso(now + days * DAY), cond, J(cats), J(brs), merchants[mid - 1][3] ? iso(now - DAY) : null);

    // ---- Avis de démonstration
    const insRev = db.prepare('INSERT INTO reviews (product_id,author,rating,text,demo,created_at) VALUES (?,?,?,?,1,?)');
    const authors = ['Utilisateur démo A', 'Utilisateur démo B', 'Utilisateur démo C', 'Utilisateur démo D'];
    const texts = ['Avis de démonstration : très agréable, correspond à la description.', 'Avis de démonstration : bon rapport qualité/prix.', 'Avis de démonstration : un peu trop intense à mon goût.', 'Avis de démonstration : tenue correcte sur la journée.', 'Avis de démonstration : texture confortable.'];
    for (const pm of productMeta) if (r() < 0.65) for (let i = 0; i < r.int(1, 3); i++)
      insRev.run(pm.pid, r.pick(authors), r.int(3, 5), r.pick(texts), iso(now - r.int(2, 200) * DAY));

    // ---- Utilisateurs de démonstration
    const adminPw = adminPassword || process.env.VELUNE_ADMIN_PASSWORD || randomBytes(12).toString('base64url') + 'A1!';
    db.prepare('INSERT INTO users (email,pw_hash,name,role,created_at) VALUES (?,?,?,?,?)').run('admin@velune.demo', hashPassword(adminPw), 'Administrateur démo', 'admin', nowIso);
    const userPw = 'Demo-Velune-2024!';
    const ur = db.prepare('INSERT INTO users (email,pw_hash,name,role,profile,created_at) VALUES (?,?,?,?,?,?)').run('user@velune.demo', hashPassword(userPw), 'Camille Démo', 'user',
      J({ consentPerso: true, parfum: { familles: ['gourmande', 'orientale'], notesAimees: ['Vanille', 'Ambre'], notesEvitees: ['Oud'], intensite: 4, marques: ['Guerlain', 'Lancôme'], budget: 100 }, skincare: { peau: 'mixte', preoccupations: ['hydratation'], actifsRecherches: ['Acide hyaluronique'], actifsEvites: [] } }), nowIso);
    db.prepare('INSERT INTO lists (user_id,name,is_default,created_at) VALUES (?,?,1,?)').run(Number(ur.lastInsertRowid), 'Favoris', nowIso);
    out.credentials = { adminEmail: 'admin@velune.demo', adminPassword: adminPw, userEmail: 'user@velune.demo', userPassword: userPw };

    // ---- File de rapprochements incertains (démonstration)
    const some = productMeta.filter((p) => p.category === 'parfum').slice(0, 6);
    const titles = ['Sauvage EDP 100ml Dior Homme (lot)', 'JADORE parfum femme 50 ml', 'Black Opium YSL eau de parfum', 'Bleu Chanel EDT homme', 'Baccarat 540 extrait MFK', 'Libre YSL 50ml'];
    some.forEach((p, i) => db.prepare('INSERT INTO matches (merchant_id,feed_title,feed_brand,feed_size,feed_ean,product_id,format_id,confidence,reason,status,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(
      mIds[i % 8], titles[i], null, null, null, p.pid, p.formats[0].id, 0.52 + i * 0.07, 'Nom normalisé proche, EAN absent, concentration incertaine.', 'pending', nowIso));
  });
  return out;
}

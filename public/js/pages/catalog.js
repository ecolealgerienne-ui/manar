import { html, raw, api, state, grid, spinner, empty, formValues, debounce, eur, CAT_NAMES, CONC, searchBox, attachSearch, toast } from '../lib.js';
import { setUrl } from '../router.js';

const INFO = {
  parfums: { category: 'parfum', title: 'Parfums', intro: 'Explorez par famille olfactive, notes et budget. Comparez formats et marchands, trouvez des alternatives.', desc: 'Catalogue de parfums : familles olfactives, notes, comparaison des prix et alternatives.' },
  skincare: { category: 'skincare', title: 'Skincare', intro: 'Recherchez un soin par ingrédient actif, type de peau ou besoin. Informations documentaires, sans promesse médicale.', desc: 'Soins du visage : comparez par actif, type de peau et prix au ml.' },
  maquillage: { category: 'maquillage', title: 'Maquillage', intro: 'Fonds de teint, mascaras, rouges à lèvres : filtrez par finition, couvrance, teinte et prix.', desc: 'Maquillage : comparez finitions, couvrances, teintes et prix.' },
  'cheveux-corps': { category: 'cheveux-corps', title: 'Cheveux & Corps', intro: 'Shampooings, masques, huiles, crèmes et gels douche : mêmes outils de comparaison et de promotions.', desc: 'Soins cheveux et corps comparés.' },
};
const SORTS = [['relevance', 'Pertinence'], ['price_asc', 'Prix croissant'], ['price_desc', 'Prix décroissant'], ['discount', 'Réduction la plus élevée'], ['new', 'Nouveautés'], ['popularity', 'Popularité'], ['value', 'Meilleur rapport quantité/prix']];
const FINISHES = ['mat', 'lumineuse', 'satinée', 'naturelle', 'brillante'];
const COVERS = ['légère', 'moyenne', 'élevée'];
const SUBS = { parfums: [], skincare: ['nettoyant', 'sérum', 'crème hydratante', 'crème de jour', 'contour des yeux', 'protection solaire', 'exfoliant', 'toner', 'soin ciblé', 'huile visage'], maquillage: ['fond de teint', 'correcteur', 'poudre', 'blush', 'bronzer', 'highlighter', 'mascara', 'eyeliner', 'rouge à lèvres', 'palette', 'pinceaux'], 'cheveux-corps': ['shampooing', 'après-shampooing', 'masque', 'huile', 'sérum', 'soin sans rinçage', 'appareil coiffant', 'crème', 'gommage', 'gel douche', 'déodorant', 'soin spécifique'] };
const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const checks = (name, items, sel = []) => items.map(([v, l]) => html`<label class="check"><input type="checkbox" name="${name}" value="${v}" ${sel.includes(String(v)) ? 'checked' : ''}> ${l}</label>`);
const L = (v) => (v ? String(v).split(',') : []);

function filtersHtml(cat, P) {
  const m = state.meta;
  return html`<form id="filters" aria-label="Filtres" autocomplete="off">
    ${cat === 'search' ? html`<details open><summary>Catégorie</summary><div class="opts">${checks('category_', Object.entries(CAT_NAMES), [])}<p class="small muted">Laissez vide pour toutes les catégories.</p></div></details>` : ''}
    <details open><summary>Budget (€)</summary><div class="row" style="margin-top:.5rem"><input name="minPrice" type="number" min="0" placeholder="Min" value="${P.minPrice || ''}" aria-label="Budget minimum" style="width:48%"><input name="maxPrice" type="number" min="0" placeholder="Max" value="${P.maxPrice || ''}" aria-label="Budget maximum" style="width:48%"></div></details>
    ${cat === 'parfums' || cat === 'search' ? html`<details ${P.gender || P.families || P.conc ? 'open' : ''}><summary>Parfum</summary><div class="opts" style="max-height:none">
      <p class="small muted" style="margin:.5rem 0 .2rem">Genre</p>${[['', 'Tous'], ['F', 'Femme'], ['H', 'Homme'], ['M', 'Mixte']].map(([v, l]) => html`<label class="check"><input type="radio" name="gender" value="${v}" ${(P.gender || '') === v ? 'checked' : ''}> ${l}</label>`)}
      <p class="small muted" style="margin:.5rem 0 .2rem">Familles olfactives</p>${checks('families', m.families.map((f) => [f.id, f.name]), L(P.families))}
      <p class="small muted" style="margin:.5rem 0 .2rem">Concentration</p>${checks('conc', m.concentrations.map((c) => [c.id, c.name]), L(P.conc))}
      <p class="small muted" style="margin:.5rem 0 .2rem">Notes</p><div class="chips">${['Vanille', 'Rose', 'Musc blanc', 'Ambre', 'Santal', 'Bergamote', 'Oud', 'Jasmin'].map((n) => html`<label class="chip" style="cursor:pointer"><input type="checkbox" name="notes" value="${n}" ${L(P.notes).includes(n) ? 'checked' : ''} style="display:none"> ${n}</label>`)}</div></div></details>` : ''}
    ${cat === 'skincare' || cat === 'search' ? html`<details ${P.skin || P.sub ? 'open' : ''}><summary>Soin visage</summary><div class="opts" style="max-height:none"><p class="small muted">Type de peau</p>${checks('skin', m.skinTypes.map((x) => [x, x]), L(P.skin))}</div></details>` : ''}
    ${cat === 'maquillage' || cat === 'search' ? html`<details ${P.finish || P.coverage ? 'open' : ''}><summary>Maquillage</summary><div class="opts" style="max-height:none"><p class="small muted">Finition</p>${checks('finish', FINISHES.map((x) => [x, x]), L(P.finish))}<p class="small muted">Couvrance</p>${checks('coverage', COVERS.map((x) => [x, x]), L(P.coverage))}</div></details>` : ''}
    ${cat === 'cheveux-corps' ? html`<details ${P.hair ? 'open' : ''}><summary>Type de cheveux</summary><div class="opts">${checks('hair', m.hairTypes.map((x) => [x, x]), L(P.hair))}</div></details>` : ''}
    <details ${P.brands ? 'open' : ''}><summary>Marques</summary><input type="search" id="brand-q" placeholder="Filtrer les marques" style="margin-top:.5rem" aria-label="Filtrer la liste des marques"><div class="opts" id="brand-list">${checks('brands', m.brands.map((b) => [b.slug, b.name]), L(P.brands))}</div></details>
    <details ${P.merchants ? 'open' : ''}><summary>Marchands</summary><div class="opts">${checks('merchants', m.merchants.map((x) => [x.id, x.name]), L(P.merchants))}</div></details>
    <details open><summary>Offres</summary><div class="opts" style="max-height:none">
      <label class="check"><input type="checkbox" name="promo" value="1" ${P.promo === '1' ? 'checked' : ''}> En promotion</label>
      <label class="check"><input type="checkbox" name="available" value="1" ${P.available === '1' ? 'checked' : ''}> Disponible</label>
      <label class="check"><input type="checkbox" name="freeShipping" value="1" ${P.freeShipping === '1' ? 'checked' : ''}> Livraison gratuite</label>
      <label class="check"><input type="checkbox" name="verified" value="1" ${P.verified === '1' ? 'checked' : ''}> Vendeurs vérifiés uniquement</label></div></details>
    <button type="button" class="link small" id="reset">Réinitialiser les filtres</button>
  </form>`;
}

async function build({ info, cat, ctx, searchMode }) {
  const P = { ...ctx.query };
  if (info) P.category = info.category;
  const subs = info ? SUBS[ctx.path.slice(1)] : [];
  const title = searchMode ? (P.q ? `Résultats pour « ${P.q} »` : 'Recherche') : info.title;
  return {
    title: `${title} | VELUNE`, desc: info?.desc || 'Recherche de produits beauté : nom, marque, notes, ingrédients, budget.',
    html: html`<div class="container" style="padding-top:1.5rem">
      ${searchMode ? html`<h1 class="sr">Recherche</h1><div id="s-top" style="max-width:720px;margin:0 auto 1.5rem">${searchBox('lg', 'Ex. : crème hydratante acide hyaluronique peau sèche', P.q || '')}</div>` : html`<div class="crumbs"><a href="/">Accueil</a> › ${info.title}</div><h1>${info.title}</h1><p class="muted" style="max-width:62ch">${info.intro}</p>
        ${info.category === 'parfum' ? html`<p><a class="btn btn-gold" href="/trouver-mon-parfum">Trouver mon parfum (recherche olfactive)</a></p>` : ''}
        ${subs.length ? html`<div class="chips" style="margin-bottom:1.2rem" id="subs">${subs.map((s) => html`<button class="chip" data-sub="${s}" aria-pressed="${P.sub === s}">${s}</button>`)}</div>` : ''}`}
      <div class="catalog"><aside><button class="btn btn-sm filters-toggle" id="ft" aria-expanded="false" style="margin-bottom:1rem">Filtres</button><div class="filters" id="fpanel">${filtersHtml(cat, P)}</div></aside>
      <section aria-live="polite"><div id="results">${spinner()}</div></section></div></div>`,
    mount(root) {
      if (searchMode) attachSearch(root.querySelector('#s-top'));
      const form = root.querySelector('#filters'); const out = root.querySelector('#results');
      root.querySelector('#ft').onclick = (e) => { const o = root.querySelector('#fpanel').classList.toggle('open'); e.target.setAttribute('aria-expanded', o); };
      let params = { ...P }; let page = 1; let accumulated = [];
      const collect = () => {
        const v = formValues(form); const o = { ...params };
        const arr = (x) => (x === undefined ? undefined : (Array.isArray(x) ? x : [x]).filter(Boolean).join(',') || undefined);
        Object.assign(o, { minPrice: v.minPrice || undefined, maxPrice: v.maxPrice || undefined, gender: v.gender || undefined, families: arr(v.families), conc: arr(v.conc), notes: arr(v.notes), skin: arr(v.skin), finish: arr(v.finish), coverage: arr(v.coverage), hair: arr(v.hair), brands: arr(v.brands), merchants: arr(v.merchants), promo: v.promo, available: v.available, freeShipping: v.freeShipping, verified: v.verified });
        if (searchMode) o.category = arr(v.category_)?.split(',').length === 1 ? arr(v.category_) : undefined;
        delete o.page; return o;
      };
      const urlOf = (o) => { const q = new URLSearchParams(); for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== '' && !(info && k === 'category')) q.set(k, v); const s = q.toString(); return ctx.path + (s ? '?' + s : ''); };
      async function load(reset = true) {
        if (reset) { page = 1; accumulated = []; out.innerHTML = spinner().s; }
        try {
          const r = await api('/api/search', { query: { ...params, page, pageSize: 24 } });
          accumulated.push(...r.items);
          out.innerHTML = view(r).s;
          bindResults(r);
        } catch (e) { out.innerHTML = html`<div class="notice err" role="alert">${e.message} <button class="link" id="retry">Réessayer</button></div>`.s; out.querySelector('#retry')?.addEventListener('click', () => load()); }
      }
      const view = (r) => html`
        <div class="toolbar"><div><strong>${r.total}</strong> résultat${r.total > 1 ? 's' : ''}${r.parsed.priceMax ? html` <span class="muted small">(prix ≤ ${eur(r.parsed.priceMax)} sur au moins un format)</span>` : ''}</div>
          <label class="row small" style="gap:.5rem">Trier par <select id="sort" aria-label="Trier par">${SORTS.map(([v, l]) => html`<option value="${v}" ${(params.sort || 'relevance') === v ? 'selected' : ''}>${l}</option>`)}</select></label></div>
        ${r.active.length ? html`<div class="active-filters" aria-label="Filtres actifs">${r.active.map((a) => html`<span class="tag">${a.label}</span>`)}</div>` : ''}
        ${r.ignored?.length ? html`<p class="small muted">Termes non reconnus (ignorés) : ${r.ignored.join(', ')}.</p>` : ''}
        ${r.similarTo ? html`<div class="notice">Produits proches de <a href="/produit/${r.similarTo.slug}">${r.similarTo.brand} ${r.similarTo.name}</a>. Score indicatif, non scientifique ; une alternative n’est jamais une copie.</div>` : ''}
        ${r.notFound ? html`<div class="notice err">Aucun produit « ${r.notFound} » n’a été trouvé dans le catalogue pour la recherche par similarité.</div>` : ''}
        ${accumulated.length ? html`${r.similarTo ? html`<div class="grid sims">${accumulated.map((p) => html`<div class="sim"><div>${productCardLite(p)}</div><div class="info"><p><strong>Score indicatif : ${p.similarity.score} %</strong></p><p class="small">${p.similarity.summary || ''}</p>${p.similarity.differences.map((d) => html`<p class="small muted">${d}</p>`)}</div></div>`)}</div>` : grid(accumulated, { showMatch: true })}
          ${accumulated.length < r.total ? html`<div class="center" style="margin-top:1.5rem"><button class="btn" id="more">Voir plus (${r.total - accumulated.length})</button></div>` : ''}`
        : empty('Aucun résultat', r.q || Object.keys(params).length > 1 ? 'Essayez d’élargir votre budget, de retirer un filtre ou de simplifier la requête (ex. « parfum vanillé »).' : 'Aucun produit pour le moment.', html`<button class="btn" id="reset2">Réinitialiser les filtres</button>`)}`;
      const productCardLite = (p) => raw(cardHtml(p));
      function bindResults(r) {
        out.querySelector('#sort')?.addEventListener('change', (e) => { params.sort = e.target.value; setUrl(urlOf(params)); load(); });
        out.querySelector('#more')?.addEventListener('click', () => { page++; load(false); });
        out.querySelector('#reset2')?.addEventListener('click', reset);
        void r;
      }
      function reset() { form.reset(); form.querySelectorAll('input[type=checkbox],input[type=radio]').forEach((i) => { i.checked = false; }); params = { q: searchMode ? params.q : undefined, category: info?.category, sort: params.sort }; setUrl(urlOf(params)); load(); }
      form.addEventListener('change', () => { params = collect(); setUrl(urlOf(params)); load(); });
      form.addEventListener('input', debounce((e) => { if (e.target.type === 'number') { params = collect(); setUrl(urlOf(params)); load(); } }, 500));
      form.addEventListener('submit', (e) => e.preventDefault());
      root.querySelector('#reset').onclick = reset;
      root.querySelector('#brand-q').addEventListener('input', (e) => { const q = norm(e.target.value); root.querySelectorAll('#brand-list .check').forEach((l) => { l.style.display = norm(l.textContent).includes(q) ? '' : 'none'; }); });
      root.querySelector('#subs')?.addEventListener('click', (e) => { const b = e.target.closest('[data-sub]'); if (!b) return; params.sub = params.sub === b.dataset.sub ? undefined : b.dataset.sub; root.querySelectorAll('[data-sub]').forEach((x) => x.setAttribute('aria-pressed', x.dataset.sub === params.sub)); setUrl(urlOf(params)); load(); });
      // chips de notes : état visuel
      form.querySelectorAll('.chip input').forEach((i) => { const sync = () => i.parentElement.classList.toggle('on', i.checked); i.addEventListener('change', sync); sync(); });
      void toast;
      load();
    },
  };
}
import { productCard } from '../lib.js';
const cardHtml = (p) => productCard(p, { showMatch: false }).s;

export default function catalogPage(ctx) {
  const key = ctx.path.slice(1);
  return build({ info: INFO[key], cat: key, ctx });
}
export function searchPage(ctx) { return build({ cat: 'search', ctx, searchMode: true }); }
void CONC;

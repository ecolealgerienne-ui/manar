import { html, api, grid, CAT_NAMES, state, empty } from '../lib.js';

export default async function brands(ctx) {
  const { brands } = await api('/api/brands', { query: { category: ctx.query.category } });
  const letters = [...new Set(brands.map((b) => b.name[0].toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '')))].sort();
  return {
    title: 'Marques de beauté A–Z | VELUNE', desc: 'Toutes les marques du catalogue.',
    html: html`<div class="container" style="padding-top:1.5rem"><div class="crumbs"><a href="/">Accueil</a> › Marques</div><h1>Marques</h1>
      <div class="row" style="margin-bottom:1rem"><div class="field grow" style="margin:0"><label class="sr" for="bq">Rechercher une marque</label><input id="bq" type="search" placeholder="Rechercher une marque"></div>
        <select id="bc" aria-label="Filtrer par catégorie" style="width:auto"><option value="">Toutes catégories</option>${Object.entries(CAT_NAMES).map(([k, v]) => html`<option value="${k}" ${ctx.query.category === k ? 'selected' : ''}>${v}</option>`)}</select></div>
      <div class="chips" id="az" style="margin-bottom:1.5rem" aria-label="Index alphabétique">${letters.map((l) => html`<a class="chip" href="#l-${l}">${l}</a>`)}</div>
      <div id="blist"></div></div>`,
    mount(root) {
      const list = root.querySelector('#blist');
      const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
      const draw = () => {
        const q = norm(root.querySelector('#bq').value);
        const f = brands.filter((b) => norm(b.name).includes(q));
        if (!f.length) { list.innerHTML = empty('Aucune marque', 'Aucune marque ne correspond à cette recherche.').s; return; }
        const by = {}; for (const b of f) (by[norm(b.name)[0].toUpperCase()] ||= []).push(b);
        list.innerHTML = Object.keys(by).sort().map((l) => html`<h2 id="l-${l}" style="margin-top:1.5rem;border-bottom:1px solid var(--line)">${l}</h2><div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(220px,1fr))">${by[l].map((b) => html`<a class="card" style="padding:.8rem 1rem;text-decoration:none" href="/marques/${b.slug}"><strong>${b.name}</strong><span class="small muted">${b.count} référence${b.count > 1 ? 's' : ''} · ${b.categories.map((c) => CAT_NAMES[c]).join(', ')}</span>${b.fictional ? html`<span class="tag demo" style="align-self:flex-start;margin-top:.3rem">Marque fictive</span>` : ''}</a>`)}</div>`).map((x) => x.s).join('');
      };
      root.querySelector('#bq').addEventListener('input', draw);
      root.querySelector('#bc').addEventListener('change', (e) => import('../router.js').then((m) => m.navigate('/marques' + (e.target.value ? '?category=' + e.target.value : ''))));
      draw();
    },
  };
}
export async function detail(ctx) {
  const d = await api('/api/brands/' + ctx.params[0]);
  const b = d.brand;
  return {
    title: `${b.name} : produits, offres et promotions | VELUNE`, desc: `${d.count} références ${b.name}.`,
    html: html`<div class="container" style="padding-top:1.5rem"><div class="crumbs"><a href="/">Accueil</a> › <a href="/marques">Marques</a> › ${b.name}</div>
      <div class="row" style="gap:2rem;margin-bottom:1.5rem"><img src="${b.logo}" alt="Monogramme ${b.name}" width="200" height="100" style="border:1px solid var(--line);border-radius:10px"><div><h1 style="margin:0">${b.name}</h1><p class="muted" style="max-width:60ch">${b.description || ''}</p>
        <p class="small">${d.count} référence${d.count > 1 ? 's' : ''} · ${d.categories.map((c) => CAT_NAMES[c]).join(', ')} ${b.fictional ? html`<span class="tag demo">Marque fictive</span>` : html`<span class="tag demo">Catalogue de démonstration</span>`}</p></div></div>
      ${d.bestOffers.length ? html`<h2>Meilleures offres</h2>${grid(d.bestOffers)}` : ''}
      <h2 style="margin-top:2rem">Nouveautés</h2>${grid(d.newest)}
      <h2 style="margin-top:2rem">Tous les produits (${d.count})</h2>${grid(d.products)}</div>`,
  };
}
void state;

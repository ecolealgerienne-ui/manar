import { html, api, grid, searchBox, attachSearch, eur, state, toast, formValues, showFieldErrors, productCard, MERCHANT_TYPES, ago } from '../lib.js';

const TILES = [['parfum', 'Parfums', '/parfums'], ['skincare', 'Skincare', '/skincare'], ['maquillage', 'Makeup', '/maquillage'], ['cheveux', 'Cheveux', '/cheveux-corps'], ['corps', 'Corps', '/cheveux-corps']];

export default async function home() {
  const d = await api('/api/home');
  const pop = state.meta.popularSearches;
  const hero = d.trending.slice(0, 2);
  const bm = d.beautyMatch, cmp = d.compare;
  return {
    title: 'MANOU — Beauty discovery & price intelligence', desc: 'Découvrez vos prochains favoris beauté et comparez les prix des boutiques en ligne.',
    html: html`
    <section class="hero"><div class="container hero-grid">
      <div>
        <p class="eyebrow">Discover · Compare · Save</p>
        <h1>La beauté que vous aimez. <em>Au meilleur prix.</em></h1>
        <p class="lead">Découvrez vos prochains favoris beauté et comparez les prix des boutiques en ligne.</p>
        <div class="search-wrap" id="hero-search">${searchBox('lg', 'Un parfum, une marque, une note, un produit...')}</div>
        <div class="row"><a class="btn btn-primary" href="/parfums">Découvrir</a><a class="btn" href="/promotions">Voir les promotions</a></div>
        <p class="hints">Essayez : ${pop.slice(0, 3).map((q) => html`<button type="button" data-q="${q}">${q}</button>`)}</p>
      </div>
      <div class="hero-art" aria-hidden="true">${hero.map((p) => html`<figure><img src="${p.image}" alt="" width="320" height="400"></figure>`)}</div>
    </div></section>

    <section class="block alt"><div class="container">
      <div class="sec-head"><div><p class="eyebrow">Univers</p><h2>Explorer par catégorie</h2></div></div>
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))">${TILES.map(([id, n, h]) => html`<a class="cat-tile" href="${h}"><img src="/img/p/${d.tiles[id]}.svg" alt="" loading="lazy" width="320" height="400"><div class="cap"><h3>${n}</h3><span class="small muted">${d.catCounts[id] || 0} références</span></div></a>`)}</div>
    </div></section>

    <section class="block"><div class="container">
      <div class="sec-head"><div><p class="eyebrow">Parfumerie</p><h2>Explorer les <em>familles olfactives</em></h2><p class="muted" style="max-width:60ch">Par notes, familles et accords : un guide pour trouver le parfum qui vous ressemble.</p></div><a class="btn btn-primary" href="/trouver-mon-parfum">Trouver mon parfum</a></div>
      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(190px,1fr));margin-bottom:2rem">${d.families.map((f) => html`<a class="fam-card" href="/parfums?families=${f.id}"><h3 style="margin:0">${f.name}</h3><p class="small muted" style="margin:.3rem 0 .6rem">${f.desc}</p><span class="tag">${f.count} parfums</span></a>`)}</div>
      <p class="eyebrow">Notes populaires</p>
      <div class="chips">${d.popularNotes.map((n) => html`<a class="chip" href="/parfums?notes=${encodeURIComponent(n.name)}">${n.name} <span class="muted small">${n.count}</span></a>`)}</div>
    </div></section>

    <section class="block alt"><div class="container">
      <div class="sec-head"><div><p class="eyebrow">The Manou Selection</p><h2>Vos envies beauté, <em>autrement.</em></h2><p class="muted">Explorez. Comparez. Trouvez votre prochain favori.</p></div><a class="btn btn-sm" href="/parfums">Tout le catalogue parfums</a></div>
      <h3>Populaires</h3>${grid(d.trending.slice(0, 4))}
      <h3 style="margin-top:2.5rem">Nouveautés</h3>${grid(d.newcomers.slice(0, 4))}
    </div></section>

    <section class="block"><div class="container">
      <div class="sec-head"><div><p class="eyebrow">Meilleures offres</p><h2>Les meilleures offres du moment</h2><p class="muted small">Réductions annoncées par des marchands vérifiés. Remise affichée ≠ économie réelle : consultez l’historique sur chaque fiche. Offres de démonstration.</p></div><a class="btn btn-sm" href="/promotions">Toutes les promotions</a></div>
      ${grid(d.bestOffers)}
      ${d.bestPromotions.length ? html`<h3 style="margin-top:2.5rem">Bien placées dans l’historique des prix</h3><p class="muted small">Classées selon l’écart à la moyenne observée et la proximité du minimum, pas seulement selon la remise (historique fictif en démonstration).</p>${grid(d.bestPromotions.slice(0, 4))}` : ''}
    </div></section>

    ${bm ? html`<section class="block"><div class="container"><div class="bm-block">
      <div class="sec-head"><div><span class="bm-badge">Beauty Match</span><h2 style="margin-top:.8rem">Des alternatives, <em>expliquées</em></h2><p class="muted" style="max-width:62ch">Partez d’un produit que vous aimez : Manou propose des produits proches, avec les raisons de la correspondance et l’écart de prix. Le score est indicatif, jamais une certitude scientifique, et une alternative n’est jamais une copie.</p></div></div>
      <div class="grid" style="grid-template-columns:minmax(0,260px) repeat(auto-fit,minmax(230px,1fr));align-items:start">
        <div><p class="small muted" style="margin:0 0 .4rem">Produit de référence</p>${productCard(bm.ref)}</div>
        ${bm.items.map((s) => html`<div><p class="small" style="margin:0 0 .4rem"><span class="tag" style="background:#fff">Score indicatif ${s.similarity.score} %</span> ${s.similarity.priceDelta < 0 ? html`<span class="tag ok">−${Math.abs(s.similarity.priceDelta)} % au ml</span>` : ''}</p>${productCard(s.product)}<p class="small muted" style="margin:.5rem 0 0">${s.similarity.summary}</p></div>`)}</div>
    </div></div></section>` : ''}

    ${cmp ? html`<section class="block alt"><div class="container">
      <div class="sec-head"><div><p class="eyebrow">Comparateur</p><h2>Le meilleur prix, <em>en toute transparence</em></h2><p class="muted" style="max-width:62ch">Prix, contenance, prix au ml, livraison, disponibilité et date de vérification : chaque ligne est claire. Le prix le plus bas n’est pas toujours la meilleure réduction.</p></div><a class="btn" href="/produit/${cmp.product.slug}/comparateur">Ouvrir le comparateur</a></div>
      <div class="table-wrap"><table class="t stack"><caption class="sr">Exemple de comparaison : ${cmp.product.name}</caption><thead><tr><th>${cmp.product.brand} ${cmp.product.name} · ${cmp.format}</th><th>Prix</th><th>Prix / 100 ml</th><th>Livraison</th><th>Prix total</th><th>Vérification</th></tr></thead><tbody>
        ${cmp.offers.map((o, i) => html`<tr class="${i === 0 ? 'best' : ''}"><td data-l="Marchand"><strong>${o.merchant.replace(' (démo)', '')}</strong> ${i === 0 ? html`<span class="best-badge">Meilleure offre</span>` : ''}<div class="small muted">${MERCHANT_TYPES[o.type]}</div></td><td data-l="Prix">${eur(o.price)}</td><td data-l="Prix / 100 ml">${eur(o.per100)}</td><td data-l="Livraison">${o.shipping === 0 ? 'Offerte' : eur(o.shipping)}</td><td data-l="Total"><strong>${eur(o.total)}</strong></td><td data-l="Vérification">relevé ${ago(o.fetchedAt)}</td></tr>`)}</tbody></table></div>
      <p class="small muted" style="margin-top:.8rem">Exemple basé sur des données de démonstration. Dernière actualisation des offres : ${ago(d.lastUpdate)}.</p>
    </div></section>` : ''}

    <section class="block newsletter"><div class="container"><div class="grid g2" style="align-items:center">
      <div><p class="eyebrow">Newsletter</p><h2>Les nouveautés et bonnes affaires, <em>sans bruit.</em></h2><p class="muted">Une sélection de nouveautés et de baisses de prix vérifiées. Désinscription à tout moment.</p></div>
      <form id="nl" novalidate><div class="nl-form"><label class="sr" for="nle">Votre adresse email</label><input id="nle" name="email" type="email" placeholder="Votre adresse email" autocomplete="email" required><button class="btn btn-primary">S’inscrire</button></div>
        <label class="check small"><input type="checkbox" name="consent" value="1"> J’accepte de recevoir la newsletter de Manou (voir la <a href="/confidentialite">politique de confidentialité</a>).</label></form>
    </div></div></section>`,
    mount(root) {
      attachSearch(root.querySelector('#hero-search'));
      root.querySelectorAll('.hints [data-q]').forEach((b) => b.addEventListener('click', () => import('../router.js').then((m) => m.navigate('/recherche?q=' + encodeURIComponent(b.dataset.q)))));
      root.querySelector('#nl').addEventListener('submit', async (e) => {
        e.preventDefault(); const f = e.target; f.querySelectorAll('.err').forEach((x) => x.remove()); const v = formValues(f);
        try { await api('/api/newsletter', { method: 'POST', body: { email: v.email, consent: !!v.consent } }); f.innerHTML = '<div class="notice ok" role="status">Merci ! Vous êtes inscrit(e) à la newsletter Manou.</div>'; } catch (er) { showFieldErrors(f, er); }
      });
    },
  };
}
void toast;

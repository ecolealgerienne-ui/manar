import { html, api, grid, searchBox, attachSearch, eur, state, CAT_NAMES, productCard, dateFr } from '../lib.js';

const TILES = [['parfum', 'Parfums', '/parfums', '#8F7650'], ['skincare', 'Skincare', '/skincare', '#7C8B6B'], ['maquillage', 'Maquillage', '/maquillage', '#9A5B52'], ['cheveux', 'Cheveux', '/cheveux-corps', '#5E6B7C'], ['corps', 'Corps', '/cheveux-corps', '#A58B6B']];

export default async function home() {
  const d = await api('/api/home');
  const pop = state.meta.popularSearches;
  return {
    title: 'VELUNE — Comparateur beauté : parfums, skincare, maquillage', desc: 'La beauté que vous aimez, au meilleur prix. Découvrez, comparez, économisez.',
    html: html`
    <section class="hero"><div class="container">
      <p class="eyebrow">Discover your beauty. Find your value.</p>
      <h1>La beauté que vous aimez. Au meilleur prix.</h1>
      <p class="lead">Découvrez les produits qui vous correspondent, comparez les offres et trouvez les meilleures opportunités beauté.</p>
      <div class="search-wrap" id="hero-search">${searchBox('lg', 'Ex. : parfum vanillé et musqué à moins de 80 €')}</div>
      <div class="row"><a class="btn btn-primary" href="/parfums">Explorer les parfums</a><a class="btn" href="/promotions">Découvrir les promotions</a></div>
      <p class="hints">Essayez : ${pop.slice(0, 4).map((q) => html`<button type="button" data-q="${q}">${q}</button>`)}</p>
    </div></section>

    <section class="block"><div class="container">
      <div class="sec-head"><div><p class="eyebrow">Sélection</p><h2>Les meilleures offres du moment</h2><p class="muted small">Réductions annoncées par des marchands vérifiés. Remise affichée ≠ économie réelle : consultez l’historique sur chaque fiche.</p></div><a class="btn btn-sm" href="/promotions">Toutes les promotions</a></div>
      ${grid(d.bestOffers)}
    </div></section>

    <section class="block alt"><div class="container">
      <div class="sec-head"><div><p class="eyebrow">Univers</p><h2>Explorer par catégorie</h2></div></div>
      <div class="grid g4" style="grid-template-columns:repeat(auto-fit,minmax(170px,1fr))">${TILES.map(([id, n, h, c]) => html`<a class="cat-tile" style="--bgc:${c}" href="${h}"><div><h3>${n}</h3><span class="small">${d.catCounts[id] || 0} références</span></div></a>`)}</div>
    </div></section>

    <section class="block"><div class="container">
      <div class="sec-head"><div><p class="eyebrow">Parfumerie</p><h2>Découvrir les parfums</h2></div><a class="btn btn-sm" href="/parfums">Tout le catalogue parfums</a></div>
      <h3>Par famille olfactive</h3>
      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr));margin-bottom:2rem">${d.families.map((f) => html`<a class="fam-card" href="/parfums?families=${f.id}"><h3 style="margin:0">${f.name}</h3><p class="small muted" style="margin:.3rem 0">${f.desc}</p><span class="tag">${f.count} parfums</span></a>`)}</div>
      <h3>Notes populaires</h3>
      <div class="chips" style="margin-bottom:2rem">${d.popularNotes.map((n) => html`<a class="chip" href="/parfums?notes=${encodeURIComponent(n.name)}">${n.name} <span class="muted small">${n.count}</span></a>`)}</div>
      <h3>Parfums tendances</h3>${grid(d.trending.slice(0, 4))}
      <h3 style="margin-top:2rem">Nouveautés du catalogue</h3>${grid(d.newcomers.slice(0, 4))}
    </div></section>

    <section class="block alt"><div class="container center">
      <p class="eyebrow">Découverte olfactive</p><h2>Trouver son parfum</h2>
      <p class="muted" style="max-width:56ch;margin:0 auto 1.4rem">Familles, notes recherchées ou exclues, intensité, saison, budget : un questionnaire qui classe les parfums par score de correspondance — et explique pourquoi.</p>
      <a class="btn btn-gold" href="/trouver-mon-parfum">Lancer la découverte olfactive</a>
    </div></section>

    <section class="block"><div class="container">
      <div class="sec-head"><div><p class="eyebrow">Maisons</p><h2>Les marques populaires</h2></div><a class="btn btn-sm" href="/marques">Toutes les marques</a></div>
      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">${d.popularBrands.map((b) => html`<a class="brand-tile" href="/marques/${b.slug}"><img src="/img/b/${b.slug}.svg" alt="Monogramme ${b.name}" loading="lazy" width="240" height="120"></a>`)}</div>
    </div></section>

    <section class="block alt"><div class="container">
      <div class="sec-head"><div><p class="eyebrow">Au meilleur moment</p><h2>Les meilleures promotions</h2><p class="muted small">Classées selon l’<strong>historique des prix</strong> (écart à la moyenne observée et proximité du minimum), pas uniquement selon le pourcentage de remise. Historique fictif en démonstration.</p></div></div>
      ${d.bestPromotions.length ? grid(d.bestPromotions.slice(0, 4)) : html`<p class="muted">Pas assez d’historique pour qualifier une offre d’exceptionnelle.</p>`}
    </div></section>

    <section class="block"><div class="container">
      <div class="center" style="margin-bottom:2.5rem"><p class="eyebrow">Notre approche</p><h2>Pourquoi VELUNE ?</h2></div>
      <div class="pillars">
        <div class="pillar"><div class="n">01</div><h3>Comparaison transparente</h3><p class="muted">Prix annoncé, prix de référence et prix historiquement observé sont distingués. Prix au ml et livraison inclus. Classement jamais fondé sur les commissions.</p></div>
        <div class="pillar"><div class="n">02</div><h3>Marchands sélectionnés</h3><p class="muted">Chaque marchand est typé (officiel, revendeur vérifié, marketplace…) avec la date de son dernier contrôle. Nous ne garantissons pas l’authenticité sans preuve.</p></div>
        <div class="pillar"><div class="n">03</div><h3>Recherche personnalisée</h3><p class="muted">Langage naturel, notes à inclure ou exclure, alternatives moins chères expliquées, profil beauté facultatif et modifiable à tout moment.</p></div>
      </div>
      <p class="center small muted" style="margin-top:2rem">Dernière actualisation des offres de démonstration : ${dateFr(d.lastUpdate)}.</p>
    </div></section>`,
    mount(root) {
      attachSearch(root.querySelector('#hero-search'));
      root.querySelectorAll('.hints [data-q]').forEach((b) => b.addEventListener('click', () => import('../router.js').then((m) => m.navigate('/recherche?q=' + encodeURIComponent(b.dataset.q)))));
    },
  };
}
void eur; void CAT_NAMES; void productCard;

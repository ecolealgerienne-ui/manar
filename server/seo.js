// Métadonnées SEO et contenu serveur (rendu pour les robots) des pages publiques.
import { esc } from './lib/images.js';
import { CATEGORIES, GUIDES, FAQ, FAMILIES } from './data/vocab.js';
import { PAGES } from './data/pages.js';

export const STATIC_ROUTES = {
  '/': ['VELUNE — Comparateur beauté : parfums, skincare, maquillage', 'Découvrez les produits beauté qui vous correspondent, comparez les offres et trouvez les meilleures promotions auprès de marchands sélectionnés.'],
  '/parfums': ['Parfums : découvrir, comparer et trouver au meilleur prix | VELUNE', 'Explorez les parfums par famille olfactive, notes et budget, comparez les prix entre marchands et trouvez des alternatives.'],
  '/skincare': ['Skincare : comparer les soins visage par ingrédient et type de peau | VELUNE', 'Comparez les soins du visage selon les actifs, le type de peau et le prix au ml.'],
  '/maquillage': ['Maquillage : fond de teint, mascara, rouge à lèvres au meilleur prix | VELUNE', 'Comparez les produits de maquillage par finition, couvrance et teinte.'],
  '/cheveux-corps': ['Cheveux et corps : soins capillaires et corporels comparés | VELUNE', 'Shampooings, masques, huiles, crèmes et gels douche : comparez les offres.'],
  '/promotions': ['Promotions beauté et codes promo vérifiés | VELUNE', 'Les promotions beauté classées selon l’historique des prix, avec date de vérification et conditions des codes promotionnels.'],
  '/marques': ['Marques de beauté A–Z | VELUNE', 'Toutes les marques du catalogue : parfums, soins, maquillage.'],
  '/recherche': ['Recherche de produits beauté | VELUNE', 'Recherchez par produit, marque, note olfactive, ingrédient ou budget.'],
  '/trouver-mon-parfum': ['Trouver mon parfum : recherche olfactive avancée | VELUNE', 'Combinez familles, notes de tête, cœur et fond, intensité et budget pour trouver votre parfum.'],
  '/comparateur-panier': ['Comparateur de panier multi-boutiques | VELUNE', 'Comparez le coût total de votre panier beauté chez chaque marchand, livraison comprise.'],
  '/ingredients': ['Base d’ingrédients cosmétiques | VELUNE', 'Niacinamide, acide hyaluronique, rétinol… fonction cosmétique et sources documentaires.'],
  '/guides': ['Guides beauté | VELUNE', 'Comprendre les familles olfactives, les concentrations, les actifs skincare et comparer les prix.'],
  '/contact': ['Contact | VELUNE', 'Écrivez-nous : questions, signalements, demandes relatives à vos données.'],
  '/faq': ['FAQ | VELUNE', 'Questions fréquentes sur le fonctionnement de VELUNE.'],
  '/a-propos': [null, null], '/mentions-legales': [null, null], '/confidentialite': [null, null], '/conditions': [null, null], '/cookies': [null, null],
  '/connexion': ['Connexion | VELUNE', 'Connectez-vous à votre espace beauté.'],
  '/inscription': ['Créer un compte | VELUNE', 'Créez votre compte VELUNE et votre profil beauté.'],
};
const PRIVATE_PREFIXES = ['/admin', '/compte', '/favoris', '/alertes', '/mon-espace', '/profil-beaute', '/notifications', '/connexion', '/inscription', '/go/'];

export function seoFor(pathname, cat, { base }) {
  const url = base + pathname;
  const out = { status: 200, title: 'VELUNE', description: '', canonical: url, ssr: '', jsonld: [], noindex: PRIVATE_PREFIXES.some((p) => pathname.startsWith(p)) };
  const clean = pathname.replace(/\/+$/, '') || '/';
  const sub = (s) => (s || '').replace(/&/g, '&amp;');
  void sub;
  if (STATIC_ROUTES[clean]) {
    const slug = clean.slice(1);
    if (PAGES[slug]) { out.title = `${PAGES[slug].title} | VELUNE`; out.description = PAGES[slug].desc; out.ssr = `<h1>${esc(PAGES[slug].title)}</h1>` + PAGES[slug].sections.map(([h, t]) => `<h2>${esc(h)}</h2><p>${esc(t)}</p>`).join(''); }
    else { [out.title, out.description] = STATIC_ROUTES[clean]; out.ssr = `<h1>${esc(out.title.split('|')[0].trim())}</h1><p>${esc(out.description)}</p>`; }
    if (clean === '/faq') {
      out.ssr += FAQ.map(([q, a]) => `<h2>${esc(q)}</h2><p>${esc(a)}</p>`).join('');
      out.jsonld.push({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) });
    }
    if (clean === '/') out.jsonld.push({ '@context': 'https://schema.org', '@type': 'WebSite', name: 'VELUNE', url: base, potentialAction: { '@type': 'SearchAction', target: `${base}/recherche?q={search_term_string}`, 'query-input': 'required name=search_term_string' } });
    if (clean === '/parfums') out.ssr += '<ul>' + FAMILIES.map((f) => `<li>${esc(f.name)} — ${esc(f.desc)}</li>`).join('') + '</ul>';
    return out;
  }
  let m;
  if ((m = /^\/produit\/([^/]+)(?:\/(comparateur|similaires))?$/.exec(clean))) {
    const p = cat.productBySlug.get(m[1]);
    if (!p) return notFound(out);
    const s = p.summary;
    out.title = `${p.brand} ${p.name}${p.concentration ? ' ' + { edp: 'Eau de Parfum', edt: 'Eau de Toilette', extrait: 'Extrait', cologne: 'Eau de Cologne' }[p.concentration] : ''} — comparer les prix | VELUNE`;
    out.description = `${p.brand} ${p.name} : ${s.minPrice != null ? `à partir de ${s.minPrice.toFixed(2).replace('.', ',')} € chez ${s.merchantsCount} marchand(s)` : 'aucune offre active'}. Comparez formats, prix au ml, historique et alternatives. Données de démonstration.`.slice(0, 300);
    out.canonical = `${base}/produit/${p.slug}`;
    out.ssr = `<article><h1>${esc(p.brand)} ${esc(p.name)}</h1><p>${esc(p.description || '')}</p>` + (p.top.length ? `<p>Notes de tête : ${esc(p.top.join(', '))}. Notes de cœur : ${esc(p.heart.join(', '))}. Notes de fond : ${esc(p.base.join(', '))}.</p>` : '')
      + `<ul>` + p.formats.map((f) => { const o = f.offers.find((x) => x.usable); return `<li>${esc(f.label)}${o ? ` — dès ${o.price.toFixed(2)} € (${esc(o.merchant.name)})` : ''}</li>`; }).join('') + `</ul><p>Données de démonstration : prix fictifs.</p></article>`;
    const prices = p.formats.flatMap((f) => f.offers.filter((o) => o.usable).map((o) => o.price));
    out.jsonld.push({ '@context': 'https://schema.org', '@type': 'Product', name: p.name, brand: { '@type': 'Brand', name: p.brand }, description: p.description, image: `${base}/img/p/${p.slug}.svg`, category: p.category,
      ...(prices.length ? { offers: { '@type': 'AggregateOffer', priceCurrency: 'EUR', lowPrice: Math.min(...prices), highPrice: Math.max(...prices), offerCount: prices.length } } : {}) });
    out.jsonld.push(breadcrumb(base, [['Accueil', '/'], [CATEGORIES.find((c) => c.id === p.category).name, '/' + CATEGORIES.find((c) => c.id === p.category).slug], [`${p.brand} ${p.name}`, `/produit/${p.slug}`]]));
    return out;
  }
  if ((m = /^\/marques\/([^/]+)$/.exec(clean))) {
    const b = cat.brandBySlug.get(m[1]); if (!b) return notFound(out);
    const prods = cat.products.filter((p) => p.brandId === b.id);
    out.title = `${b.name} : produits, offres et promotions | VELUNE`; out.description = `${prods.length} références ${b.name} comparées : prix, promotions et nouveautés. Catalogue de démonstration.`;
    out.ssr = `<h1>${esc(b.name)}</h1><p>${esc(b.description || '')}</p><ul>${prods.slice(0, 60).map((p) => `<li><a href="/produit/${p.slug}">${esc(p.name)}</a></li>`).join('')}</ul>`;
    return out;
  }
  if ((m = /^\/guides\/([^/]+)$/.exec(clean))) {
    const g = GUIDES.find((x) => x.slug === m[1]); if (!g) return notFound(out);
    out.title = `${g.title} | Guides VELUNE`; out.description = g.desc;
    out.ssr = `<article><h1>${esc(g.title)}</h1>${g.body.map(([h, t]) => `<h2>${esc(h)}</h2><p>${esc(t)}</p>`).join('')}</article>`;
    out.jsonld.push({ '@context': 'https://schema.org', '@type': 'Article', headline: g.title, description: g.desc, inLanguage: 'fr' });
    return out;
  }
  if (PRIVATE_PREFIXES.some((p) => clean.startsWith(p)) || clean === '/admin') { out.title = 'VELUNE'; out.description = 'Espace personnel VELUNE.'; return out; }
  return notFound(out);
}
const notFound = (out) => ({ ...out, status: 404, title: 'Page introuvable | VELUNE', description: 'Cette page n’existe pas.', noindex: true, ssr: '<h1>Page introuvable</h1><p><a href="/">Retour à l’accueil</a></p>' });
const breadcrumb = (base, items) => ({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: base + path })) });

export function renderHead(seo, { indexing }) {
  const robots = seo.noindex || !indexing ? '<meta name="robots" content="noindex, nofollow">' : '<meta name="robots" content="index, follow">';
  return `<title>${esc(seo.title)}</title><meta name="description" content="${esc(seo.description)}">${robots}<link rel="canonical" href="${esc(seo.canonical)}">
<meta property="og:title" content="${esc(seo.title)}"><meta property="og:description" content="${esc(seo.description)}"><meta property="og:type" content="website"><meta property="og:locale" content="fr_FR"><meta property="og:site_name" content="VELUNE">
${seo.jsonld.map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('\n')}`;
}

export function sitemap(cat, base) {
  const urls = [...Object.keys(STATIC_ROUTES).filter((u) => !['/connexion', '/inscription'].includes(u)), ...GUIDES.map((g) => `/guides/${g.slug}`), ...cat.brands.map((b) => `/marques/${b.slug}`), ...cat.products.map((p) => `/produit/${p.slug}`)];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${base}${u}</loc></url>`).join('\n')}\n</urlset>`;
}

import { html, spinner } from './lib.js';

const page = (name, fn) => async (ctx) => (await import(`./pages/${name}.js`))[fn || 'default'](ctx);
export const routes = [
  [/^\/$/, page('home')],
  [/^\/(parfums|skincare|maquillage|cheveux-corps)$/, (c) => import('./pages/catalog.js').then((m) => m.default(c))],
  [/^\/recherche$/, (c) => import('./pages/catalog.js').then((m) => m.searchPage(c))],
  [/^\/trouver-mon-parfum$/, page('finder')],
  [/^\/produit\/([^/]+)$/, page('product')],
  [/^\/produit\/([^/]+)\/comparateur$/, page('product', 'comparator')],
  [/^\/produit\/([^/]+)\/similaires$/, page('product', 'similar')],
  [/^\/promotions$/, page('promotions')],
  [/^\/marques$/, page('brands')],
  [/^\/marques\/([^/]+)$/, page('brands', 'detail')],
  [/^\/comparateur-panier$/, page('basket')],
  [/^\/(connexion|inscription)$/, page('account', 'auth')],
  [/^\/profil-beaute$/, page('account', 'profile')],
  [/^\/mon-espace$/, page('account', 'dashboard')],
  [/^\/favoris$/, page('account', 'favorites')],
  [/^\/alertes$/, page('account', 'alerts')],
  [/^\/notifications$/, page('account', 'notifications')],
  [/^\/compte$/, page('account', 'settings')],
  [/^\/guides$/, page('content', 'guides')],
  [/^\/guides\/([^/]+)$/, page('content', 'guide')],
  [/^\/ingredients$/, page('content', 'ingredients')],
  [/^\/faq$/, page('content', 'faq')],
  [/^\/contact$/, page('content', 'contact')],
  [/^\/cookies$/, page('content', 'cookies')],
  [/^\/(a-propos|mentions-legales|confidentialite|conditions)$/, page('content', 'legal')],
  [/^\/admin(?:\/([a-z-]+))?$/, page('admin')],
];

let hooks = {};
export const setHooks = (h) => { hooks = h; };
let token = 0;
export async function render(path, { scroll = true } = {}) {
  const url = new URL(path, location.origin);
  const my = ++token;
  const app = document.getElementById('app');
  app.innerHTML = spinner().s;
  let result;
  try {
    for (const [re, loader] of routes) {
      const m = re.exec(url.pathname.replace(/\/+$/, '') || '/');
      if (m) { result = await loader({ params: m.slice(1), query: Object.fromEntries(url.searchParams), path: url.pathname, url }); break; }
    }
    if (!result) result = { title: 'Page introuvable | VELUNE', html: html`<div class="container" style="padding:4rem 0"><h1>Page introuvable</h1><p>La page demandée n’existe pas ou a été déplacée.</p><a class="btn btn-primary" href="/">Retour à l’accueil</a></div>` };
  } catch (e) {
    result = { title: 'Erreur | VELUNE', html: html`<div class="container narrow" style="padding:4rem 0"><h1>${e.status === 404 ? 'Introuvable' : 'Une erreur est survenue'}</h1><p>${e.message || 'Réessayez dans un instant.'}</p><p><a class="btn" href="/">Accueil</a> <button class="btn btn-primary" id="retry">Réessayer</button></p></div>`, mount: (r) => r.querySelector('#retry')?.addEventListener('click', () => render(path)) };
    if (e.status === 401) { navigate('/connexion?next=' + encodeURIComponent(url.pathname + url.search), { replace: true }); return; }
  }
  if (my !== token) return;
  document.title = result.title || 'VELUNE';
  const md = document.querySelector('meta[name=description]'); if (md && result.desc) md.setAttribute('content', result.desc);
  app.innerHTML = result.html.s;
  result.mount?.(app);
  hooks.afterRender?.(url.pathname);
  if (scroll) { const h = location.hash && document.querySelector(location.hash); h ? h.scrollIntoView() : window.scrollTo(0, 0); }
  document.getElementById('main').focus({ preventScroll: true });
}
export function navigate(path, { replace = false } = {}) {
  if (replace) history.replaceState({}, '', path); else history.pushState({}, '', path);
  return render(path);
}
// mise à jour d'URL sans rechargement de page (filtres)
export const setUrl = (path) => history.replaceState({}, '', path);
window.addEventListener('popstate', () => render(location.pathname + location.search, { scroll: false }));

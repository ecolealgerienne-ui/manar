import { html, api, state, emit, onState, loadFavs, toggleFav, ICONS, attachSearch, searchBox, toast, ls, basket, esc } from './lib.js';
import { render, navigate, setHooks } from './router.js';

const NAV = [['/parfums', 'Parfums'], ['/skincare', 'Skincare'], ['/maquillage', 'Maquillage'], ['/cheveux-corps', 'Cheveux & Corps'], ['/promotions', 'Promotions'], ['/marques', 'Marques']];

function header() {
  const p = location.pathname;
  const cur = (h) => (p === h || p.startsWith(h + '/') ? 'aria-current="page"' : '');
  const el = document.getElementById('site-header');
  el.innerHTML = html`<div class="container"><div class="hdr">
    <button class="icon-btn burger" id="burger" aria-label="Ouvrir le menu" aria-expanded="false" aria-controls="drawer">${ICONS.menu}</button>
    <a class="logo" href="/" aria-label="VELUNE — accueil">VELU<span>N</span>E</a>
    <div class="hdr-search" id="hs">${searchBox('', 'Rechercher un parfum, une marque, un ingrédient…')}</div>
    <nav class="nav" aria-label="Navigation principale">${NAV.map(([h, l]) => html`<a href="${h}" ${raw(cur(h))}>${l}</a>`)}</nav>
    <div class="hdr-actions">
      <a class="icon-btn" href="/favoris" aria-label="Favoris (${state.favIds.size})">${ICONS.heart}${state.favIds.size ? html`<span class="badge">${state.favIds.size}</span>` : ''}</a>
      <a class="icon-btn" href="/comparateur-panier" aria-label="Comparateur de panier (${state.basketCount} article${state.basketCount > 1 ? 's' : ''})">${ICONS.bag}${state.basketCount ? html`<span class="badge">${state.basketCount}</span>` : ''}</a>
      ${state.user ? html`<a class="icon-btn" href="/notifications" aria-label="Notifications (${state.unread} non lues)">${ICONS.bell}${state.unread ? html`<span class="badge">${state.unread}</span>` : ''}</a>` : ''}
      <button class="icon-btn" id="theme" aria-label="Basculer le thème clair/sombre">${ICONS.moon}</button>
      ${state.user ? html`<a class="icon-btn" href="/mon-espace" aria-label="Mon espace beauté">${ICONS.user}</a>` : html`<a class="btn btn-sm" href="/connexion">Connexion</a>`}
    </div></div>
    <div class="drawer" id="drawer"><div id="ds">${searchBox('d', 'Rechercher…')}</div>${NAV.map(([h, l]) => html`<a href="${h}">${l}</a>`)}
      <a href="/trouver-mon-parfum">Trouver mon parfum</a><a href="/comparateur-panier">Comparateur de panier</a><a href="/alertes">Alertes de prix</a>${state.user ? html`<a href="/mon-espace">Mon espace beauté</a><a href="/compte">Mon compte</a>${state.user.role === 'admin' ? html`<a href="/admin">Administration</a>` : ''}` : html`<a href="/connexion">Connexion</a><a href="/inscription">Créer un compte</a>`}</div></div>`.s;
  attachSearch(el.querySelector('#hs'));
  attachSearch(el.querySelector('#ds'), { onNavigate: () => el.querySelector('#drawer').classList.remove('open') });
  const dr = el.querySelector('#drawer'), bg = el.querySelector('#burger');
  bg.onclick = () => { const o = dr.classList.toggle('open'); bg.setAttribute('aria-expanded', o); };
  dr.addEventListener('click', (e) => { if (e.target.closest('a')) dr.classList.remove('open'); });
  el.querySelector('#theme').onclick = () => { const dark = document.documentElement.dataset.theme !== 'dark' && !(matchMedia('(prefers-color-scheme: dark)').matches && !document.documentElement.dataset.theme); document.documentElement.dataset.theme = dark ? 'dark' : 'light'; ls.set('velune.theme', dark ? 'dark' : 'light'); };
}
import { raw } from './lib.js';

function footer() {
  document.getElementById('site-footer').innerHTML = html`<div class="container"><div class="foot-grid">
    <div><a class="logo" href="/">VELUNE</a><p style="margin-top:.8rem;max-width:34ch">Discover your beauty. Find your value.<br><span class="small">Comparateur indépendant : VELUNE ne vend pas les produits et vous redirige vers les boutiques partenaires. Classement non influencé par les commissions d’affiliation.</span></p></div>
    <div><h4>Univers</h4><ul>${NAV.map(([h, l]) => html`<li><a href="${h}">${l}</a></li>`)}<li><a href="/trouver-mon-parfum">Trouver mon parfum</a></li></ul></div>
    <div><h4>Outils</h4><ul><li><a href="/comparateur-panier">Comparateur de panier</a></li><li><a href="/alertes">Alertes de prix</a></li><li><a href="/ingredients">Ingrédients</a></li><li><a href="/guides">Guides</a></li><li><a href="/favoris">Favoris</a></li></ul></div>
    <div><h4>VELUNE</h4><ul><li><a href="/a-propos">À propos</a></li><li><a href="/faq">FAQ</a></li><li><a href="/contact">Contact</a></li><li><a href="/mentions-legales">Mentions légales</a></li><li><a href="/confidentialite">Confidentialité</a></li><li><a href="/conditions">Conditions d’utilisation</a></li><li><a href="/cookies">Gestion des cookies</a></li></ul></div>
  </div><div class="foot-bottom">© ${new Date().getFullYear()} VELUNE — Version de démonstration : données fictives. Les prix peuvent varier ; vérifiez-les sur le site du marchand. Liens vers les marchands : liens affiliés possibles, signalés.</div></div>`.s;
}

function cookieBanner() {
  const root = document.getElementById('cookie-root');
  if (ls.get('velune.cookies', null)) { root.innerHTML = ''; return; }
  root.innerHTML = html`<div class="cookie" role="dialog" aria-label="Cookies"><p style="margin-bottom:.7rem"><strong>Votre vie privée</strong><br><span class="small">VELUNE n’utilise qu’un cookie de session nécessaire après connexion. Aucune publicité ni mesure d’audience. Vous pouvez autoriser la personnalisation (mémoire de vos recherches) — refusée par défaut.</span></p>
    <div class="row"><button class="btn btn-primary btn-sm" id="ck-ok">Accepter la personnalisation</button><button class="btn btn-sm" id="ck-no">Refuser</button><a class="small" href="/cookies">Gérer</a></div></div>`.s;
  const set = (perso) => { ls.set('velune.cookies', { perso, at: Date.now() }); root.innerHTML = ''; if (state.user) api('/api/me', { method: 'PUT', body: { profile: { ...state.user.profile, consentPerso: perso } } }).then((u) => { state.user = u; }).catch(() => {}); };
  root.querySelector('#ck-ok').onclick = () => set(true);
  root.querySelector('#ck-no').onclick = () => set(false);
}

export async function refreshUser() {
  try { state.user = (await api('/api/me')).user; } catch { state.user = null; }
  if (state.user) {
    const local = ls.get('velune.fav', []);
    if (local.length) { try { await api('/api/favorites/merge', { method: 'POST', body: { productIds: local } }); ls.set('velune.fav', []); } catch { /* ignore */ } }
    try { state.unread = (await api('/api/notifications/count')).unread; } catch { /* ignore */ }
  } else state.unread = 0;
  await loadFavs();
}

async function boot() {
  const t = ls.get('velune.theme', null); if (t) document.documentElement.dataset.theme = t;
  try { state.meta = await api('/api/meta'); } catch (e) { document.getElementById('app').innerHTML = `<div class="container" style="padding:3rem 0"><div class="notice err">Impossible de charger VELUNE : ${esc(e.message)}</div></div>`; return; }
  await refreshUser();
  header(); footer(); cookieBanner();
  onState(header);
  setHooks({ afterRender: () => { header(); } });
  document.addEventListener('click', (e) => {
    const fav = e.target.closest('[data-fav]');
    if (fav) { e.preventDefault(); toggleFav(+fav.dataset.fav).then(() => document.querySelectorAll(`[data-fav="${fav.dataset.fav}"]`).forEach((b) => { const on = state.favIds.has(+b.dataset.fav); b.setAttribute('aria-pressed', on); })).catch((er) => toast(er.message, 'err')); return; }
    const a = e.target.closest('a[href]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || a.target || a.hasAttribute('download')) return;
    const href = a.getAttribute('href');
    if (!href.startsWith('/') || /^\/(api|img|go|sitemap|robots)/.test(href)) return;
    e.preventDefault();
    if (href === location.pathname + location.search + location.hash && !href.includes('#')) { window.scrollTo(0, 0); return; }
    navigate(href);
  });
  await render(location.pathname + location.search, { scroll: false });
  if (location.hash) document.querySelector(location.hash)?.scrollIntoView();
}
export { navigate };
boot();

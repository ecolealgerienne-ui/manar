// Bibliothèque UI : gabarits HTML sûrs, API, état, composants partagés.
class Raw { constructor(s) { this.s = s; } toString() { return this.s; } }
export const raw = (s) => new Raw(s);
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const str = (v) => (v instanceof Raw ? v.s : Array.isArray(v) ? v.map(str).join('') : v == null || v === false ? '' : esc(v));
export function html(strings, ...vals) { let o = ''; strings.forEach((s, i) => { o += s; if (i < vals.length) o += str(vals[i]); }); return new Raw(o); }

export const state = { user: null, meta: null, favIds: new Set(), unread: 0, basketCount: 0 };
const listeners = new Set();
export const onState = (fn) => listeners.add(fn);
export const emit = () => listeners.forEach((f) => f());

export async function api(path, { method = 'GET', body, query } = {}) {
  let url = path;
  if (query) { const q = new URLSearchParams(); for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length)) q.set(k, Array.isArray(v) ? v.join(',') : v); const s = q.toString(); if (s) url += '?' + s; }
  const opts = { method, headers: { 'X-Requested-With': 'velune' }, credentials: 'same-origin' };
  if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  let res;
  try { res = await fetch(url, opts); } catch { throw new ApiError('Connexion impossible. Vérifiez votre réseau et réessayez.', 0); }
  let data = null;
  try { data = await res.json(); } catch { /* corps vide */ }
  if (!res.ok) throw new ApiError(data?.error || `Erreur ${res.status}`, res.status, data);
  return data;
}
export class ApiError extends Error { constructor(m, status, data) { super(m); this.status = status; this.data = data; } }

// Formatage
export const eur = (n) => (n == null ? '—' : new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n));
export const eur3 = (n) => (n == null ? '—' : new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 3 }).format(n));
export const dateFr = (s) => (s ? new Date(s).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const dateTimeFr = (s) => (s ? new Date(s).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
export function ago(s) {
  if (!s) return 'jamais';
  const h = (Date.now() - Date.parse(s)) / 3600000;
  if (h < 1) return 'il y a moins d’1 h'; if (h < 24) return `il y a ${Math.round(h)} h`;
  const d = Math.round(h / 24); return d === 1 ? 'hier' : `il y a ${d} j`;
}
export const unitLabel = (unit) => (unit === 'unité' ? 'unité' : unit);
export const CAT_NAMES = { parfum: 'Parfums', skincare: 'Skincare', maquillage: 'Maquillage', cheveux: 'Cheveux', corps: 'Corps' };
export const CAT_PATH = { parfum: '/parfums', skincare: '/skincare', maquillage: '/maquillage', cheveux: '/cheveux-corps', corps: '/cheveux-corps' };
export const MERCHANT_TYPES = { officiel: 'Marchand officiel', revendeur_verifie: 'Revendeur professionnel vérifié', marketplace: 'Marketplace', tiers: 'Vendeur tiers', non_verifie: 'Vendeur non vérifié' };
export const CONC = { extrait: 'Extrait', edp: 'Eau de parfum', edt: 'Eau de toilette', cologne: 'Eau de Cologne' };
export const GENDER = { F: 'Femme', H: 'Homme', M: 'Mixte' };

// Icônes
const ic = (d) => raw(`<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`);
export const ICONS = {
  search: ic('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  heart: ic('<path d="M12 20s-7-4.4-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.6-9 9-9 9Z"/>'),
  user: ic('<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>'),
  bell: ic('<path d="M6 17V11a6 6 0 0 1 12 0v6l2 2H4Z"/><path d="M10 21h4"/>'),
  bag: ic('<path d="M5 8h14l-1 12H6Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>'),
  menu: ic('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  close: ic('<path d="m6 6 12 12M18 6 6 18"/>'),
  moon: ic('<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z"/>'),
};

// Notifications & modales
export function toast(msg, type = '') {
  const t = document.createElement('div'); t.className = 'toast ' + type; t.textContent = msg; t.setAttribute('role', type === 'err' ? 'alert' : 'status');
  document.getElementById('toasts').append(t); setTimeout(() => t.remove(), 4500);
}
export function modal(content, { wide = false, onMount, title = 'Fenêtre' } = {}) {
  const prev = document.activeElement;
  const ov = document.createElement('div'); ov.className = 'overlay';
  ov.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}" tabindex="-1">${str(content)}</div>`;
  const m = ov.firstElementChild;
  const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); prev?.focus?.(); };
  const onKey = (e) => {
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') { const f = [...m.querySelectorAll('a[href],button:not([disabled]),input,select,textarea')].filter((x) => x.offsetParent !== null); if (!f.length) return; const first = f[0], last = f.at(-1); if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); } }
  };
  ov.addEventListener('mousedown', (e) => { if (e.target === ov) close(); });
  document.addEventListener('keydown', onKey);
  document.body.append(ov);
  m.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
  (m.querySelector('[autofocus]') || m).focus();
  onMount?.(m, close);
  return { el: m, close };
}
export function confirmBox(message, okLabel = 'Confirmer') {
  return new Promise((res) => {
    const { el, close } = modal(html`<h3>Confirmation</h3><p>${message}</p><div class="row" style="justify-content:flex-end"><button class="btn" data-close>Annuler</button><button class="btn btn-primary" id="ok" autofocus>${okLabel}</button></div>`, { title: 'Confirmation' });
    el.querySelector('#ok').onclick = () => { close(); res(true); };
    el.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => res(false)));
  });
}

// Favoris (compte si connecté, sinon localStorage)
const LS = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* stockage indisponible */ } } };
export const ls = LS;
export async function loadFavs() {
  if (state.user) { try { state.favIds = new Set((await api('/api/favorites/ids')).ids); } catch { state.favIds = new Set(); } }
  else state.favIds = new Set(LS.get('velune.fav', []));
  emit();
}
export async function toggleFav(id) {
  if (state.user) {
    const r = await api('/api/favorites/toggle', { method: 'POST', body: { productId: id } });
    r.favorite ? state.favIds.add(id) : state.favIds.delete(id);
  } else {
    state.favIds.has(id) ? state.favIds.delete(id) : state.favIds.add(id);
    LS.set('velune.fav', [...state.favIds]);
  }
  emit(); toast(state.favIds.has(id) ? 'Ajouté aux favoris' : 'Retiré des favoris');
}
// Panier local
export const basket = {
  get: () => LS.get('velune.basket', []),
  set(items) { LS.set('velune.basket', items); state.basketCount = items.reduce((s, i) => s + i.qty, 0); emit(); },
  add(formatId, qty = 1) { const b = this.get(); const e = b.find((i) => i.formatId === formatId); if (e) e.qty = Math.min(20, e.qty + qty); else b.push({ formatId, qty }); this.set(b); },
};
state.basketCount = basket.get().reduce((s, i) => s + i.qty, 0);

// Composants
export function productCard(p, { showMatch = false } = {}) {
  const fav = state.favIds.has(p.id);
  return html`<article class="card">
    ${p.maxDiscount > 0 || p.discount > 0 ? html`<span class="tag gold disc">−${p.discount || p.maxDiscount} %</span>` : ''}
    <button class="icon-btn fav" data-fav="${p.id}" aria-pressed="${fav}" aria-label="${fav ? 'Retirer des favoris' : 'Ajouter aux favoris'} : ${p.name}">${ICONS.heart}</button>
    <a class="img" href="/produit/${p.slug}" tabindex="-1" aria-hidden="true"><img src="${p.image}" alt="" loading="lazy" width="360" height="320"></a>
    <div class="body">
      <a class="brand" href="/marques/${p.brandSlug}">${p.brand}</a>
      <a class="name" href="/produit/${p.slug}">${p.name}</a>
      <div class="small muted">${[CAT_NAMES[p.category], p.concentration && CONC[p.concentration], p.gender && p.category === 'parfum' && GENDER[p.gender]].filter(Boolean).join(' · ')}</div>
      ${showMatch && p.match != null ? html`<div class="match" title="Score indicatif de correspondance, non scientifique"><span>${p.match} % de correspondance</span><span class="bar"><i style="width:${p.match}%"></i></span></div>` : ''}
      ${p.why?.length ? html`<ul class="why">${p.why.map((w) => html`<li>${w}</li>`)}</ul>` : ''}
      ${p.reasons?.length ? html`<ul class="why">${p.reasons.slice(0, 3).map((w) => html`<li>${w}</li>`)}</ul>` : ''}
      ${p.dealLabel ? html`<span class="tag ok">${p.dealLabel}${p.vsAvg ? ` (${p.vsAvg > 0 ? '−' : '+'}${Math.abs(p.vsAvg)} % vs moyenne)` : ''}</span>` : ''}
      ${p.minPrice != null ? html`<div class="price"><span class="small muted">dès</span><b>${eur(p.minPrice)}</b>${p.priceOrig ? html`<s>${eur(p.priceOrig)}</s>` : ''}<span class="small muted">${p.minFormat || ''}</span></div>
        <div class="small muted">${p.merchantsCount} marchand${p.merchantsCount > 1 ? 's' : ''}</div>
        <a class="btn btn-sm" style="position:relative;z-index:2;margin-top:.5rem" href="/produit/${p.slug}#prix">Comparer les prix</a>`
        : html`<div class="price"><span class="small muted">Aucune offre active actuellement</span></div>`}
    </div></article>`;
}
export const grid = (items, opt) => html`<div class="grid g4">${items.map((p) => productCard(p, opt))}</div>`;
export const spinner = (t = 'Chargement…') => html`<div class="loading" role="status"><span class="spinner"></span>${t}</div>`;
export const empty = (title, text, action) => html`<div class="empty"><h3>${title}</h3><p>${text}</p>${action || ''}</div>`;
export const stars = (n) => html`<span class="stars" aria-label="${n} sur 5">${'★'.repeat(Math.round(n))}${'☆'.repeat(5 - Math.round(n))}</span>`;
export const statusTag = (s, expired) => (expired ? html`<span class="tag bad">Expirée</span>` : s === 'verified' ? html`<span class="tag ok">Vérifiée</span>` : s === 'obsolete' ? html`<span class="tag bad">Périmée</span>` : html`<span class="tag warn">Non vérifiée</span>`);
export const demoTag = html`<span class="tag demo" title="Donnée de démonstration, fictive">Démo</span>`;

// Graphique d'historique (SVG)
export function priceChart(points, { ref } = {}) {
  if (!points.length) return html`<p class="muted">Pas d’historique disponible.</p>`;
  const W = 720, H = 260, pl = 46, pr = 14, pt = 14, pb = 28;
  const ys = points.map((p) => p.price); let lo = Math.min(...ys, ref ?? Infinity), hi = Math.max(...ys, ref ?? -Infinity);
  const pad = (hi - lo) * 0.12 || 1; lo = Math.max(0, lo - pad); hi += pad;
  const x = (i) => pl + (i / Math.max(1, points.length - 1)) * (W - pl - pr), y = (v) => pt + (1 - (v - lo) / (hi - lo)) * (H - pt - pb);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.price).toFixed(1)}`).join('');
  const area = `${d}L${x(points.length - 1)},${H - pb}L${x(0)},${H - pb}Z`;
  const ticks = [0, 1, 2, 3].map((k) => lo + ((hi - lo) * k) / 3);
  const labels = [0, Math.floor((points.length - 1) / 2), points.length - 1].map((i) => ({ i, t: new Date(points[i].day).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) }));
  const min = points.reduce((a, b) => (b.price < a.price ? b : a));
  const mi = points.indexOf(min);
  return html`<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Évolution du prix sur la période : minimum ${eur(min.price)}">
    ${ticks.map((t) => html`<line x1="${pl}" x2="${W - pr}" y1="${y(t)}" y2="${y(t)}" stroke="var(--line)"/><text x="${pl - 6}" y="${y(t) + 4}" text-anchor="end">${Math.round(t)} €</text>`)}
    ${labels.map((l) => html`<text x="${x(l.i)}" y="${H - 8}" text-anchor="${l.i === 0 ? 'start' : l.i === points.length - 1 ? 'end' : 'middle'}">${l.t}</text>`)}
    <path d="${area}" fill="var(--gold)" opacity=".18"/><path d="${d}" fill="none" stroke="var(--gold-d)" stroke-width="2"/>
    ${ref ? html`<line x1="${pl}" x2="${W - pr}" y1="${y(ref)}" y2="${y(ref)}" stroke="var(--taupe)" stroke-dasharray="4 4"/><text x="${W - pr}" y="${y(ref) - 5}" text-anchor="end">prix de référence annoncé</text>` : ''}
    <circle cx="${x(mi)}" cy="${y(min.price)}" r="4" fill="var(--ok)"/><circle cx="${x(points.length - 1)}" cy="${y(points.at(-1).price)}" r="4.5" fill="var(--ink)"/>
  </svg>`;
}

export function pager(page, total, size, attr = 'data-page') {
  const pages = Math.ceil(total / size); if (pages <= 1) return '';
  return html`<nav class="pager" aria-label="Pagination"><button class="btn btn-sm" ${attr}="${page - 1}" ${page <= 1 ? 'disabled' : ''}>← Précédent</button><span>Page ${page} / ${pages}</span><button class="btn btn-sm" ${attr}="${page + 1}" ${page >= pages ? 'disabled' : ''}>Suivant →</button></nav>`;
}

// Recherche avec suggestions (réutilisé dans l'en-tête, l'accueil)
export function attachSearch(root, { onNavigate } = {}) {
  const input = root.querySelector('input'); const form = root.querySelector('form'); const box = document.createElement('div');
  box.className = 'suggest'; box.hidden = true; box.id = 's' + Math.random().toString(36).slice(2, 7); root.append(box);
  input.setAttribute('aria-controls', box.id); input.setAttribute('autocomplete', 'off'); input.setAttribute('aria-expanded', 'false');
  let t, seq = 0, idx = -1;
  const go = (q) => { box.hidden = true; onNavigate?.(); import('./router.js').then((m) => m.navigate('/recherche?q=' + encodeURIComponent(q))); };
  const render = (d) => {
    const items = [];
    const sec = (title, arr, fn) => arr.length ? html`<h4>${title}</h4>${arr.map(fn)}` : '';
    const out = html`${sec('Produits', d.products, (p) => html`<a href="/produit/${p.slug}"><img src="${p.image}" alt="" width="34" height="30"><span><b>${p.name}</b><br><small class="muted">${p.brand}${p.minPrice ? ' · dès ' + eur(p.minPrice) : ''}</small></span></a>`)}
      ${sec('Marques', d.brands, (b) => html`<a href="/marques/${b.slug}">${b.name}</a>`)}
      ${sec('Catégories', d.categories, (c) => html`<a href="/${c.slug}">${c.name}</a>`)}
      ${sec('Notes', d.notes, (n) => html`<button type="button" data-q="${n}">${n}</button>`)}
      ${sec(input.value ? 'Recherches populaires' : 'Suggestions', d.popular, (n) => html`<button type="button" data-q="${n}">${n}</button>`)}`;
    box.innerHTML = out.s || '<p class="small muted" style="padding:1rem">Aucune suggestion — appuyez sur Entrée pour lancer la recherche.</p>';
    box.hidden = false; input.setAttribute('aria-expanded', 'true'); idx = -1; void items;
    box.querySelectorAll('[data-q]').forEach((b) => b.addEventListener('click', () => go(b.dataset.q)));
    box.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => { box.hidden = true; onNavigate?.(); }));
  };
  const fetchS = async () => { const s = ++seq; try { const d = await api('/api/suggest', { query: { q: input.value } }); if (s === seq) render(d); } catch { /* silencieux */ } };
  input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(fetchS, 160); });
  input.addEventListener('focus', fetchS);
  input.addEventListener('keydown', (e) => {
    const opts = [...box.querySelectorAll('a,button')];
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { if (box.hidden || !opts.length) return; e.preventDefault(); idx = (idx + (e.key === 'ArrowDown' ? 1 : -1) + opts.length) % opts.length; opts.forEach((o, i) => o.classList.toggle('active', i === idx)); opts[idx].scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'Enter' && idx >= 0) { e.preventDefault(); opts[idx].click(); }
    else if (e.key === 'Escape') { box.hidden = true; input.setAttribute('aria-expanded', 'false'); }
  });
  document.addEventListener('click', (e) => { if (!root.contains(e.target)) { box.hidden = true; input.setAttribute('aria-expanded', 'false'); } });
  form.addEventListener('submit', (e) => { e.preventDefault(); const q = input.value.trim(); if (q) go(q); });
}
export const searchBox = (cls = '', placeholder = 'Produit, marque, note, ingrédient…', value = '') => html`<div class="search-wrap-in" style="position:relative"><form class="search-box ${cls}" role="search" action="/recherche"><label class="sr" for="q-${cls || 'h'}">Rechercher</label><input id="q-${cls || 'h'}" name="q" type="search" placeholder="${placeholder}" value="${value}" maxlength="200"><button type="submit" aria-label="Lancer la recherche">${ICONS.search}</button></form></div>`;

// Formulaires
export function formValues(form) {
  const o = {}; const fd = new FormData(form);
  for (const [k, v] of fd.entries()) { if (o[k] === undefined) o[k] = v; else if (Array.isArray(o[k])) o[k].push(v); else o[k] = [o[k], v]; }
  return o;
}
export function showFieldErrors(form, err) {
  form.querySelectorAll('.err').forEach((e) => e.remove());
  const field = err.data?.field && form.querySelector(`[name="${err.data.field}"]`);
  if (field) { const p = document.createElement('div'); p.className = 'err'; p.setAttribute('role', 'alert'); p.textContent = err.message; field.closest('.field')?.append(p) ?? field.after(p); field.focus(); }
  else toast(err.message, 'err');
}
export const debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

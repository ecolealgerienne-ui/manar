import { html, api, state, basket, eur, ago, MERCHANT_TYPES, toast, spinner, empty, debounce, statusTag, ls } from '../lib.js';
import { navigate } from '../router.js';

export default async function basketPage() {
  return {
    title: 'Comparateur de panier multi-boutiques | MANOU', desc: 'Comparez le coût total de votre panier chez chaque marchand, livraison et codes promo compris.',
    html: html`<div class="container" style="padding-top:1.5rem"><div class="crumbs"><a href="/">Accueil</a> › Comparateur de panier</div><h1>Comparateur de panier</h1>
      <p class="muted" style="max-width:64ch">Composez un panier virtuel : MANOU calcule son coût total chez chaque marchand (frais de livraison, franco, codes promo) et cherche la répartition la moins chère entre plusieurs boutiques. MANOU ne vend rien : vous achetez chez les marchands.</p>
      <div class="catalog" style="grid-template-columns:minmax(0,430px) 1fr">
        <div><div class="card" style="padding:1rem"><h2 style="font-size:1.4rem">Mon panier</h2>
          <div style="position:relative"><label class="sr" for="addq">Ajouter un produit</label><input id="addq" type="search" placeholder="Ajouter un produit (nom, marque…)" autocomplete="off"><div class="suggest" id="addsug" hidden></div></div>
          <div id="items" style="margin-top:1rem"></div>
          <div class="field" style="margin-top:1rem"><label for="codes">Codes promotionnels (séparés par des virgules)</label><input id="codes" placeholder="Ex. DEMO10, LIVRAISON0" value="${ls.get('velune.codes', '')}"></div>
          <div class="row"><button class="btn btn-primary" id="calc">Comparer les boutiques</button><button class="btn" id="save">Sauvegarder</button><button class="btn btn-sm btn-danger" id="clear">Vider</button></div></div>
          <div id="saved" style="margin-top:1rem"></div></div>
        <div id="out" aria-live="polite"><div class="empty">Ajoutez des produits pour comparer les boutiques.</div></div></div></div>`,
    mount(root) { init(root); },
  };
}

async function init(root) {
  const itemsEl = root.querySelector('#items'), out = root.querySelector('#out');
  let info = {}; // formatId -> {product..., formats}
  async function hydrate() {
    const b = basket.get();
    if (!b.length) { itemsEl.innerHTML = '<p class="muted small">Votre panier est vide.</p>'; return; }
    itemsEl.innerHTML = spinner().s;
    try {
      const r = await api('/api/basket/compare', { method: 'POST', body: { items: b, codes: [] } });
      const lk = await api('/api/products/lookup', { method: 'POST', body: { ids: r.items.map((i) => i.productId) } });
      const byId = Object.fromEntries(lk.items.map((p) => [p.id, p]));
      info = {}; for (const i of r.items) info[i.formatId] = { ...i, formats: byId[i.productId]?.formats || [] };
      drawItems();
    } catch (e) { itemsEl.innerHTML = html`<div class="notice err">${e.message}</div>`.s; }
  }
  function drawItems() {
    const b = basket.get();
    itemsEl.innerHTML = b.map((it) => { const i = info[it.formatId]; if (!i) return ''; return html`<div class="row" style="flex-wrap:nowrap;align-items:flex-start;border-bottom:1px solid var(--line);padding:.7rem 0">
      <img src="${i.image}" alt="" width="56" height="50" style="border-radius:6px;object-fit:cover"><div class="grow"><a href="/produit/${i.slug}"><strong>${i.brand}</strong> ${i.name}</a>
      <div class="row" style="margin-top:.3rem;gap:.4rem"><label class="sr" for="f${i.formatId}">Format</label><select id="f${i.formatId}" data-fmt="${it.formatId}" style="width:auto;padding:.3rem">${i.formats.map((f) => html`<option value="${f.id}" ${f.id === it.formatId ? 'selected' : ''}>${f.label}${f.best ? ' · ' + eur(f.best) : ''}</option>`)}</select>
      <label class="sr" for="q${i.formatId}">Quantité</label><input id="q${i.formatId}" data-qty="${it.formatId}" type="number" min="1" max="20" value="${it.qty}" style="width:70px;padding:.3rem"><button class="link small" data-rm="${it.formatId}">Supprimer</button></div></div></div>`; }).map((x) => x.s ?? x).join('');
  }
  itemsEl.addEventListener('change', (e) => {
    const b = basket.get();
    if (e.target.dataset.fmt) { const old = +e.target.dataset.fmt, nw = +e.target.value; const it = b.find((x) => x.formatId === old); if (b.some((x) => x.formatId === nw && x !== it)) { b.splice(b.indexOf(it), 1); b.find((x) => x.formatId === nw).qty += it.qty; } else it.formatId = nw; basket.set(b); hydrate(); }
    if (e.target.dataset.qty) { const it = b.find((x) => x.formatId === +e.target.dataset.qty); it.qty = Math.max(1, Math.min(20, +e.target.value || 1)); basket.set(b); }
  });
  itemsEl.addEventListener('click', (e) => { const rm = e.target.dataset.rm; if (rm) { basket.set(basket.get().filter((x) => x.formatId !== +rm)); hydrate(); } });
  // ajout par recherche
  const aq = root.querySelector('#addq'), sug = root.querySelector('#addsug');
  aq.addEventListener('input', debounce(async () => {
    if (aq.value.trim().length < 2) { sug.hidden = true; return; }
    const d = await api('/api/suggest', { query: { q: aq.value } });
    sug.innerHTML = d.products.length ? d.products.map((p) => `<button type="button" data-id="${p.id}"><img src="${p.image}" alt="" width="34" height="42"><span><b>${p.name}</b><br><small class="muted">${p.brand}</small></span></button>`).join('') : '<p class="small muted" style="padding:.8rem">Aucun produit.</p>';
    sug.hidden = false;
  }, 200));
  sug.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-id]'); if (!b) return;
    const lk = await api('/api/products/lookup', { method: 'POST', body: { ids: [+b.dataset.id] } });
    const p = lk.items[0]; const f = p.formats.filter((x) => x.best != null).sort((a, c) => a.best - c.best)[0] || p.formats[0];
    if (!f) return toast('Ce produit n’a pas de format.', 'err');
    basket.add(f.id); sug.hidden = true; aq.value = ''; toast(`${p.name} ajouté`); hydrate();
  });
  root.querySelector('#clear').onclick = () => { basket.set([]); hydrate(); out.innerHTML = '<div class="empty">Panier vidé.</div>'; };
  root.querySelector('#calc').onclick = calc;
  root.querySelector('#save').onclick = async () => {
    if (!state.user) { toast('Connectez-vous pour sauvegarder votre panier.'); return navigate('/connexion?next=/comparateur-panier'); }
    const name = prompt('Nom du panier', 'Mon panier'); if (name === null) return;
    try { await api('/api/baskets', { method: 'POST', body: { name, items: basket.get() } }); toast('Panier sauvegardé'); loadSaved(); } catch (e) { toast(e.message, 'err'); }
  };
  async function loadSaved() {
    const box = root.querySelector('#saved'); if (!state.user) { box.innerHTML = ''; return; }
    try {
      const { baskets } = await api('/api/baskets');
      box.innerHTML = baskets.length ? html`<div class="card" style="padding:1rem"><h3>Paniers sauvegardés</h3>${baskets.map((b) => html`<div class="row between" style="border-bottom:1px solid var(--line);padding:.4rem 0"><span>${b.name} <span class="small muted">(${b.items.length} article${b.items.length > 1 ? 's' : ''} · ${ago(b.updated_at)})</span></span><span><button class="link" data-load="${b.id}">Charger</button> · <button class="link" data-del="${b.id}">Supprimer</button></span></div>`)}</div>`.s : '';
      box.onclick = async (e) => {
        if (e.target.dataset.load) { basket.set(baskets.find((b) => b.id === +e.target.dataset.load).items); hydrate(); calc(); }
        if (e.target.dataset.del) { await api('/api/baskets/' + e.target.dataset.del, { method: 'DELETE' }); loadSaved(); }
      };
    } catch { /* ignore */ }
  }
  async function calc() {
    const items = basket.get(); if (!items.length) return toast('Ajoutez d’abord des produits.', 'err');
    const codes = root.querySelector('#codes').value.split(/[,\s]+/).filter(Boolean); ls.set('velune.codes', root.querySelector('#codes').value);
    out.innerHTML = spinner('Calcul des combinaisons…').s;
    try { const r = await api('/api/basket/compare', { method: 'POST', body: { items, codes } }); out.innerHTML = results(r).s; out.querySelectorAll('[data-code]').forEach((b) => b.addEventListener('click', () => { const c = root.querySelector('#codes'); c.value = (c.value ? c.value + ', ' : '') + b.dataset.code; calc(); })); }
    catch (e) { out.innerHTML = html`<div class="notice err" role="alert">${e.message}</div>`.s; }
  }
  await hydrate(); loadSaved();
  if (basket.get().length) calc();
}

function results(r) {
  const s = r.summary;
  if (!s) return empty('Aucune combinaison possible', r.scenarios?.unavailable?.length ? `Aucune offre active pour : ${r.scenarios.unavailable.join(', ')}.` : 'Aucune offre disponible.');
  const sg = r.scenarios;
  return html`
    <div class="vgrid">
      <div class="vcard"><h4>Panier le moins cher</h4><div class="big">${eur(s.cheapest.total)}</div><p class="small">${s.cheapest.kind === 'multi' ? `${s.cheapest.shops} boutiques` : s.cheapest.merchant.replace(' (démo)', '')} · livraison ${eur(s.cheapest.shipping)}${s.cheapest.discount ? ` · codes −${eur(s.cheapest.discount)}` : ''}</p></div>
      <div class="vcard"><h4>Panier le plus pratique</h4><div class="big">${s.practical ? eur(s.practical.total) : '—'}</div><p class="small">${s.practical ? `${s.practical.shops} boutique${s.practical.shops > 1 ? 's' : ''} (${s.practical.merchant?.replace(' (démo)', '') || 'multi'}) · livraison ${eur(s.practical.shipping)}` : ''}</p></div>
      <div class="vcard"><h4>Économies réalisées</h4><div class="big">${s.savingsVsWorstSingle != null ? eur(s.savingsVsWorstSingle) : '—'}</div><p class="small">par rapport à la boutique unique la plus chère</p></div>
      <div class="vcard"><h4>Écart entre scénarios</h4><div class="big">${s.differenceBetweenScenarios != null ? eur(s.differenceBetweenScenarios) : '—'}</div><p class="small">${s.differenceBetweenScenarios > 0 ? 'économisé en répartissant entre plusieurs boutiques' : s.differenceBetweenScenarios === 0 ? 'la boutique unique est aussi avantageuse' : ''}</p></div>
    </div>
    ${r.warnings.map((w) => html`<div class="notice">${w}</div>`)}
    ${r.codes.length ? html`<h3>Codes</h3>${r.codes.map((c) => html`<div class="notice ${c.valid ? 'ok' : 'err'}"><strong>${c.code}</strong> — ${c.valid ? `appliqué (${c.freeShip ? 'livraison offerte' : '−' + eur(c.discount)}) chez ${c.merchant}` : c.reason}</div>`)}` : ''}
    <h2 style="margin-top:2rem">Scénario A — une seule boutique</h2>
    <div class="table-wrap"><table class="t stack"><thead><tr><th>Boutique</th><th>Sous-total</th><th>Codes</th><th>Livraison</th><th>Total estimé</th><th>Délai</th><th>Remarque</th></tr></thead><tbody>
      ${[...sg.single].sort((a, b) => (a.complete ? 0 : 1) - (b.complete ? 0 : 1) || (a.total ?? 0) - (b.total ?? 0)).map((m, i) => m.complete ? html`<tr class="${i === 0 ? 'best' : ''}"><td data-l="Boutique"><strong>${m.merchant.replace(' (démo)', '')}</strong><div class="small muted">${MERCHANT_TYPES[m.merchantType]}</div></td><td data-l="Sous-total">${eur(m.subtotal)}</td><td data-l="Codes">${m.codeApplied ? html`−${eur(m.discount)} (${m.codeApplied})` : m.codeReason ? html`<span class="small muted">${m.codeReason}</span>` : '—'}</td><td data-l="Livraison">${m.shipping === 0 ? 'Offerte' : eur(m.shipping)}</td><td data-l="Total"><strong>${eur(m.total)}</strong></td><td data-l="Délai">${m.deliveryDays} j</td><td data-l="Remarque">${m.lines.some((l) => l.status !== 'verified') ? html`<span class="tag warn">offres non vérifiées</span>` : html`<span class="tag ok">offres vérifiées</span>`}</td></tr>`
        : html`<tr class="off"><td data-l="Boutique">${m.merchant.replace(' (démo)', '')}</td><td colspan="6" data-l="">Incomplet — indisponible : ${m.missing.join(', ')}</td></tr>`)}</tbody></table></div>
    <h2 style="margin-top:2rem">Scénario B — répartition entre plusieurs boutiques</h2>
    ${sg.multi ? html`<p>Total estimé : <strong>${eur(sg.multi.total)}</strong> en ${sg.multi.shops} boutique${sg.multi.shops > 1 ? 's' : ''} (livraisons : ${eur(sg.multi.shipping)}). <span class="small muted">${sg.multi.exact ? 'Combinaison optimale (recherche exhaustive).' : 'Combinaison approchée (recherche locale).'}</span></p>
      ${sg.multi.parts.map((p) => html`<div class="card" style="padding:1rem;margin-bottom:.8rem"><div class="row between"><strong>${p.merchant.replace(' (démo)', '')}</strong><span>${eur(p.total)} <span class="small muted">(dont livraison ${p.shipping === 0 ? 'offerte' : eur(p.shipping)})</span></span></div>
        ${p.lines.map((l) => html`<div class="small" style="display:flex;justify-content:space-between"><span>${l.qty} × ${l.brand} ${l.name} (${l.format})</span><span>${eur(l.unitPrice * l.qty)}</span></div>`)}${p.codeApplied ? html`<div class="small muted">Code ${p.codeApplied} : −${eur(p.discount)}</div>` : ''}</div>`)}`
      : empty('Répartition impossible', `Aucune offre active pour : ${sg.unavailable.join(', ')}.`)}
    ${r.availableCodes.length ? html`<h3 style="margin-top:2rem">Codes disponibles (à vérifier chez le marchand)</h3><div class="chips">${r.availableCodes.map((c) => html`<button class="chip" data-code="${c.code}" title="${c.conditions || ''}">${c.code} <span class="small muted">${c.merchant?.replace(' (démo)', '')}</span></button>`)}</div>` : ''}
    <p class="small muted" style="margin-top:1.5rem">Totaux estimés, non garantis : prix, stock, franco et conditions des codes doivent être vérifiés chez le marchand.</p>`;
}
void statusTag;

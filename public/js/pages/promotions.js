import { html, raw, api, state, eur, dateFr, ago, statusTag, MERCHANT_TYPES, spinner, empty, formValues, toast, pager } from '../lib.js';

const TABS = [
  ['jour', 'Meilleures offres du jour', { sort: 'deal' }], ['parfum', 'Parfums', { category: 'parfum' }], ['skincare', 'Skincare', { category: 'skincare' }], ['maquillage', 'Maquillage', { category: 'maquillage' }],
  ['cheveux', 'Cheveux & corps', { category: 'cheveux-corps' }], ['marque', 'Par marque', {}], ['codes', 'Codes promotionnels', {}], ['livraison', 'Livraison gratuite', { freeShipping: '1' }], ['limitees', 'Offres limitées', { limited: '1' }],
];

export default async function promotions(ctx) {
  const tab = ctx.query.tab || 'jour';
  const st = { page: 1, ...Object.fromEntries(Object.entries(ctx.query).filter(([k]) => k !== 'tab')) };
  return {
    title: 'Promotions et codes promo beauté | VELUNE', desc: 'Promotions classées selon l’historique des prix, avec dates de vérification, et codes promotionnels avec conditions.',
    html: html`<div class="container" style="padding-top:1.5rem"><div class="crumbs"><a href="/">Accueil</a> › Promotions</div><h1>Promotions</h1>
      <div class="notice demo">Toutes les offres et tous les codes sont des <strong>données de démonstration</strong>. En production, une offre expirée ou non vérifiée ne serait jamais présentée comme active.</div>
      <nav class="tabs" aria-label="Catégories de promotions">${TABS.map(([id, l]) => html`<a href="/promotions?tab=${id}" ${tab === id ? raw('aria-current="true"') : ''}>${l}</a>`)}</nav>
      ${tab === 'codes' ? html`<div id="codes">${spinner()}</div>` : html`
      <form id="pf" class="inline-form card" style="padding:1rem;margin-bottom:1rem">
        <div class="field"><label for="md">Réduction minimum : <output id="mdv">${st.minDiscount || 0} %</output></label><input id="md" type="range" name="minDiscount" min="0" max="50" step="5" value="${st.minDiscount || 0}"></div>
        <div class="field"><label for="mp">Budget max (€)</label><input id="mp" name="maxPrice" type="number" min="1" value="${st.maxPrice || ''}"></div>
        <div class="field"><label for="mb">Marque</label><select id="mb" name="brand"><option value="">Toutes</option>${state.meta.brands.map((b) => html`<option value="${b.slug}" ${st.brand === b.slug ? 'selected' : ''}>${b.name}</option>`)}</select></div>
        <div class="field"><label for="mm">Boutique</label><select id="mm" name="merchant"><option value="">Toutes</option>${state.meta.merchants.map((m) => html`<option value="${m.slug}" ${st.merchant === m.slug ? 'selected' : ''}>${m.name}</option>`)}</select></div>
        <div class="field"><label for="ex">Expire dans</label><select id="ex" name="expiresWithin"><option value="">Indifférent</option><option value="2" ${st.expiresWithin === '2' ? 'selected' : ''}>2 jours</option><option value="7" ${st.expiresWithin === '7' ? 'selected' : ''}>7 jours</option></select></div>
        <div class="field"><label for="so">Tri</label><select id="so" name="sort"><option value="discount" ${st.sort === 'discount' ? 'selected' : ''}>Réduction affichée</option><option value="deal" ${(st.sort || (tab === 'jour' ? 'deal' : '')) === 'deal' ? 'selected' : ''}>Historique des prix (meilleur signal)</option><option value="price" ${st.sort === 'price' ? 'selected' : ''}>Prix croissant</option></select></div>
        <div><label class="check"><input type="checkbox" name="freeShipping" value="1" ${st.freeShipping === '1' || tab === 'livraison' ? 'checked' : ''}> Livraison gratuite</label><label class="check"><input type="checkbox" name="includeExpired" value="1" ${st.includeExpired === '1' ? 'checked' : ''}> Afficher les offres expirées</label></div>
      </form>
      <div id="promos" aria-live="polite">${spinner()}</div>`}</div>`,
    mount(root) {
      if (tab === 'codes') return loadCodes(root);
      const form = root.querySelector('#pf'); const tabDef = TABS.find((t) => t[0] === tab)[2];
      const run = async (page = 1) => {
        const v = formValues(form);
        const q = { ...tabDef, minDiscount: +v.minDiscount || '', maxPrice: v.maxPrice, brand: v.brand, merchant: v.merchant, expiresWithin: v.expiresWithin, sort: v.sort, freeShipping: v.freeShipping || tabDef.freeShipping, includeExpired: v.includeExpired, page };
        const box = root.querySelector('#promos'); box.innerHTML = spinner().s;
        try {
          const r = await api('/api/promotions', { query: q });
          box.innerHTML = r.items.length ? html`<p><strong>${r.total}</strong> offre${r.total > 1 ? 's' : ''}</p><div class="table-wrap"><table class="t stack"><thead><tr><th>Produit</th><th>Boutique</th><th>Prix</th><th>Réduction annoncée</th><th>Signal historique</th><th>Livraison</th><th>Statut</th><th></th></tr></thead><tbody>
            ${r.items.map((o) => html`<tr class="${o.expired ? 'off' : ''}"><td data-l="Produit"><a href="/produit/${o.product.slug}"><strong>${o.product.brand}</strong> ${o.product.name}</a><div class="small muted">${o.format}</div></td>
              <td data-l="Boutique">${o.merchant.replace(' (démo)', '')}<div class="small muted">${MERCHANT_TYPES[o.merchantType]}</div></td>
              <td data-l="Prix"><strong>${eur(o.price)}</strong> <s class="muted small">${eur(o.priceOrig)}</s></td><td data-l="Réduction"><span class="tag gold">−${o.discount} %</span><div class="small muted">sur prix de référence du marchand</div></td>
              <td data-l="Historique">${o.deal ? html`<span class="tag ${o.deal.vsAvg > 5 ? 'ok' : ''}">${o.deal.label || (o.deal.vsAvg > 0 ? `${o.deal.vsAvg} % sous la moyenne` : 'proche de la moyenne')}</span>` : html`<span class="small muted">historique insuffisant</span>`}</td>
              <td data-l="Livraison">${o.shipping === 0 ? 'Offerte' : eur(o.shipping)}</td>
              <td data-l="Statut">${statusTag(o.status, o.expired)}${o.expiresAt ? html`<div class="small muted">${o.expired ? 'a expiré le' : 'jusqu’au'} ${dateFr(o.expiresAt)}</div>` : ''}<div class="small muted">relevé ${ago(o.fetchedAt)}</div></td>
              <td data-l="">${o.expired ? '' : html`<a class="btn btn-sm" href="/go/${o.offerId}" rel="sponsored nofollow noopener" target="_blank">Voir</a>`}</td></tr>`)}</tbody></table></div>${pager(page, r.total, 24)}`.s
            : empty('Aucune promotion', 'Aucune offre active ne correspond à ces filtres.').s;
          box.querySelectorAll('[data-page]').forEach((b) => b.addEventListener('click', () => { run(+b.dataset.page); window.scrollTo(0, 0); }));
        } catch (e) { box.innerHTML = html`<div class="notice err">${e.message}</div>`.s; }
      };
      form.addEventListener('change', () => { root.querySelector('#mdv').textContent = form.minDiscount.value + ' %'; run(); });
      form.addEventListener('submit', (e) => e.preventDefault());
      run();
    },
  };
}

async function loadCodes(root) {
  const box = root.querySelector('#codes');
  const draw = async (inc) => {
    const r = await api('/api/promo-codes', { query: { includeExpired: inc ? '1' : '' } });
    box.innerHTML = html`<label class="check"><input type="checkbox" id="inc" ${inc ? 'checked' : ''}> Afficher les codes expirés</label><p class="small muted">${r.notice}</p>
      <div class="grid g3">${r.codes.map((c) => html`<article class="card" style="padding:1.1rem;${c.expired ? 'opacity:.6' : ''}">
        <div class="row between"><code style="font-size:1.25rem;letter-spacing:.08em;font-weight:700">${c.code}</code>${c.expired ? html`<span class="tag bad">Expiré</span>` : c.verifiedAt ? html`<span class="tag ok">Vérifié ${ago(c.verifiedAt)}</span>` : html`<span class="tag warn">Non vérifié</span>`}</div>
        <p style="margin:.5rem 0"><strong>${c.type === 'percent' ? `−${c.value} %` : c.type === 'fixed' ? `−${eur(c.value)}` : 'Livraison offerte'}</strong> chez ${c.merchant.replace(' (démo)', '')}</p>
        <p class="small muted">${c.conditions || ''}<br>Montant minimum : ${c.minAmount ? eur(c.minAmount) : 'aucun'} · Produits éligibles : ${c.categories.length ? c.categories.join(', ') : 'tous'} · Expire le ${dateFr(c.expiresAt)}</p>
        <button class="btn btn-sm" data-copy="${c.code}" ${c.expired ? 'disabled' : ''}>Copier le code</button></article>`)}</div>`.s;
    box.querySelector('#inc').onchange = (e) => draw(e.target.checked);
    box.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', async () => { try { await navigator.clipboard.writeText(b.dataset.copy); toast(`Code ${b.dataset.copy} copié`); } catch { toast('Copie impossible : sélectionnez le code manuellement.', 'err'); } }));
  };
  try { await draw(false); } catch (e) { box.innerHTML = html`<div class="notice err">${e.message}</div>`.s; }
}

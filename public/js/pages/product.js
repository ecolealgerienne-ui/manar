import { html, raw, api, state, eur, eur3, dateFr, dateTimeFr, ago, ICONS, CONC, GENDER, CAT_NAMES, CAT_PATH, MERCHANT_TYPES, statusTag, demoTag, priceChart, productCard, stars, basket, toast, modal, formValues, showFieldErrors, spinner, empty } from '../lib.js';
import { navigate } from '../router.js';

const SORT_OPTS = [['total', 'Prix final le plus bas'], ['discount', 'Meilleure réduction'], ['unit', 'Meilleur rapport quantité/prix'], ['delivery', 'Livraison la plus intéressante'], ['selected', 'Marchands sélectionnés']];

const pct = (v) => `${Math.abs(v)} %`;

function offersTable(f, sort, onlyVerified) {
  let offers = f.offers.filter((o) => !onlyVerified || o.merchant.verified);
  const usable = offers.filter((o) => o.usable);
  const rest = offers.filter((o) => !o.usable);
  const key = { total: (o) => o.total, discount: (o) => -o.discount, unit: (o) => o.perUnit ?? 1e9, delivery: (o) => (o.shipping === 0 ? 0 : 1) * 100 + o.merchant.deliveryDays + o.shipping / 100, selected: (o) => (o.merchant.selected ? 0 : 1) * 1000 + o.total }[sort];
  usable.sort((a, b) => key(a) - key(b));
  if (!offers.length) return empty('Aucune offre', 'Aucun marchand ne propose ce format pour le moment.');
  const bestTotal = Math.min(...usable.map((o) => o.total));
  const row = (o, i) => html`<tr class="${o.usable ? (o.total === bestTotal ? 'best' : '') : 'off'}">
    <td data-l="Marchand"><div class="row" style="flex-wrap:nowrap;gap:.6rem"><span class="sw" style="background:var(--beige);display:grid;place-items:center;font:600 .7rem var(--sans);flex:none" aria-hidden="true">${o.merchant.name[0]}</span>
      <div><strong>${o.merchant.name.replace(' (démo)', '')}</strong> ${o.usable && o.total === bestTotal ? html`<span class="best-badge">Meilleure offre</span>` : ''} ${demoTag}<br><span class="tag ${o.merchant.verified ? 'ok' : 'warn'}" title="${o.merchant.criteria || ''}">${MERCHANT_TYPES[o.merchant.type]}</span>
      <details class="small muted"><summary>Critères de vérification</summary>${o.merchant.criteria || 'Aucun critère renseigné.'}<br>Dernier contrôle du marchand : ${dateFr(o.merchant.lastCheck)}. L’authenticité du produit n’est pas garantie.</details></div></div></td>
    <td data-l="Prix initial">${o.priceOrig ? html`<s class="muted">${eur(o.priceOrig)}</s><div class="small muted">réf. annoncée</div>` : '—'}</td>
    <td data-l="Prix actuel"><strong>${eur(o.price)}</strong></td>
    <td data-l="Réduction">${o.discount ? html`<span class="tag gold">−${o.discount} %</span>` : '—'}${o.expiresAt && !o.expired ? html`<div class="small muted">jusqu’au ${dateFr(o.expiresAt)}</div>` : ''}</td>
    <td data-l="Format">${f.label}</td>
    <td data-l="Prix au ${f.unit === 'unité' ? 'produit' : '100 ' + f.unit}">${f.unit === 'unité' ? eur(o.price) : html`${eur(o.per100)}<div class="small muted">${eur3(o.perUnit)}/${f.unit}</div>`}</td>
    <td data-l="Livraison">${o.shipping === 0 ? html`<span class="tag ok">Offerte</span>` : eur(o.shipping)}<div class="small muted">${o.merchant.deliveryDays} j · ${o.merchant.freeThreshold ? `gratuite dès ${eur(o.merchant.freeThreshold)}` : 'pas de franco'}</div></td>
    <td data-l="Prix total"><strong>${eur(o.total)}</strong></td>
    <td data-l="Disponibilité">${o.available ? html`<span class="tag ok">En stock</span>` : html`<span class="tag bad">Indisponible</span>`}</td>
    <td data-l="Vérification">${statusTag(o.verifiedStatus, o.expired)}<div class="small muted">relevé ${ago(o.fetchedAt)}</div></td>
    <td data-l="">${o.usable ? html`<a class="btn btn-sm btn-primary" href="/go/${o.id}" rel="sponsored nofollow noopener" target="_blank">Voir l’offre</a>` : html`<span class="small muted">Offre inactive</span>`}</td></tr>`;
  return html`<div class="table-wrap"><table class="t stack"><thead><tr><th>Marchand</th><th>Prix initial</th><th>Prix actuel</th><th>Réduction</th><th>Format</th><th>Prix au ${f.unit === 'unité' ? 'produit' : '100 ' + f.unit}</th><th>Livraison</th><th>Prix total</th><th>Dispo.</th><th>Vérification</th><th></th></tr></thead>
    <tbody>${usable.map(row)}${rest.map(row)}</tbody></table></div>`;
}

function priceSection(d, st) {
  const f = d.formats.find((x) => x.id === st.formatId) || d.formats[0];
  if (!f) return html`<div class="notice">Aucun format enregistré pour ce produit.</div>`;
  return html`<div class="tabs" role="tablist" aria-label="Formats">${d.formats.map((x) => html`<button role="tab" class="${x.id === f.id ? 'on' : ''}" aria-selected="${x.id === f.id}" data-format="${x.id}">${x.label}${x.best ? html` <span class="muted small">dès ${eur(x.best.price)}</span>` : ''}</button>`)}</div>
    <div class="toolbar"><label class="row small" style="gap:.5rem">Classer par <select id="osort">${SORT_OPTS.map(([v, l]) => html`<option value="${v}" ${st.sort === v ? 'selected' : ''}>${l}</option>`)}</select></label>
      <label class="check" style="margin:0"><input type="checkbox" id="onlyv" ${st.onlyVerified ? 'checked' : ''}> Vendeurs vérifiés uniquement</label></div>
    <p class="small muted">Seules des références équivalentes (même format) sont comparées. Le prix le plus bas n’est pas forcément la meilleure réduction : utilisez les classements. Prix mis à jour : relevé le plus récent ${ago(d.summary.lastFetched)}.</p>
    ${offersTable(f, st.sort, st.onlyVerified)}
    <p class="small muted" style="margin-top:.6rem">Ces liens peuvent être des liens affiliés (rel=sponsored) ; le classement n’en dépend pas. <button class="link" id="report">Signaler un prix incorrect</button></p>`;
}

function valueSection(d) {
  const v = d.valueCompare;
  if (!v) return html`<div class="notice">Pas d’offre active : aucune comparaison de valeur possible.</div>`;
  const card = (title, o, big, sub) => o ? html`<div class="vcard"><h4>${title}</h4><div class="big">${big}</div><p class="small">${o.merchant.replace(' (démo)', '')} · ${o.format}</p>${sub}</div>` : html`<div class="vcard"><h4>${title}</h4><p class="muted small">Historique insuffisant pour qualifier.</p></div>`;
  return html`<div class="vgrid">
    ${card('Offre la moins chère', v.cheapest, eur(v.cheapest.price), html`<p class="small muted">Prix affiché, hors livraison.</p>`)}
    ${card('Meilleur prix au ' + (d.formats[0]?.unit === 'unité' ? 'produit' : 'ml'), v.bestUnit, eur3(v.bestUnit.perUnit) + '/' + (d.formats[0]?.unit || 'ml'), html`<p class="small muted">${eur(v.bestUnit.per100)} / 100 ${d.formats[0]?.unit === 'unité' ? '' : d.formats[0]?.unit}</p>`)}
    ${card('Meilleur prix final', v.bestFinal, eur(v.bestFinal.total), html`<p class="small muted">Livraison comprise (${eur(v.bestFinal.total - v.bestFinal.price)}).</p>`)}
    ${card('Meilleure offre vs historique', v.bestHistorical, v.bestHistorical ? `${v.bestHistorical.savings.vsHistoryAvgPct > 0 ? '−' : '+'}${Math.abs(v.bestHistorical.savings.vsHistoryAvgPct)} %` : '', v.bestHistorical ? html`<p class="small muted">${eur(v.bestHistorical.price)} contre une moyenne observée de ${eur(v.bestHistorical.price + v.bestHistorical.savings.vsHistoryAvgAbs)} (historique fictif de démonstration).</p>` : '')}
    ${v.bestFormat ? html`<div class="vcard"><h4>Meilleur format</h4><div class="big">${v.bestFormat.format}</div><p class="small">${eur3(v.bestFormat.perUnit)}/${d.formats[0].unit} — ${v.bestFormat.savingVsSmallestPct ? `${v.bestFormat.savingVsSmallestPct} % moins cher au ${d.formats[0].unit} que le plus petit format` : 'format de référence'}.</p></div>` : ''}
  </div>
  ${v.formats.length > 1 ? html`<h3 style="margin-top:1.5rem">Formats comparés</h3><div class="table-wrap"><table class="t"><thead><tr><th>Format</th><th>Meilleur prix</th><th>Prix / ${d.formats[0].unit}</th><th>Prix / 100 ${d.formats[0].unit}</th><th>vs plus petit format</th></tr></thead><tbody>${v.formats.map((f) => html`<tr><td>${f.format}</td><td>${eur(f.price)}</td><td>${eur3(f.perUnit)}</td><td>${eur(f.per100)}</td><td>${f.vsSmallestPct === 0 ? 'référence' : html`<span class="tag ${f.vsSmallestPct < 0 ? 'ok' : 'warn'}">${f.vsSmallestPct < 0 ? '−' : '+'}${pct(f.vsSmallestPct)} au ${d.formats[0].unit}</span>`}</td></tr>`)}</tbody></table></div>` : ''}
  <div class="notice demo">${v.note} Exemple : une réduction affichée de 30 % sur un prix de départ gonflé peut rester plus chère qu’un autre marchand sans réduction.</div>`;
}

async function historySection(d, st, root) {
  const f = d.formats.find((x) => x.id === st.formatId) || d.formats[0];
  if (!f) return;
  const box = root.querySelector('#hist-body'); box.innerHTML = spinner().s;
  try {
    const h = await api(`/api/products/${d.product.slug}/history`, { query: { format: f.id, period: st.period } });
    const best = f.offers.find((o) => o.usable);
    box.innerHTML = html`${h.points.length ? html`
      <div class="stats"><div class="stat"><small>Prix actuel (annoncé)</small><b>${eur(h.current)}</b></div><div class="stat"><small>Prix moyen observé</small><b>${eur(h.stats.avg)}</b></div><div class="stat"><small>Minimum observé</small><b>${eur(h.stats.min)}</b></div><div class="stat"><small>Maximum observé</small><b>${eur(h.stats.max)}</b></div><div class="stat"><small>Dernier relevé</small><b>${dateFr(h.stats.last)}</b></div></div>
      ${priceChart(h.points, { ref: best?.priceOrig })}` : empty('Pas encore d’historique', h.notice)}
      <div class="notice demo">${h.notice}</div>
      <ul class="small muted"><li><strong>Prix annoncé par le marchand</strong> : ${d.priceTypes.announced}</li><li><strong>Prix historiquement observé</strong> : ${d.priceTypes.observed}</li><li><strong>Prix de référence</strong> : ${d.priceTypes.reference}</li></ul>
      ${d.deal?.enough && d.deal.label ? html`<p><span class="tag ok">${d.deal.label}</span> <span class="small muted">calculé sur ${d.deal.count} relevés (démo).</span></p>` : html`<p class="small muted">Aucune qualification « promotion exceptionnelle » : historique insuffisant ou prix proche de la moyenne.</p>`}`.s;
  } catch (e) { box.innerHTML = `<div class="notice err">${e.message}</div>`; }
}

function simList(items, showCheaper = true) {
  if (!items.length) return empty('Aucune alternative trouvée', 'Aucun produit ne dépasse le seuil de similarité avec ces critères. Essayez de retirer le filtre de prix.');
  return html`<div class="grid sims">${items.map((s) => html`<div class="sim"><div>${productCard({ ...s.product })}</div><div class="info">
    <p><strong>Score de similarité indicatif : ${s.similarity.score} %</strong>${showCheaper && s.similarity.priceDelta < -4 ? html` <span class="tag ok">−${Math.abs(s.similarity.priceDelta)} % au ml</span>` : ''}</p>
    <p class="small">${s.similarity.reasons.join(' ')}</p>
    ${s.similarity.differences.length ? html`<p class="small muted"><strong>Différences :</strong> ${s.similarity.differences.join(' ')}</p>` : ''}
    <details><summary class="small">Critères utilisés</summary>${s.similarity.criteria.map((c) => html`<div class="crit"><span>${c.label}</span><span class="bar"><i style="width:${c.value}%"></i></span><span>${c.value}%</span></div>`)}<p class="small muted">Indicateur calculé à partir de critères affichés, non scientifique. Une alternative n’est jamais une copie du produit de référence.</p></details>
  </div></div>`)}</div>`;
}

function pyramid(p) {
  if (!p.top.length && !p.heart.length && !p.base.length) return html`<div class="notice demo">Notes olfactives non renseignées pour ce produit (information inconnue).</div>`;
  const row = (cls, l, notes) => html`<div class="pyr-row"><div class="lbl">${l}</div><div class="pyr-shape ${cls}">${notes.length ? notes.map((n) => html`<a class="chip" href="/parfums?notes=${encodeURIComponent(n)}">${n}</a>`) : html`<span class="small muted">inconnues</span>`}</div></div>`;
  return html`<h3>Pyramide olfactive</h3><div class="pyramid" aria-label="Pyramide olfactive">${row('pyr-top', 'Notes de tête', p.top)}${row('pyr-heart', 'Notes de cœur', p.heart)}${row('pyr-base', 'Notes de fond', p.base)}</div>
    ${p.accords.length ? html`<h3>Accords principaux</h3><div class="chips">${p.accords.map((a) => html`<span class="chip">${a}</span>`)}</div>` : ''}`;
}

function facts(p) {
  const F = [];
  if (p.category === 'parfum') F.push(['Famille olfactive', p.families.join(', ') || 'inconnue'], ['Concentration', CONC[p.concentration] || 'inconnue'], ['Genre commercialisé', GENDER[p.gender] || 'inconnu'], ['Lancement', p.year || 'inconnu'], ['Parfumeur', p.perfumer || 'non renseigné'], ['Intensité', p.intensity ? `${p.intensity}/5` : 'inconnue'], ['Saisons (indicatif)', p.seasons.join(', ') || '—'], ['Occasions (indicatif)', p.occasions.join(', ') || '—']);
  else F.push(['Fonction', p.sub || '—'], ['Texture', p.texture || 'non renseignée'], ['Finition', p.finish || '—'], ['Couvrance', p.coverage || '—'], ['Type de peau (fabricant)', p.skin.length ? (p.skin.length > 4 ? 'toutes' : p.skin.join(', ')) : '—'], ['Cheveux ciblés', p.hair.join(', ') || '—']);
  return html`<div class="facts">${F.filter(([, v]) => v && v !== '—').map(([k, v]) => html`<div class="fact"><small>${k}</small>${v}</div>`)}</div>`;
}

function cosmeticBlock(p) {
  return html`${p.actives.length ? html`<h3>Actifs principaux</h3><div class="chips">${p.actives.map((a) => html`<a class="chip" href="/ingredients#${encodeURIComponent(a)}">${a}</a>`)}</div>` : ''}
    <h3 style="margin-top:1rem">Liste INCI</h3><p class="small muted">${p.inci || 'Liste INCI complète non renseignée dans ce catalogue de démonstration — à vérifier sur l’emballage ou le site de la marque.'}</p>
    <div class="notice demo">Informations documentaires, sans valeur de recommandation médicale. Le type de peau indiqué est celui annoncé par le fabricant. En cas de doute, demandez conseil à un professionnel de santé.</div>
    ${p.shades?.length ? html`<h3>Teintes</h3><div class="swatches">${p.shades.map((s) => html`<span class="sw" style="background:${s.hex}" title="${s.n}" role="img" aria-label="Teinte ${s.n}"></span>`)}</div><p class="small muted">${p.shades.map((s) => s.n).join(' · ')} — teintes indicatives.</p>` : ''}`;
}

function head(d) {
  const p = d.product;
  return html`<div class="crumbs"><a href="/">Accueil</a> › <a href="${CAT_PATH[p.category]}">${CAT_NAMES[p.category]}</a> › <a href="/marques/${p.brandSlug}">${p.brand}</a> › ${p.name}</div>`;
}

export default async function product(ctx) {
  const d = await api('/api/products/' + ctx.params[0]);
  const p = d.product;
  const st = { formatId: d.formats.find((f) => f.best)?.id ?? d.formats[0]?.id, sort: 'total', onlyVerified: false, period: 30 };
  const fav = state.favIds.has(p.id);
  return {
    title: `${p.brand} ${p.name}${p.concentration ? ' ' + CONC[p.concentration] : ''} — comparer les prix | MANOU`, desc: p.description?.slice(0, 160),
    html: html`<div class="container">${head(d)}
      <div class="pdp"><div class="pdp-img"><img src="${p.image}" alt="Illustration de démonstration : ${p.brand} ${p.name}" width="320" height="400"></div>
      <div>
        <a class="eyebrow" href="/marques/${p.brandSlug}" style="text-decoration:none">${p.brand}</a>
        <h1 style="font-size:clamp(2rem,4vw,3rem)">${p.name}</h1>
        <div class="row" style="margin-bottom:.8rem">${p.demo ? html`<span class="tag demo">Fiche de démonstration</span>` : ''}${p.verified ? html`<span class="tag ok">Fiche vérifiée</span>` : html`<span class="tag warn">Données non vérifiées</span>`}${p.concentration ? html`<span class="tag">${CONC[p.concentration]}</span>` : ''}${p.gender && p.category === 'parfum' ? html`<span class="tag">${GENDER[p.gender]}</span>` : ''}${d.rating ? html`${stars(d.rating)} <span class="small muted">${d.rating}/5 · ${d.reviews.length} avis</span>` : ''}</div>
        <p>${p.description}</p>
        ${d.summary.minPrice != null ? html`<div class="price" style="display:flex;gap:.7rem;align-items:baseline;flex-wrap:wrap"><span class="muted">À partir de</span><b class="pdp-price">${eur(d.summary.minPrice)}</b>${d.summary.priceOrig ? html`<s class="muted">${eur(d.summary.priceOrig)}</s>` : ''}<span class="muted small">${d.summary.minFormat} · ${d.summary.merchantsCount} marchand${d.summary.merchantsCount > 1 ? 's' : ''}</span></div>${d.deal?.enough && d.deal.label ? html`<span class="tag ok">${d.deal.label}</span>` : ''}` : html`<div class="notice">Aucune offre active pour ce produit actuellement.</div>`}
        <div class="row" style="margin:1rem 0">
          <button class="btn" data-fav="${p.id}" aria-pressed="${fav}" id="favbtn">${ICONS.heart} <span>${fav ? 'Dans vos favoris' : 'Ajouter aux favoris'}</span></button>
          <button class="btn btn-gold" id="alertbtn">${ICONS.bell} Alerte de prix</button>
          <button class="btn" id="basketbtn">${ICONS.bag} Ajouter au panier</button>
        </div>
        ${facts(p)}
      </div></div>

      <div style="margin-top:2rem">${p.category === 'parfum' ? pyramid(p) : cosmeticBlock(p)}</div>

      <nav class="tabs" aria-label="Sections de la fiche"><a href="#prix">Comparateur de prix</a><a href="#valeur">Comparateur de valeur</a><a href="#historique">Historique des prix</a><a href="#similaires">Alternatives</a><a href="#avis">Avis</a></nav>
      <section id="prix"><h2>Comparateur de prix</h2><div id="price-body">${priceSection(d, st)}</div></section>
      <section id="valeur" style="margin-top:3rem"><h2>Comparateur de valeur</h2>${valueSection(d)}</section>
      <section id="historique" style="margin-top:3rem"><h2>Historique des prix</h2>
        <div class="row"><div class="chips" id="periods">${[[7, '7 jours'], [30, '30 jours'], [90, '3 mois'], [180, '6 mois'], [365, '1 an']].map(([v, l]) => html`<button class="chip" data-period="${v}" aria-pressed="${v === st.period}">${l}</button>`)}</div></div>
        <div id="hist-body" aria-live="polite"></div></section>
      <section id="similaires" style="margin-top:3rem"><div class="sec-head"><div class="bm-head"><span class="bm-badge">Beauty Match</span><h2 style="margin:0">Vous pourriez également aimer</h2></div><a class="btn btn-sm" href="/produit/${p.slug}/similaires">Voir toutes les alternatives</a></div>
        ${d.cheaper.length ? html`<h3>Alternatives moins chères</h3>${simList(d.cheaper.slice(0, 3))}` : ''}
        <h3 style="margin-top:1.5rem">Produits similaires</h3>${simList(d.similar.slice(0, 6), false)}</section>
      <section id="avis" style="margin-top:3rem"><h2>Avis</h2>
        ${d.reviews.length ? d.reviews.map((r) => html`<div class="card" style="padding:1rem;margin-bottom:.8rem"><div class="row">${stars(r.rating)} <strong>${r.author}</strong> ${r.demo ? html`<span class="tag demo">Avis de démonstration</span>` : ''}<span class="small muted">${dateFr(r.created_at)}</span></div><p style="margin:.4rem 0 0">${r.text}</p></div>`) : html`<p class="muted">Aucun avis pour le moment.</p>`}
        <form id="rform" class="card" style="padding:1rem;max-width:560px"><h3>Donner mon avis</h3>${state.user ? html`
          <div class="field"><label for="rr">Note</label><select id="rr" name="rating"><option value="5">5 — Excellent</option><option value="4">4</option><option value="3">3</option><option value="2">2</option><option value="1">1 — Décevant</option></select></div>
          <div class="field"><label for="rt">Votre avis (10 à 1000 caractères)</label><textarea id="rt" name="text" rows="3" maxlength="1000" required minlength="10"></textarea></div><button class="btn btn-primary" type="submit">Publier</button>` : html`<p class="muted">Connectez-vous pour publier un avis.</p><a class="btn" href="/connexion?next=${encodeURIComponent(location.pathname)}">Connexion</a>`}</form></section>
    </div>`,
    mount(root) { bindProduct(root, d, st); },
  };
}

function bindProduct(root, d, st) {
  const p = d.product;
  const redraw = () => { root.querySelector('#price-body').innerHTML = priceSection(d, st).s; bindPrice(); };
  const bindPrice = () => {
    root.querySelectorAll('[data-format]').forEach((b) => b.addEventListener('click', () => { st.formatId = +b.dataset.format; redraw(); }));
    root.querySelector('#osort')?.addEventListener('change', (e) => { st.sort = e.target.value; redraw(); });
    root.querySelector('#onlyv')?.addEventListener('change', (e) => { st.onlyVerified = e.target.checked; redraw(); });
    root.querySelector('#report')?.addEventListener('click', () => reportModal(p));
  };
  bindPrice();
  root.querySelector('#periods')?.addEventListener('click', (e) => { const b = e.target.closest('[data-period]'); if (!b) return; st.period = +b.dataset.period; root.querySelectorAll('[data-period]').forEach((x) => x.setAttribute('aria-pressed', x === b)); historySection(d, st, root); });
  historySection(d, st, root);
  root.querySelector('#favbtn')?.addEventListener('click', () => setTimeout(() => { const on = state.favIds.has(p.id); root.querySelector('#favbtn span').textContent = on ? 'Dans vos favoris' : 'Ajouter aux favoris'; }, 400));
  root.querySelector('#basketbtn').onclick = () => {
    const f = d.formats.find((x) => x.id === st.formatId); if (!f) return toast('Aucun format disponible.', 'err');
    basket.add(f.id); toast(`Ajouté au panier (${f.label})`);
  };
  root.querySelector('#alertbtn').onclick = () => alertModal(d, st);
  root.querySelector('#rform')?.addEventListener('submit', async (e) => {
    e.preventDefault(); const v = formValues(e.target);
    try { await api(`/api/products/${p.slug}/reviews`, { method: 'POST', body: v }); toast('Merci, votre avis est publié.'); navigate(location.pathname + '#avis', { replace: true }); } catch (er) { showFieldErrors(e.target, er); }
  });
}

function reportModal(p) {
  const { el, close } = modal(html`<h3>Signaler un problème</h3><form id="rf"><div class="field"><label for="rm">Que faut-il corriger ? (prix, disponibilité, information…)</label><textarea id="rm" name="message" rows="4" required minlength="5" maxlength="1000" autofocus></textarea></div><div class="row" style="justify-content:flex-end"><button type="button" class="btn" data-close>Annuler</button><button class="btn btn-primary">Envoyer</button></div></form>`, { title: 'Signaler un problème' });
  el.querySelector('#rf').onsubmit = async (e) => { e.preventDefault(); try { await api('/api/reports', { method: 'POST', body: { productId: p.id, message: formValues(e.target).message } }); toast('Signalement envoyé, merci.'); close(); } catch (er) { showFieldErrors(e.target, er); } };
}

function alertModal(d, st) {
  if (!state.user) { toast('Connectez-vous pour créer une alerte de prix.'); return navigate('/connexion?next=' + encodeURIComponent(location.pathname)); }
  const f0 = d.formats.find((x) => x.id === st.formatId) || d.formats[0];
  const merchants = state.meta.merchants;
  const { el, close } = modal(html`<h3>Créer une alerte de prix</h3><p class="small muted">Vous serez prévenu lorsqu’une offre <strong>vérifiée</strong>, disponible et non expirée passe sous votre prix cible. Jamais pour une offre périmée ou non vérifiée.</p>
    <form id="af"><div class="field"><label for="af-f">Format</label><select id="af-f" name="formatId">${d.formats.map((f) => html`<option value="${f.id}" ${f.id === f0.id ? 'selected' : ''}>${f.label}${f.best ? ` — actuellement ${eur(f.best.price)}` : ''}</option>`)}</select></div>
    <div class="field"><label for="af-p">Prix cible (€)</label><input id="af-p" name="targetPrice" type="number" step="0.01" min="1" required value="${f0.best ? Math.floor(f0.best.price * 0.9) : ''}" autofocus></div>
    <fieldset class="field" style="border:0;padding:0"><legend class="small">Marchands (aucun coché = tous)</legend>${merchants.map((m) => html`<label class="check"><input type="checkbox" name="merchantIds" value="${m.id}"> ${m.name}</label>`)}</fieldset>
    <div class="row" style="justify-content:flex-end"><button type="button" class="btn" data-close>Annuler</button><button class="btn btn-primary">Activer l’alerte</button></div></form>`, { title: 'Alerte de prix' });
  el.querySelector('#af').onsubmit = async (e) => {
    e.preventDefault(); const v = formValues(e.target);
    try { const a = await api('/api/alerts', { method: 'POST', body: { formatId: +v.formatId, targetPrice: +v.targetPrice, merchantIds: [].concat(v.merchantIds || []).map(Number) } }); close(); toast(a.reached ? 'Alerte créée — le seuil est déjà atteint, consultez vos notifications.' : 'Alerte activée.'); } catch (er) { showFieldErrors(e.target, er); }
  };
}

// ---- Page dédiée : comparateur (prix + valeur + historique)
export async function comparator(ctx) {
  const d = await api('/api/products/' + ctx.params[0]);
  const st = { formatId: d.formats.find((f) => f.best)?.id ?? d.formats[0]?.id, sort: 'total', onlyVerified: false, period: 90 };
  return {
    title: `Comparateur de prix — ${d.product.brand} ${d.product.name} | MANOU`,
    html: html`<div class="container">${head(d)}<h1>Comparateur — ${d.product.brand} ${d.product.name}</h1><p><a href="/produit/${d.product.slug}">← Retour à la fiche</a></p>
      <section id="prix"><h2>Prix par marchand</h2><div id="price-body">${priceSection(d, st)}</div></section>
      <section style="margin-top:3rem"><h2>Valeur</h2>${valueSection(d)}</section>
      <section style="margin-top:3rem"><h2>Historique</h2><div class="chips" id="periods">${[[7, '7 jours'], [30, '30 jours'], [90, '3 mois'], [180, '6 mois'], [365, '1 an']].map(([v, l]) => html`<button class="chip" data-period="${v}" aria-pressed="${v === st.period}">${l}</button>`)}</div><div id="hist-body"></div></section></div>`,
    mount(root) {
      const redraw = () => { root.querySelector('#price-body').innerHTML = priceSection(d, st).s; bind(); };
      const bind = () => {
        root.querySelectorAll('[data-format]').forEach((b) => b.addEventListener('click', () => { st.formatId = +b.dataset.format; redraw(); historySection(d, st, root); }));
        root.querySelector('#osort')?.addEventListener('change', (e) => { st.sort = e.target.value; redraw(); });
        root.querySelector('#onlyv')?.addEventListener('change', (e) => { st.onlyVerified = e.target.checked; redraw(); });
        root.querySelector('#report')?.addEventListener('click', () => reportModal(d.product));
      };
      bind();
      root.querySelector('#periods').addEventListener('click', (e) => { const b = e.target.closest('[data-period]'); if (!b) return; st.period = +b.dataset.period; root.querySelectorAll('[data-period]').forEach((x) => x.setAttribute('aria-pressed', x === b)); historySection(d, st, root); });
      historySection(d, st, root);
    },
  };
}

// ---- Page dédiée : produits similaires
export async function similar(ctx) {
  const slug = ctx.params[0];
  const base = await api(`/api/products/${slug}/similar`, { query: { cheaper: ctx.query.cheaper, maxPrice: ctx.query.maxPrice } });
  const p = base.product;
  return {
    title: `Produits similaires à ${p.brand} ${p.name} | MANOU`,
    html: html`<div class="container"><div class="crumbs"><a href="/">Accueil</a> › <a href="/produit/${p.slug}">${p.brand} ${p.name}</a> › Alternatives</div>
      <h1>Alternatives à ${p.name}</h1><p class="muted">${base.method}</p>
      <form id="sf" class="row" style="margin:1rem 0"><label class="check" style="margin:0"><input type="checkbox" name="cheaper" value="1" ${ctx.query.cheaper === '1' ? 'checked' : ''}> Trouver une alternative moins chère</label>
        <label class="row small" style="gap:.4rem">Budget max (€) <input name="maxPrice" type="number" min="1" value="${ctx.query.maxPrice || ''}" style="width:110px"></label><button class="btn btn-sm btn-primary">Appliquer</button></form>
      <p><strong>${base.items.length}</strong> alternative${base.items.length > 1 ? 's' : ''} · référence : ${p.brand} ${p.name}${p.minPrice ? ` (dès ${eur(p.minPrice)})` : ''}</p>
      ${simList(base.items, true)}</div>`,
    mount(root) {
      root.querySelector('#sf').onsubmit = (e) => { e.preventDefault(); const v = formValues(e.target); const q = new URLSearchParams(); if (v.cheaper) q.set('cheaper', '1'); if (v.maxPrice) q.set('maxPrice', v.maxPrice); navigate(`/produit/${slug}/similaires${q.toString() ? '?' + q : ''}`); };
    },
  };
}
void raw; void dateTimeFr;

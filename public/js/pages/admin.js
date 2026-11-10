import { html, raw, api, state, eur, dateFr, dateTimeFr, ago, toast, modal, confirmBox, formValues, showFieldErrors, spinner, empty, MERCHANT_TYPES, pager, debounce } from '../lib.js';
import { navigate } from '../router.js';

const SECTIONS = [['', 'Tableau de bord'], ['produits', 'Produits'], ['marques', 'Marques'], ['marchands', 'Marchands'], ['offres', 'Offres'], ['codes', 'Codes promo'], ['utilisateurs', 'Utilisateurs'], ['signalements', 'Signalements'], ['rapprochements', 'Rapprochements'], ['journal', 'Journal'], ['messages', 'Messages']];

export default async function admin(ctx) {
  if (!state.user) throw Object.assign(new Error('Connexion requise'), { status: 401 });
  if (state.user.role !== 'admin') return { title: 'Accès refusé | VELUNE', html: html`<div class="container narrow" style="padding:4rem 0"><h1>Accès réservé</h1><p>Cet espace est réservé aux administrateurs.</p><a class="btn" href="/">Accueil</a></div>` };
  const sec = ctx.params[0] || '';
  const fn = { '': overview, produits: products, marques: brands, marchands: merchants, offres: offers, codes: codes, utilisateurs: users, signalements: reports, rapprochements: matches, journal: journal, messages: messages }[sec];
  if (!fn) return { title: 'Administration', html: html`<div class="container" style="padding:3rem 0"><h1>Section inconnue</h1></div>` };
  return {
    title: 'Administration | VELUNE',
    html: html`<div class="container"><div class="admin"><nav aria-label="Administration">${SECTIONS.map(([s, l]) => html`<a href="/admin${s ? '/' + s : ''}" ${s === sec ? raw('aria-current="page"') : ''}>${l}</a>`)}</nav><div id="adm"><div class="loading"><span class="spinner"></span>Chargement…</div></div></div></div>`,
    async mount(root) {
      const box = root.querySelector('#adm');
      try { await fn(box); } catch (e) { box.innerHTML = html`<div class="notice err" role="alert">${e.message}</div>`.s; }
    },
  };
}

const field = (label, name, val = '', attrs = '') => html`<div class="field"><label for="f-${name}">${label}</label><input id="f-${name}" name="${name}" value="${val ?? ''}" ${raw(attrs)}></div>`;
const select = (label, name, opts, val) => html`<div class="field"><label for="f-${name}">${label}</label><select id="f-${name}" name="${name}">${opts.map(([v, l]) => html`<option value="${v}" ${String(v) === String(val) ? 'selected' : ''}>${l}</option>`)}</select></div>`;
function formModal(title, content, onSubmit, wide) {
  const { el, close } = modal(html`<h3>${title}</h3><form id="mf">${content}<div class="row" style="justify-content:flex-end;margin-top:1rem"><button type="button" class="btn" data-close>Annuler</button><button class="btn btn-primary">Enregistrer</button></div></form>`, { wide, title });
  const f = el.querySelector('#mf');
  f.onsubmit = async (e) => { e.preventDefault(); f.querySelectorAll('.err').forEach((x) => x.remove()); try { await onSubmit(formValues(f), f); close(); } catch (er) { showFieldErrors(f, er); } };
  return el;
}

async function overview(box) {
  const s = await api('/api/admin/stats');
  const k = [['Produits', s.products], ['Marques', s.brands], ['Marchands', s.merchants], ['Offres actives', s.activeOffers], ['Offres obsolètes', s.obsoleteOffers], ['Produits sans image', s.noImage], ['Données incomplètes', s.incomplete], ['Utilisateurs', s.users], ['Rapprochements à valider', s.pendingMatches], ['Signalements ouverts', s.openReports], ['Demandes de suppression', s.deletionRequests], ['Messages', s.messages]];
  box.innerHTML = html`<h1>Tableau de bord</h1><div class="kpi">${k.map(([l, v]) => html`<div><b>${v}</b><span class="small muted">${l}</span></div>`)}</div>
    <div class="grid g2" style="margin-top:1.5rem"><div class="card" style="padding:1rem"><h3>Recherches les plus fréquentes</h3>${s.topSearches.length ? html`<ol>${s.topSearches.map((x) => html`<li>${x.q} <span class="muted small">(${x.c})</span></li>`)}</ol>` : html`<p class="muted small">Aucune recherche enregistrée.</p>`}</div>
    <div class="card" style="padding:1rem"><h3>Produits les plus consultés</h3>${s.topViewed.length ? html`<ol>${s.topViewed.map((x) => html`<li><a href="/produit/${x.slug}">${x.brand} ${x.name}</a> <span class="muted small">(${x.views})</span></li>`)}</ol>` : html`<p class="muted small">Aucune consultation.</p>`}</div></div>
    <div class="card" style="padding:1rem;margin-top:1rem"><h3>Relevé de prix simulé (démonstration)</h3><p class="small muted">Fait varier les prix des offres de démonstration, actualise les dates de relevé et déclenche l’évaluation des alertes. N’utilise aucune donnée réelle.</p><button class="btn" id="sim">Simuler un relevé de prix</button> <a class="btn" href="/admin/messages">Boîte d’envoi des emails d’alerte</a></div>`.s;
  box.querySelector('#sim').onclick = async () => { const r = await api('/api/admin/offers/simulate-refresh', { method: 'POST' }); toast(`${r.updated} offres mises à jour, ${r.alertsTriggered} alerte(s) déclenchée(s).`); overview(box); };
}

async function products(box) {
  const st = { page: 1, q: '', issue: '', category: '' };
  box.innerHTML = html`<div class="row between"><h1>Produits</h1><button class="btn btn-primary" id="new">Ajouter un produit</button></div>
    <div class="row" style="margin-bottom:1rem"><input id="aq" type="search" placeholder="Rechercher…" style="max-width:260px"><select id="ac" style="width:auto"><option value="">Toutes catégories</option>${['parfum', 'skincare', 'maquillage', 'cheveux', 'corps'].map((c) => html`<option>${c}</option>`)}</select>
    <select id="ai" style="width:auto"><option value="">Tous</option><option value="noimage">Sans image</option><option value="incomplete">Données incomplètes</option><option value="unverified">Non vérifiés</option></select><button class="btn btn-sm" id="mergebtn">Fusionner des doublons</button></div><div id="tb"></div>`.s;
  const draw = async () => {
    const r = await api('/api/admin/products', { query: st });
    box.querySelector('#tb').innerHTML = html`<p class="small muted">${r.total} produit(s)</p><div class="table-wrap"><table class="t"><thead><tr><th>ID</th><th>Produit</th><th>Cat.</th><th>Formats / offres</th><th>État</th><th></th></tr></thead><tbody>${r.items.map((p) => html`<tr><td>${p.id}</td><td><a href="/produit/${p.slug}"><strong>${p.brand}</strong> ${p.name}</a></td><td>${p.category}</td><td>${p.formats} / ${p.offers}</td>
      <td>${p.verified ? html`<span class="tag ok">vérifié</span>` : html`<span class="tag warn">non vérifié</span>`} ${p.incomplete ? html`<span class="tag bad">incomplet</span>` : ''} ${p.noImage ? html`<span class="tag bad">sans image</span>` : ''} ${p.demo ? html`<span class="tag demo">démo</span>` : ''}</td>
      <td><button class="btn btn-sm" data-edit="${p.id}">Modifier</button> <button class="btn btn-sm" data-verify="${p.id}" data-v="${p.verified}">${p.verified ? 'Retirer vérif.' : 'Vérifier'}</button> <button class="btn btn-sm btn-danger" data-del="${p.id}">Supprimer</button></td></tr>`)}</tbody></table></div>${pager(st.page, r.total, 25)}`.s;
    box.querySelectorAll('[data-page]').forEach((b) => b.onclick = () => { st.page = +b.dataset.page; draw(); });
  };
  box.querySelector('#aq').oninput = debounce((e) => { st.q = e.target.value; st.page = 1; draw(); });
  box.querySelector('#ac').onchange = (e) => { st.category = e.target.value; st.page = 1; draw(); };
  box.querySelector('#ai').onchange = (e) => { st.issue = e.target.value; st.page = 1; draw(); };
  box.querySelector('#new').onclick = () => productForm(null, draw);
  box.querySelector('#mergebtn').onclick = () => formModal('Fusionner deux produits', html`<p class="small muted">Le produit « à absorber » est supprimé ; ses offres, formats équivalents, favoris, avis et alertes sont rattachés au produit conservé.</p>${field('ID du produit à conserver', 'keepId', '', 'type="number" required')}${field('ID du produit à absorber', 'removeId', '', 'type="number" required')}`, async (v) => { await api('/api/admin/products/merge', { method: 'POST', body: { keepId: +v.keepId, removeId: +v.removeId } }); toast('Produits fusionnés'); draw(); });
  box.addEventListener('click', async (e) => {
    const t = e.target;
    try {
      if (t.dataset.edit) productForm(+t.dataset.edit, draw);
      if (t.dataset.verify) { await api(`/api/admin/products/${t.dataset.verify}/verify`, { method: 'POST', body: { verified: t.dataset.v !== 'true' } }); draw(); }
      if (t.dataset.del && await confirmBox(`Supprimer le produit ${t.dataset.del} et toutes ses offres ?`, 'Supprimer')) { await api('/api/admin/products/' + t.dataset.del, { method: 'DELETE' }); toast('Supprimé'); draw(); }
    } catch (er) { toast(er.message, 'err'); }
  });
  draw();
}

async function productForm(id, done) {
  const m = state.meta; const p = id ? await api('/api/admin/products/' + id) : { category: 'parfum', families: [], top: [], heart: [], base: [], actives: [], skin: [], formats: [] };
  const brandOpts = m.brands.map((b) => [b.slug, b.name]);
  const brands = await api('/api/admin/brands');
  const notesSel = (name, label, sel) => html`<div class="field"><label for="f-${name}">${label} (Ctrl/Cmd pour plusieurs)</label><select id="f-${name}" name="${name}" multiple size="5">${m.notes.map((n) => html`<option ${sel.includes(n.name) ? 'selected' : ''}>${n.name}</option>`)}</select></div>`;
  void brandOpts;
  const el = formModal(id ? `Modifier le produit #${id}` : 'Nouveau produit', html`<div class="inline-form">${field('Nom', 'name', p.name, 'required maxlength="150"')}${select('Marque', 'brandId', brands.brands.map((b) => [b.id, b.name]), p.brandId)}
    ${select('Catégorie', 'category', ['parfum', 'skincare', 'maquillage', 'cheveux', 'corps'].map((c) => [c, c]), p.category)}${field('Sous-catégorie', 'sub', p.sub)}${select('Genre', 'gender', [['', '—'], ['F', 'Femme'], ['H', 'Homme'], ['M', 'Mixte']], p.gender)}${field('Année', 'year', p.year, 'type="number"')}
    ${select('Concentration', 'concentration', [['', '—'], ['extrait', 'Extrait'], ['edp', 'EDP'], ['edt', 'EDT'], ['cologne', 'Cologne']], p.concentration)}${field('Intensité (1-5)', 'intensity', p.intensity, 'type="number" min="1" max="5"')}${field('Parfumeur', 'perfumer', p.perfumer)}${field('Texture', 'texture', p.texture)}${field('Finition', 'finish', p.finish)}${field('Couvrance', 'coverage', p.coverage)}</div>
    <div class="field"><label for="f-description">Description</label><textarea id="f-description" name="description" rows="3">${p.description || ''}</textarea></div>
    <div class="field"><strong>Familles olfactives</strong><div class="chips">${m.families.map((f) => html`<label class="chip"><input type="checkbox" name="families" value="${f.id}" ${p.families?.includes(f.id) ? 'checked' : ''}> ${f.name}</label>`)}</div></div>
    ${notesSel('top', 'Notes de tête', p.top)}${notesSel('heart', 'Notes de cœur', p.heart)}${notesSel('base', 'Notes de fond', p.base)}
    ${field('Accords (séparés par des virgules)', 'accords', (p.accords || []).join(', '))}${field('Actifs (séparés par des virgules ; voir base d’ingrédients)', 'actives', (p.actives || []).join(', '))}${field('Types de peau (virgules)', 'skin', (p.skin || []).join(', '))}
    <div class="field"><label for="f-inci">Liste INCI</label><textarea id="f-inci" name="inci" rows="2">${p.inci || ''}</textarea></div>
    <div class="inline-form">${field('Source des données', 'source', p.source)}${field('Source de l’image', 'imageSource', p.imageSource)}</div>
    ${id ? html`<div class="field"><strong>Formats</strong><ul>${p.formats.map((f) => html`<li>${f.size} ${f.unit} — EAN ${f.ean || 'non renseigné'} <button type="button" class="link" data-delf="${f.id}">supprimer</button></li>`)}</ul><div class="row"><input id="nfs" type="number" placeholder="Taille" style="width:90px"><select id="nfu" style="width:auto"><option>ml</option><option>g</option><option>unité</option></select><input id="nfe" placeholder="EAN (8 ou 13 chiffres)" style="width:200px"><button type="button" class="btn btn-sm" id="addf">Ajouter le format</button></div></div>` : html`<p class="small muted">Les formats se gèrent après création.</p>`}`,
  async (v) => {
    const csv = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean); const a = (x) => [].concat(x || []).filter(Boolean);
    const body = { ...v, brandId: +v.brandId, families: a(v.families), top: a(v.top), heart: a(v.heart), base: a(v.base), accords: csv(v.accords), actives: csv(v.actives), skin: csv(v.skin) };
    await api(id ? '/api/admin/products/' + id : '/api/admin/products', { method: id ? 'PUT' : 'POST', body }); toast('Enregistré'); done();
  }, true);
  if (id) {
    el.querySelector('#addf').onclick = async () => { try { await api(`/api/admin/products/${id}/formats`, { method: 'POST', body: { size: el.querySelector('#nfs').value, unit: el.querySelector('#nfu').value, ean: el.querySelector('#nfe').value } }); toast('Format ajouté'); } catch (er) { toast(er.message, 'err'); } };
    el.querySelectorAll('[data-delf]').forEach((b) => b.onclick = async () => { await api('/api/admin/formats/' + b.dataset.delf, { method: 'DELETE' }); b.parentElement.remove(); });
  }
}

async function brands(box) {
  const draw = async () => {
    const { brands } = await api('/api/admin/brands');
    box.innerHTML = html`<div class="row between"><h1>Marques</h1><button class="btn btn-primary" id="new">Ajouter une marque</button></div><div class="table-wrap"><table class="t"><thead><tr><th>Marque</th><th>Produits</th><th>Type</th><th></th></tr></thead><tbody>${brands.map((b) => html`<tr><td><strong>${b.name}</strong></td><td>${b.products}</td><td>${b.fictional ? html`<span class="tag demo">fictive</span>` : html`<span class="tag demo">démo</span>`}</td><td><button class="btn btn-sm" data-edit="${b.id}">Modifier</button> <button class="btn btn-sm" data-assign="${b.id}">Associer des produits</button></td></tr>`)}</tbody></table></div>`.s;
    box.querySelector('#new').onclick = () => formModal('Nouvelle marque', html`${field('Nom', 'name', '', 'required maxlength="80"')}<div class="field"><label for="f-d">Présentation</label><textarea id="f-d" name="description" rows="3"></textarea></div>`, async (v) => { await api('/api/admin/brands', { method: 'POST', body: v }); toast('Marque créée'); draw(); });
    box.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => { const br = brands.find((x) => x.id === +b.dataset.edit); formModal('Modifier la marque', html`${field('Nom', 'name', br.name, 'required')}<div class="field"><label for="f-d">Présentation</label><textarea id="f-d" name="description" rows="3">${br.description || ''}</textarea></div>`, async (v) => { await api('/api/admin/brands/' + br.id, { method: 'PUT', body: v }); toast('Enregistré'); draw(); }); });
    box.querySelectorAll('[data-assign]').forEach((b) => b.onclick = () => formModal('Associer des produits', html`<p class="small muted">Rattache des produits (par ID) à cette marque.</p>${field('IDs des produits (virgules)', 'ids', '', 'required')}`, async (v) => { const r = await api(`/api/admin/brands/${b.dataset.assign}/assign`, { method: 'POST', body: { productIds: v.ids.split(',').map((x) => +x.trim()).filter(Boolean) } }); toast(`${r.moved} produit(s) associé(s)`); draw(); }));
  };
  await draw();
}

async function merchants(box) {
  const TYPES = Object.entries(MERCHANT_TYPES);
  const form = (m) => html`<div class="inline-form">${field('Nom', 'name', m?.name, 'required')}${select('Type', 'type', TYPES, m?.type || 'revendeur_verifie')}${field('Frais de livraison (€)', 'ship_fee', m?.ship_fee ?? 0, 'type="number" step="0.01" min="0"')}${field('Franco de port (€, vide = aucun)', 'free_threshold', m?.free_threshold ?? '', 'type="number" step="0.01" min="0"')}${field('Délai (jours)', 'delivery_days', m?.delivery_days ?? 3, 'type="number" min="1"')}${select('Statut', 'status', [['active', 'Actif'], ['suspended', 'Suspendu']], m?.status || 'active')}${field('URL du site', 'url', m?.url)}${field('Contact', 'contact', m?.contact)}</div><div class="field"><label for="f-c">Critères de vérification</label><textarea id="f-c" name="criteria" rows="2">${m?.criteria || ''}</textarea></div><label class="check"><input type="checkbox" name="selected" value="1" ${m?.selected ? 'checked' : ''}> Marchand « sélectionné »</label>`;
  const draw = async () => {
    const { merchants } = await api('/api/admin/merchants');
    box.innerHTML = html`<div class="row between"><h1>Marchands</h1><button class="btn btn-primary" id="new">Ajouter un marchand</button></div><div class="table-wrap"><table class="t"><thead><tr><th>Marchand</th><th>Type</th><th>Livraison</th><th>Offres</th><th>Dernier contrôle</th><th>Statut</th><th></th></tr></thead><tbody>${merchants.map((m) => html`<tr class="${m.status === 'suspended' ? 'off' : ''}"><td><strong>${m.name}</strong></td><td>${MERCHANT_TYPES[m.type]}</td><td>${eur(m.ship_fee)}${m.free_threshold ? ` · franco ${eur(m.free_threshold)}` : ''}</td><td>${m.offers}</td><td>${m.last_check ? dateFr(m.last_check) : '—'}</td><td>${m.status === 'active' ? html`<span class="tag ok">actif</span>` : html`<span class="tag bad">source suspendue</span>`}</td>
      <td><button class="btn btn-sm" data-edit="${m.id}">Modifier</button> <button class="btn btn-sm" data-check="${m.id}">Coordonnées vérifiées</button> <button class="btn btn-sm ${m.status === 'active' ? 'btn-danger' : ''}" data-susp="${m.id}">${m.status === 'active' ? 'Suspendre' : 'Réactiver'}</button></td></tr>`)}</tbody></table></div>`.s;
    box.querySelector('#new').onclick = () => formModal('Nouveau marchand', form(null), async (v) => { await api('/api/admin/merchants', { method: 'POST', body: { ...v, selected: !!v.selected } }); toast('Marchand créé'); draw(); }, true);
    box.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => { const m = merchants.find((x) => x.id === +b.dataset.edit); formModal('Modifier le marchand', form(m), async (v) => { await api('/api/admin/merchants/' + m.id, { method: 'PUT', body: { ...v, selected: !!v.selected } }); toast('Enregistré'); draw(); }, true); });
    box.querySelectorAll('[data-check]').forEach((b) => b.onclick = async () => { await api(`/api/admin/merchants/${b.dataset.check}/check`, { method: 'POST' }); toast('Date de contrôle mise à jour'); draw(); });
    box.querySelectorAll('[data-susp]').forEach((b) => b.onclick = async () => { const m = merchants.find((x) => x.id === +b.dataset.susp); await api('/api/admin/merchants/' + m.id, { method: 'PUT', body: { status: m.status === 'active' ? 'suspended' : 'active' } }); toast(m.status === 'active' ? 'Source suspendue : ses offres ne sont plus présentées.' : 'Source réactivée'); draw(); });
  };
  await draw();
}

async function offers(box) {
  const st = { page: 1, q: '', state: '' };
  box.innerHTML = html`<h1>Offres</h1><div class="row" style="margin-bottom:1rem"><input id="oq" type="search" placeholder="Produit…" style="max-width:240px"><select id="os" style="width:auto"><option value="">Toutes</option><option value="obsolete">Obsolètes / périmées</option><option value="flagged">Signalées</option><option value="unverified">Non vérifiées</option></select><button class="btn btn-sm" id="sim">Simuler un relevé de prix (démo)</button></div><div id="tb"></div>`.s;
  const draw = async () => {
    const r = await api('/api/admin/offers', { query: st });
    box.querySelector('#tb').innerHTML = html`<p class="small muted">${r.total} offre(s)</p><div class="table-wrap"><table class="t"><thead><tr><th>Produit</th><th>Marchand</th><th>Prix</th><th>Dernière actualisation</th><th>État</th><th></th></tr></thead><tbody>${r.items.map((o) => html`<tr class="${o.obsolete ? 'off' : ''}"><td><a href="/produit/${o.slug}">${o.product}</a><div class="small muted">${o.format}</div></td><td>${o.merchant}</td><td>${eur(o.price)}${o.priceOrig ? html` <s class="muted small">${eur(o.priceOrig)}</s>` : ''}</td><td>${dateTimeFr(o.fetchedAt)}<div class="small muted">${ago(o.fetchedAt)}</div></td>
      <td>${o.obsolete ? html`<span class="tag bad">obsolète</span>` : o.status === 'verified' ? html`<span class="tag ok">vérifiée</span>` : html`<span class="tag warn">non vérifiée</span>`} ${o.flagged ? html`<span class="tag bad">signalée</span>` : ''} ${o.expired ? html`<span class="tag bad">expirée</span>` : ''} ${o.available ? '' : html`<span class="tag bad">indispo</span>`}</td>
      <td><button class="btn btn-sm" data-edit="${o.id}" data-p="${o.price}" data-o="${o.priceOrig || ''}" data-a="${o.available}" data-s="${o.status}">Vérifier / modifier</button> <button class="btn btn-sm" data-flag="${o.id}" data-f="${o.flagged}">${o.flagged ? 'Retirer signal' : 'Signaler obsolète'}</button></td></tr>`)}</tbody></table></div>${pager(st.page, r.total, 25)}`.s;
    box.querySelectorAll('[data-page]').forEach((b) => b.onclick = () => { st.page = +b.dataset.page; draw(); });
    box.querySelectorAll('[data-flag]').forEach((b) => b.onclick = async () => { await api(`/api/admin/offers/${b.dataset.flag}/flag`, { method: 'POST', body: { flagged: b.dataset.f !== 'true' } }); draw(); });
    box.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => formModal('Vérifier / modifier l’offre', html`<p class="small muted">L’enregistrement met à jour la date de relevé et réévalue les alertes.</p>${field('Prix actuel (€)', 'price', b.dataset.p, 'type="number" step="0.01" min="0.01" required')}${field('Prix de référence annoncé (€, vide = aucun)', 'priceOrig', b.dataset.o, 'type="number" step="0.01"')}${select('Disponibilité', 'available', [['1', 'Disponible'], ['0', 'Indisponible']], b.dataset.a === 'true' ? '1' : '0')}${select('Statut de vérification', 'status', [['verified', 'Vérifiée'], ['unverified', 'Non vérifiée'], ['obsolete', 'Obsolète']], b.dataset.s)}`, async (v) => { const r = await api('/api/admin/offers/' + b.dataset.edit, { method: 'PUT', body: { price: +v.price, priceOrig: v.priceOrig, available: v.available === '1', status: v.status } }); toast(`Offre mise à jour — ${r.alertsTriggered} alerte(s) déclenchée(s)`); draw(); }));
  };
  box.querySelector('#oq').oninput = debounce((e) => { st.q = e.target.value; st.page = 1; draw(); });
  box.querySelector('#os').onchange = (e) => { st.state = e.target.value; st.page = 1; draw(); };
  box.querySelector('#sim').onclick = async () => { const r = await api('/api/admin/offers/simulate-refresh', { method: 'POST' }); toast(`${r.updated} offres simulées, ${r.alertsTriggered} alerte(s) déclenchée(s)`); draw(); };
  draw();
}

async function codes(box) {
  const { merchants } = await api('/api/admin/merchants');
  const draw = async () => {
    const { codes } = await api('/api/admin/promo-codes');
    const form = (c) => html`<div class="inline-form">${field('Code', 'code', c?.code, 'required')}${select('Type', 'type', [['percent', 'Pourcentage'], ['fixed', 'Montant fixe'], ['freeship', 'Livraison offerte']], c?.type || 'percent')}${field('Valeur', 'value', c?.value ?? 0, 'type="number" step="0.01" min="0"')}${select('Marchand', 'merchantId', merchants.map((m) => [m.id, m.name]), c?.merchant_id)}${field('Montant minimum (€)', 'minAmount', c?.min_amount ?? 0, 'type="number" step="0.01" min="0"')}${field('Expiration', 'expiresAt', c?.expires_at?.slice(0, 10) || '', 'type="date"')}</div>${field('Conditions affichées', 'conditions', c?.conditions)}${field('Catégories éligibles (virgules : parfum, skincare…)', 'categories', c ? JSON.parse(c.categories || '[]').join(',') : '')}<label class="check"><input type="checkbox" name="active" value="1" ${c?.active !== 0 ? 'checked' : ''}> Actif</label>`;
    const body = (v) => ({ ...v, active: !!v.active, categories: String(v.categories || '').split(',').map((x) => x.trim()).filter(Boolean), expiresAt: v.expiresAt ? new Date(v.expiresAt + 'T23:59:59Z').toISOString() : null });
    box.innerHTML = html`<div class="row between"><h1>Codes promotionnels</h1><button class="btn btn-primary" id="new">Ajouter un code</button></div><div class="table-wrap"><table class="t"><thead><tr><th>Code</th><th>Marchand</th><th>Remise</th><th>Min.</th><th>Expiration</th><th>État</th><th></th></tr></thead><tbody>${codes.map((c) => html`<tr><td><code>${c.code}</code></td><td>${c.merchant}</td><td>${c.type === 'percent' ? c.value + ' %' : c.type === 'fixed' ? eur(c.value) : 'Livraison'}</td><td>${eur(c.min_amount)}</td><td>${dateFr(c.expires_at)}</td><td>${!c.active ? html`<span class="tag warn">désactivé</span>` : c.expires_at && Date.parse(c.expires_at) < Date.now() ? html`<span class="tag bad">expiré</span>` : html`<span class="tag ok">actif</span>`}</td><td><button class="btn btn-sm" data-edit="${c.id}">Modifier</button> <button class="btn btn-sm btn-danger" data-del="${c.id}">Supprimer</button></td></tr>`)}</tbody></table></div>`.s;
    box.querySelector('#new').onclick = () => formModal('Nouveau code', form(null), async (v) => { await api('/api/admin/promo-codes', { method: 'POST', body: body(v) }); toast('Code créé'); draw(); });
    box.querySelectorAll('[data-edit]').forEach((b) => b.onclick = () => { const c = codes.find((x) => x.id === +b.dataset.edit); formModal('Modifier le code', form(c), async (v) => { await api('/api/admin/promo-codes/' + c.id, { method: 'PUT', body: body(v) }); toast('Enregistré'); draw(); }); });
    box.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => { if (await confirmBox('Supprimer ce code ?', 'Supprimer')) { await api('/api/admin/promo-codes/' + b.dataset.del, { method: 'DELETE' }); draw(); } });
  };
  await draw();
}

async function users(box) {
  let q = '';
  const draw = async () => {
    const { users } = await api('/api/admin/users', { query: { q } });
    box.innerHTML = html`<h1>Utilisateurs</h1><input id="uq" type="search" placeholder="Email ou nom…" value="${q}" style="max-width:280px;margin-bottom:1rem"><div class="table-wrap"><table class="t"><thead><tr><th>Compte</th><th>Rôle</th><th>Créé</th><th>État</th><th></th></tr></thead><tbody>${users.map((u) => html`<tr><td><strong>${u.email}</strong><div class="small muted">${u.name || ''}</div></td><td>${u.role}</td><td>${dateFr(u.created_at)}</td><td>${u.status === 'active' ? html`<span class="tag ok">actif</span>` : html`<span class="tag bad">suspendu</span>`} ${u.deletion_requested ? html`<span class="tag warn">suppression demandée ${dateFr(u.deletion_requested)}</span>` : ''}</td>
      <td>${u.role === 'admin' ? '' : html`<button class="btn btn-sm" data-st="${u.id}" data-s="${u.status}">${u.status === 'active' ? 'Suspendre' : 'Réactiver'}</button> <button class="btn btn-sm btn-danger" data-del="${u.id}">${u.deletion_requested ? 'Traiter la suppression' : 'Supprimer'}</button>`}</td></tr>`)}</tbody></table></div>`.s;
    const inp = box.querySelector('#uq'); inp.oninput = debounce((e) => { q = e.target.value; draw().then(() => box.querySelector('#uq').focus()); }, 350);
    box.querySelectorAll('[data-st]').forEach((b) => b.onclick = async () => { await api(`/api/admin/users/${b.dataset.st}/status`, { method: 'PUT', body: { status: b.dataset.s === 'active' ? 'suspended' : 'active' } }); draw(); });
    box.querySelectorAll('[data-del]').forEach((b) => b.onclick = async () => { if (await confirmBox('Supprimer définitivement ce compte et ses données ?', 'Supprimer')) { await api('/api/admin/users/' + b.dataset.del, { method: 'DELETE' }); toast('Compte supprimé'); draw(); } });
  };
  await draw();
}

async function reports(box) {
  const { reports } = await api('/api/admin/reports');
  box.innerHTML = html`<h1>Signalements</h1>${reports.length ? html`<div class="table-wrap"><table class="t"><thead><tr><th>Date</th><th>Message</th><th>Produit / offre</th><th>État</th><th></th></tr></thead><tbody>${reports.map((r) => html`<tr><td>${dateTimeFr(r.created_at)}</td><td>${r.message}</td><td>${r.product_id ? html`produit #${r.product_id}` : ''} ${r.offer_id ? html`offre #${r.offer_id}` : ''}</td><td>${r.status === 'open' ? html`<span class="tag warn">ouvert</span>` : html`<span class="tag ok">traité</span>`}</td><td><button class="btn btn-sm" data-r="${r.id}" data-s="${r.status}">${r.status === 'open' ? 'Marquer traité' : 'Rouvrir'}</button></td></tr>`)}</tbody></table></div>` : empty('Aucun signalement', '')}`.s;
  box.querySelectorAll('[data-r]').forEach((b) => b.onclick = async () => { await api('/api/admin/reports/' + b.dataset.r, { method: 'PUT', body: { status: b.dataset.s === 'open' ? 'resolved' : 'open' } }); reports_(box); });
}
const reports_ = (box) => reports(box);

async function matches(box) {
  const draw = async () => {
    const { matches } = await api('/api/admin/matches');
    box.innerHTML = html`<h1>Rapprochement de produits</h1><p class="muted small">Les correspondances incertaines (confiance faible, EAN absent) sont soumises à validation manuelle avant de rattacher une offre à un produit. Critères : marque, nom normalisé, format, concentration, référence fabricant, code-barres. Exemples de démonstration.</p>
      ${matches.length ? html`<div class="table-wrap"><table class="t"><thead><tr><th>Libellé du flux</th><th>Marchand</th><th>Produit proposé</th><th>Confiance</th><th>Raison</th><th></th></tr></thead><tbody>${matches.map((m) => html`<tr><td>${m.feed_title}</td><td>${m.merchant}</td><td>${m.product}</td><td><span class="tag ${m.confidence >= 0.75 ? 'ok' : 'warn'}">${Math.round(m.confidence * 100)} %</span></td><td class="small">${m.reason}</td><td><button class="btn btn-sm btn-primary" data-v="${m.id}">Valider</button> <button class="btn btn-sm btn-danger" data-x="${m.id}">Rejeter</button></td></tr>`)}</tbody></table></div>` : empty('Aucun rapprochement en attente', '')}`.s;
    box.querySelectorAll('[data-v],[data-x]').forEach((b) => b.onclick = async () => { await api('/api/admin/matches/' + (b.dataset.v || b.dataset.x), { method: 'POST', body: { decision: b.dataset.v ? 'validate' : 'reject' } }); draw(); });
  };
  await draw();
}

async function journal(box) {
  const { entries } = await api('/api/admin/audit', { query: { limit: 200 } });
  box.innerHTML = html`<h1>Journal des modifications</h1>${entries.length ? html`<div class="table-wrap"><table class="t"><thead><tr><th>Date</th><th>Administrateur</th><th>Action</th><th>Objet</th><th>Détail</th></tr></thead><tbody>${entries.map((e) => html`<tr><td>${dateTimeFr(e.at)}</td><td>${e.admin_email}</td><td>${e.action}</td><td>${e.entity} ${e.entity_id}</td><td class="small muted">${e.detail}</td></tr>`)}</tbody></table></div>` : empty('Journal vide', 'Les modifications administratives apparaîtront ici.')}`.s;
}
async function messages(box) {
  const [{ messages }, { emails }] = await Promise.all([api('/api/admin/messages'), api('/api/admin/outbox')]);
  box.innerHTML = html`<h1>Messages</h1>${messages.length ? messages.map((m) => html`<div class="card" style="padding:1rem;margin-bottom:.6rem"><strong>${m.subject || '(sans sujet)'}</strong> <span class="small muted">— ${m.name} &lt;${m.email}&gt; · ${dateTimeFr(m.created_at)}</span><p style="margin:.4rem 0 0">${m.body}</p></div>`) : html`<p class="muted">Aucun message.</p>`}
    <h2 style="margin-top:2rem">Boîte d’envoi des emails d’alerte</h2><p class="small muted">Aucun serveur SMTP n’est connecté : les emails sont consignés ici et <strong>non envoyés</strong>.</p>${emails.length ? html`<div class="table-wrap"><table class="t"><thead><tr><th>Date</th><th>Destinataire</th><th>Sujet</th><th>Statut</th></tr></thead><tbody>${emails.map((e) => html`<tr><td>${dateTimeFr(e.created_at)}</td><td>${e.to_email}</td><td>${e.subject}</td><td><span class="tag warn">${e.status}</span></td></tr>`)}</tbody></table></div>` : html`<p class="muted">Aucun email.</p>`}`.s;
}
void spinner; void navigate;

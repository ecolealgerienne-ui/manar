import { html, raw, api, state, eur, dateFr, dateTimeFr, ago, grid, productCard, toast, formValues, showFieldErrors, spinner, empty, confirmBox, ls, loadFavs, modal } from '../lib.js';
import { navigate } from '../router.js';
import { refreshUser } from '../app.js';

// ---------- Connexion / inscription
export async function auth(ctx) {
  const reg = ctx.path === '/inscription';
  const next = ctx.query.next && ctx.query.next.startsWith('/') ? ctx.query.next : '/mon-espace';
  if (state.user) { await navigate(next, { replace: true }); return { title: 'MANOU', html: html`` }; }
  return {
    title: `${reg ? 'Créer un compte' : 'Connexion'} | MANOU`,
    html: html`<div class="container narrow" style="padding:3rem 0"><h1>${reg ? 'Créer un compte' : 'Connexion'}</h1>
      <form id="af" class="card" style="padding:1.5rem" novalidate>
        ${reg ? html`<div class="field"><label for="n">Prénom ou pseudo (facultatif)</label><input id="n" name="name" autocomplete="given-name" maxlength="80"></div>` : ''}
        <div class="field"><label for="e">Adresse email</label><input id="e" name="email" type="email" autocomplete="email" required autofocus></div>
        <div class="field"><label for="p">Mot de passe</label><input id="p" name="password" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}" required ${reg ? 'minlength="10"' : ''}>${reg ? html`<div class="small muted">10 caractères minimum, avec majuscule, minuscule et chiffre.</div>` : ''}</div>
        ${reg ? html`<div class="field"><label class="check"><input type="checkbox" name="acceptTerms" value="1" required> <span>J’accepte les <a href="/conditions" target="_blank">conditions d’utilisation</a> et la <a href="/confidentialite" target="_blank">politique de confidentialité</a>.</span></label>
          <label class="check"><input type="checkbox" name="consentPerso" value="1"> <span>J’accepte que mes recherches soient mémorisées pour personnaliser mes recommandations (facultatif, modifiable à tout moment).</span></label></div>` : ''}
        <button class="btn btn-primary" type="submit">${reg ? 'Créer mon compte' : 'Se connecter'}</button>
        <p class="small muted" style="margin-top:1rem">${reg ? html`Déjà inscrit ? <a href="/connexion?next=${encodeURIComponent(next)}">Connexion</a>` : html`Pas encore de compte ? <a href="/inscription?next=${encodeURIComponent(next)}">Créer un compte</a>`}</p>
      </form>
      ${!reg ? html`<div class="notice demo">Compte de démonstration : <code>user@velune.demo</code> / <code>Demo-Velune-2024!</code></div>` : ''}</div>`,
    mount(root) {
      const form = root.querySelector('#af');
      form.addEventListener('submit', async (e) => {
        e.preventDefault(); const v = formValues(form);
        form.querySelectorAll('.err').forEach((x) => x.remove());
        if (!v.email) return showFieldErrors(form, { message: 'Adresse email requise.', data: { field: 'email' } });
        if (!v.password) return showFieldErrors(form, { message: 'Mot de passe requis.', data: { field: 'password' } });
        const btn = form.querySelector('button[type=submit]'); btn.disabled = true;
        try {
          await api(reg ? '/api/auth/register' : '/api/auth/login', { method: 'POST', body: reg ? { ...v, acceptTerms: !!v.acceptTerms, consentPerso: !!v.consentPerso } : v });
          await refreshUser(); toast(reg ? 'Bienvenue sur MANOU !' : 'Connexion réussie');
          navigate(reg ? '/profil-beaute?welcome=1' : (state.user.role === 'admin' && !ctx.query.next ? '/admin' : next));
        } catch (er) { btn.disabled = false; showFieldErrors(form, er); }
      });
    },
  };
}

const chipGroup = (name, opts, sel = []) => html`<div class="chips">${opts.map((o) => html`<label class="chip ${sel.includes(o) ? 'on' : ''}" style="cursor:pointer"><input type="checkbox" name="${name}" value="${o}" ${sel.includes(o) ? 'checked' : ''} style="display:none"> ${o}</label>`)}</div>`;
const csv = (a) => (a || []).join(', ');
const arr = (x) => [].concat(x || []).filter(Boolean);
const splitCsv = (s) => String(s || '').split(',').map((x) => x.trim()).filter(Boolean);

// ---------- Profil beauté
export async function profile(ctx) {
  const u = state.user; if (!u) throw Object.assign(new Error('Connexion requise'), { status: 401 });
  const pf = u.profile || {}; const P = pf.parfum || {}, S = pf.skincare || {}, M = pf.maquillage || {}, H = pf.cheveux || {};
  const m = state.meta;
  return {
    title: 'Mon profil beauté | MANOU',
    html: html`<div class="container narrow" style="padding:2rem 0"><h1>Mon profil beauté</h1>
      ${ctx.query.welcome ? html`<div class="notice ok">Votre compte est créé. Le questionnaire ci-dessous est <strong>facultatif</strong> : renseignez ce que vous voulez, vous pourrez tout modifier ou supprimer.</div>` : ''}
      <p class="muted">Ces préférences servent uniquement à personnaliser vos recommandations. Elles ne constituent pas un diagnostic médical et vous pouvez les modifier ou les supprimer à tout moment.</p>
      <form id="pf">
        <details open class="card" style="padding:1rem;margin-bottom:1rem"><summary><h2 style="display:inline;font-size:1.5rem">Parfums</h2></summary>
          <div class="field"><strong>Familles olfactives préférées</strong>${chipGroup('p_familles', m.families.map((f) => f.id), P.familles)}</div>
          <div class="field"><strong>Notes favorites</strong>${chipGroup('p_notesAimees', m.notes.map((n) => n.name), P.notesAimees)}</div>
          <div class="field"><strong>Notes à éviter</strong>${chipGroup('p_notesEvitees', m.notes.map((n) => n.name), P.notesEvitees)}</div>
          <div class="inline-form"><div class="field"><label for="pi">Intensité recherchée : <output id="piv">${P.intensite ? P.intensite + '/5' : 'indifférent'}</output></label><input id="pi" name="p_intensite" type="range" min="0" max="5" value="${P.intensite || 0}"></div>
          <div class="field"><label for="pb">Budget habituel (€)</label><input id="pb" name="p_budget" type="number" min="5" value="${P.budget || ''}"></div></div>
          <div class="field"><label for="pm">Marques préférées (séparées par des virgules)</label><input id="pm" name="p_marques" list="brandlist" value="${csv(P.marques)}"><datalist id="brandlist">${m.brands.map((b) => html`<option value="${b.name}">`)}</datalist></div>
          <div class="field"><label for="pp">Parfums déjà possédés (séparés par des virgules)</label><input id="pp" name="p_possedes" value="${csv(P.possedes)}"></div></details>
        <details class="card" style="padding:1rem;margin-bottom:1rem"><summary><h2 style="display:inline;font-size:1.5rem">Skincare</h2></summary>
          <div class="field"><label for="sp">Type de peau (indication cosmétique)</label><select id="sp" name="s_peau"><option value="">Non précisé</option>${m.skinTypes.map((t) => html`<option ${S.peau === t ? 'selected' : ''}>${t}</option>`)}</select></div>
          <div class="field"><strong>Préoccupations cosmétiques</strong>${chipGroup('s_preoccupations', ['hydratation', 'éclat', 'imperfections', 'anti-âge', 'apaisement'], S.preoccupations)}</div>
          <div class="field"><strong>Ingrédients recherchés</strong>${chipGroup('s_actifsRecherches', m.ingredients, S.actifsRecherches)}</div>
          <div class="field"><strong>Ingrédients à éviter</strong>${chipGroup('s_actifsEvites', m.ingredients, S.actifsEvites)}</div>
          <div class="field"><strong>Types de produits préférés</strong>${chipGroup('s_produits', m.subcategories.skincare, S.produits)}</div></details>
        <details class="card" style="padding:1rem;margin-bottom:1rem"><summary><h2 style="display:inline;font-size:1.5rem">Maquillage</h2></summary>
          <div class="field"><strong>Catégories préférées</strong>${chipGroup('m_categories', m.subcategories.maquillage, M.categories)}</div>
          <div class="field"><strong>Finitions</strong>${chipGroup('m_finitions', ['mat', 'lumineuse', 'satinée', 'naturelle', 'brillante'], M.finitions)}</div>
          <div class="inline-form"><div class="field"><label for="mt">Teintes et nuances (texte libre)</label><input id="mt" name="m_teintes" value="${csv(M.teintes)}"></div><div class="field"><label for="mb">Budget (€)</label><input id="mb" name="m_budget" type="number" min="5" value="${M.budget || ''}"></div></div>
          <div class="field"><label for="mm">Marques favorites</label><input id="mm" name="m_marques" list="brandlist" value="${csv(M.marques)}"></div></details>
        <details class="card" style="padding:1rem;margin-bottom:1rem"><summary><h2 style="display:inline;font-size:1.5rem">Cheveux</h2></summary>
          <div class="inline-form"><div class="field"><label for="ht">Type de cheveux</label><select id="ht" name="h_type"><option value="">Non précisé</option>${m.hairTypes.map((t) => html`<option ${H.type === t ? 'selected' : ''}>${t}</option>`)}</select></div><div class="field"><label for="hx">Texture</label><input id="hx" name="h_texture" value="${H.texture || ''}"></div></div>
          <div class="field"><label for="hn">Besoins capillaires (séparés par des virgules)</label><input id="hn" name="h_besoins" value="${csv(H.besoins)}"></div>
          <div class="field"><strong>Produits recherchés</strong>${chipGroup('h_produits', m.subcategories.cheveux, H.produits)}</div></details>
        <label class="check"><input type="checkbox" name="consentPerso" value="1" ${pf.consentPerso !== false ? 'checked' : ''}> Mémoriser mes recherches récentes pour personnaliser mes recommandations</label>
        <div class="row" style="margin-top:1rem"><button class="btn btn-primary" type="submit">Enregistrer</button><button class="btn btn-danger" type="button" id="wipe">Supprimer toutes mes préférences</button><a class="btn" href="/mon-espace">Voir mes recommandations</a></div>
      </form></div>`,
    mount(root) {
      const form = root.querySelector('#pf');
      form.querySelectorAll('.chip input').forEach((i) => i.addEventListener('change', () => i.parentElement.classList.toggle('on', i.checked)));
      form.p_intensite.addEventListener('input', () => { root.querySelector('#piv').textContent = +form.p_intensite.value ? form.p_intensite.value + '/5' : 'indifférent'; });
      const collect = () => {
        const g = (n) => [...form.querySelectorAll(`[name="${n}"]:checked`)].map((i) => i.value);
        return { consentPerso: form.consentPerso.checked,
          parfum: { familles: g('p_familles'), notesAimees: g('p_notesAimees'), notesEvitees: g('p_notesEvitees'), intensite: +form.p_intensite.value || null, budget: form.p_budget.value || null, marques: splitCsv(form.p_marques.value), possedes: splitCsv(form.p_possedes.value) },
          skincare: { peau: form.s_peau.value || null, preoccupations: g('s_preoccupations'), actifsRecherches: g('s_actifsRecherches'), actifsEvites: g('s_actifsEvites'), produits: g('s_produits') },
          maquillage: { categories: g('m_categories'), finitions: g('m_finitions'), teintes: splitCsv(form.m_teintes.value), budget: form.m_budget.value || null, marques: splitCsv(form.m_marques.value) },
          cheveux: { type: form.h_type.value || null, texture: form.h_texture.value || null, besoins: splitCsv(form.h_besoins.value), produits: g('h_produits') } };
      };
      const save = async (profile, msg) => { try { state.user = await api('/api/me', { method: 'PUT', body: { profile } }); toast(msg); } catch (e) { toast(e.message, 'err'); } };
      form.addEventListener('submit', (e) => { e.preventDefault(); save(collect(), 'Profil enregistré'); });
      root.querySelector('#wipe').onclick = async () => { if (await confirmBox('Supprimer toutes vos préférences beauté ? Cette action est immédiate.', 'Supprimer')) { await save({ consentPerso: form.consentPerso.checked }, 'Préférences supprimées'); navigate('/profil-beaute'); } };
    },
  };
}

// ---------- Tableau de bord
export async function dashboard() {
  const d = await api('/api/me/dashboard');
  const R = d.recommendations;
  return {
    title: 'Mon espace beauté | MANOU',
    html: html`<div class="container" style="padding:2rem 0"><div class="sec-head"><div><p class="eyebrow">Mon espace beauté</p><h1>Bonjour${d.user.name ? ' ' + d.user.name : ''}</h1></div><div class="row"><a class="btn" href="/profil-beaute">Modifier mon profil</a><a class="btn" href="/compte">Mon compte</a>${d.user.role === 'admin' ? html`<a class="btn btn-primary" href="/admin">Administration</a>` : ''}</div></div>
      <div class="grid g3" style="margin-bottom:2rem">
        <div class="card" style="padding:1.2rem"><h3>Mes catégories favorites</h3>${d.favoriteCategories.length ? html`<div class="chips">${d.favoriteCategories.map((c) => html`<span class="chip">${c.name} · ${c.count}</span>`)}</div>` : html`<p class="muted small">Ajoutez des favoris pour voir apparaître vos catégories.</p>`}</div>
        <div class="card" style="padding:1.2rem"><h3>Mes notes olfactives</h3>${d.favoriteNotes.length ? html`<div class="chips">${d.favoriteNotes.map((n) => html`<a class="chip" href="/parfums?notes=${encodeURIComponent(n.name)}">${n.name}</a>`)}</div>` : html`<p class="muted small">Renseignez vos notes dans le <a href="/profil-beaute">profil beauté</a>.</p>`}</div>
        <div class="card" style="padding:1.2rem"><h3>Mes marques favorites</h3>${d.favoriteBrands.length ? html`<div class="chips">${d.favoriteBrands.map((b) => html`<a class="chip" href="/recherche?q=${encodeURIComponent(b)}">${b}</a>`)}</div>` : html`<p class="muted small">Aucune marque pour l’instant.</p>`}</div>
        <div class="card" style="padding:1.2rem"><h3>Mes dernières recherches</h3>${d.searches.length ? html`<ul style="padding-left:1.1rem;margin:0">${d.searches.map((s) => html`<li><a href="/recherche?q=${encodeURIComponent(s.q)}">${s.q}</a></li>`)}</ul><button class="link small" id="clr">Effacer l’historique</button>` : html`<p class="muted small">${d.user.profile.consentPerso === false ? 'La mémorisation des recherches est désactivée.' : 'Aucune recherche récente.'}</p>`}</div>
        <div class="card" style="padding:1.2rem"><h3>Mes alertes de prix</h3>${d.alerts.length ? d.alerts.map((a) => html`<div class="small" style="margin-bottom:.4rem"><a href="/produit/${a.product.slug}">${a.product.name}</a> (${a.format.label}) — cible ${eur(a.targetPrice)}, actuel ${eur(a.currentPrice)} ${a.reached ? html`<span class="tag ok">atteinte</span>` : ''}</div>`) : html`<p class="muted small">Aucune alerte.</p>`}<a class="small" href="/alertes">Gérer mes alertes</a>${d.unread ? html`<p><a class="tag gold" href="/notifications">${d.unread} notification${d.unread > 1 ? 's' : ''} non lue${d.unread > 1 ? 's' : ''}</a></p>` : ''}</div>
        <div class="card" style="padding:1.2rem"><h3>Mes produits sauvegardés</h3>${d.saved.length ? html`<ul style="padding-left:1.1rem;margin:0">${d.saved.slice(0, 5).map((p) => html`<li><a href="/produit/${p.slug}">${p.name}</a> <span class="small muted">${p.minPrice ? eur(p.minPrice) : ''}</span></li>`)}</ul><a class="small" href="/favoris">Voir mes listes</a>` : html`<p class="muted small">Aucun favori. Cliquez sur ♡ sur une fiche produit.</p>`}</div>
      </div>
      <h2>Mes recommandations personnalisées</h2>
      ${R.hasProfile ? html`<p class="muted small">Calculées à partir de votre profil et de vos favoris ; chaque recommandation indique ses raisons.</p>
        ${R.products.length ? grid(R.products) : empty('Pas encore de recommandation', 'Complétez votre profil beauté.', html`<a class="btn" href="/profil-beaute">Compléter mon profil</a>`)}
        ${R.promos.length ? html`<h3 style="margin-top:2rem">Promotions sur vos marques préférées</h3>${grid(R.promos)}` : ''}
        ${R.newcomers.length ? html`<h3 style="margin-top:2rem">Nouveautés correspondant à vos goûts</h3>${grid(R.newcomers)}` : ''}
        ${R.alternatives.length ? html`<h3 style="margin-top:2rem">Alternatives moins chères à vos favoris</h3>${grid(R.alternatives)}` : ''}`
        : empty('Personnalisez votre expérience', 'Renseignez votre profil beauté (facultatif) ou ajoutez des favoris pour recevoir des recommandations expliquées.', html`<a class="btn btn-primary" href="/profil-beaute">Créer mon profil beauté</a>`)}
    </div>`,
    mount(root) { root.querySelector('#clr')?.addEventListener('click', async () => { await api('/api/me/search-history', { method: 'DELETE' }); toast('Historique effacé'); navigate('/mon-espace'); }); },
  };
}

// ---------- Favoris & listes
export async function favorites() {
  if (!state.user) {
    const ids = [...state.favIds];
    const items = ids.length ? (await api('/api/products/lookup', { method: 'POST', body: { ids } })).items : [];
    return { title: 'Favoris | MANOU', html: html`<div class="container" style="padding:2rem 0"><h1>Mes favoris</h1><div class="notice">Vos favoris sont enregistrés dans ce navigateur. <a href="/inscription?next=/favoris">Créez un compte</a> pour les retrouver partout, créer plusieurs listes et suivre leurs prix.</div>${items.length ? grid(items) : empty('Aucun favori', 'Cliquez sur ♡ sur un produit pour l’ajouter.', html`<a class="btn" href="/parfums">Explorer</a>`)}</div>` };
  }
  const { lists } = await api('/api/lists');
  return {
    title: 'Mes favoris et listes | MANOU',
    html: html`<div class="container" style="padding:2rem 0"><div class="sec-head"><h1 style="margin:0">Mes favoris et listes</h1><form id="nl" class="row"><label class="sr" for="nln">Nom de la nouvelle liste</label><input id="nln" name="name" placeholder="Ex. Ma routine skincare" maxlength="60" required style="width:240px"><button class="btn btn-primary btn-sm">Créer une liste</button></form></div>
      <p class="muted small">Idées : « Ma wishlist parfum », « Ma routine skincare », « À acheter prochainement », « Mes produits habituels ».</p>
      ${lists.map((l) => html`<section class="card" style="padding:1.2rem;margin-bottom:1.5rem" data-list="${l.id}"><div class="row between"><h2 style="margin:0;font-size:1.5rem">${l.name} <span class="small muted">(${l.items.length})</span></h2>${l.isDefault ? '' : html`<span><button class="btn btn-sm" data-rename="${l.id}" data-name="${l.name}">Renommer</button> <button class="btn btn-sm btn-danger" data-delete="${l.id}">Supprimer</button></span>`}</div>
        ${l.items.length ? html`<p class="small muted">Prix actuels ; ${l.items.filter((i) => i.onPromo).length} produit(s) en promotion.</p><div class="grid g4">${l.items.map((p) => html`<div>${productCard(p)}<button class="link small" data-rm="${l.id}:${p.id}">Retirer de cette liste</button> ${lists.length > 1 ? html`<select class="small" data-addto="${p.id}" aria-label="Ajouter ${p.name} à une liste" style="width:auto;padding:.2rem"><option value="">Ajouter à…</option>${lists.filter((x) => x.id !== l.id).map((x) => html`<option value="${x.id}">${x.name}</option>`)}</select>` : ''}</div>`)}</div>` : html`<p class="muted">Cette liste est vide.</p>`}</section>`)}</div>`,
    mount(root) {
      root.querySelector('#nl').addEventListener('submit', async (e) => { e.preventDefault(); try { await api('/api/lists', { method: 'POST', body: formValues(e.target) }); navigate('/favoris'); } catch (er) { toast(er.message, 'err'); } });
      root.addEventListener('click', async (e) => {
        const t = e.target;
        try {
          if (t.dataset.rename) { const n = prompt('Nouveau nom', t.dataset.name); if (n) { await api('/api/lists/' + t.dataset.rename, { method: 'PUT', body: { name: n } }); navigate('/favoris'); } }
          if (t.dataset.delete && await confirmBox('Supprimer cette liste ?', 'Supprimer')) { await api('/api/lists/' + t.dataset.delete, { method: 'DELETE' }); navigate('/favoris'); }
          if (t.dataset.rm) { const [l, p] = t.dataset.rm.split(':'); await api(`/api/lists/${l}/items/${p}`, { method: 'DELETE' }); await loadFavs(); navigate('/favoris'); }
        } catch (er) { toast(er.message, 'err'); }
      });
      root.addEventListener('change', async (e) => { if (e.target.dataset.addto && e.target.value) { try { await api(`/api/lists/${e.target.value}/items`, { method: 'POST', body: { productId: +e.target.dataset.addto } }); toast('Ajouté à la liste'); navigate('/favoris'); } catch (er) { toast(er.message, 'err'); } } });
    },
  };
}

// ---------- Alertes
export async function alerts() {
  const { alerts } = await api('/api/alerts');
  return {
    title: 'Alertes de prix | MANOU',
    html: html`<div class="container" style="padding:2rem 0"><h1>Alertes de prix</h1><p class="muted" style="max-width:64ch">Créez une alerte depuis la fiche d’un produit. Vous êtes prévenu uniquement lorsqu’une offre <strong>vérifiée</strong>, disponible, non expirée et non périmée passe sous votre prix cible. Notifications dans le centre de notifications ; l’email nécessite la configuration d’un serveur SMTP (non connecté en démonstration).</p>
      ${alerts.length ? html`<div class="table-wrap"><table class="t stack"><thead><tr><th>Produit</th><th>Format</th><th>Prix actuel</th><th>Prix cible</th><th>État</th><th></th></tr></thead><tbody>${alerts.map((a) => html`<tr><td data-l="Produit"><a href="/produit/${a.product.slug}"><strong>${a.product.brand}</strong> ${a.product.name}</a></td><td data-l="Format">${a.format.label}</td>
        <td data-l="Prix actuel">${eur(a.currentPrice)}${a.currentTrustedPrice == null && a.currentPrice != null ? html`<div class="small muted">offre non vérifiée</div>` : ''}</td>
        <td data-l="Prix cible"><form class="row" data-edit="${a.id}" style="flex-wrap:nowrap"><label class="sr" for="t${a.id}">Prix cible</label><input id="t${a.id}" name="targetPrice" type="number" step="0.01" min="1" value="${a.targetPrice}" style="width:96px;padding:.3rem"><button class="btn btn-sm">OK</button></form></td>
        <td data-l="État">${a.active ? (a.reached ? html`<span class="tag ok">Seuil atteint</span>` : html`<span class="tag">Active</span>`) : html`<span class="tag warn">Désactivée</span>`}${a.lastTriggered ? html`<div class="small muted">déclenchée ${ago(a.lastTriggered)}</div>` : ''}</td>
        <td data-l=""><button class="btn btn-sm" data-toggle="${a.id}" data-active="${a.active}">${a.active ? 'Désactiver' : 'Activer'}</button> <button class="btn btn-sm btn-danger" data-del="${a.id}">Supprimer</button></td></tr>`)}</tbody></table></div>`
        : empty('Aucune alerte', 'Ouvrez une fiche produit et cliquez sur « Alerte de prix ».', html`<a class="btn" href="/parfums">Explorer les parfums</a>`)}</div>`,
    mount(root) {
      root.addEventListener('submit', async (e) => { const id = e.target.dataset.edit; if (!id) return; e.preventDefault(); try { await api('/api/alerts/' + id, { method: 'PUT', body: { targetPrice: +formValues(e.target).targetPrice } }); toast('Seuil modifié'); navigate('/alertes'); } catch (er) { toast(er.message, 'err'); } });
      root.addEventListener('click', async (e) => {
        const t = e.target;
        try {
          if (t.dataset.toggle) { await api('/api/alerts/' + t.dataset.toggle, { method: 'PUT', body: { active: t.dataset.active !== 'true' } }); navigate('/alertes'); }
          if (t.dataset.del && await confirmBox('Supprimer cette alerte ?', 'Supprimer')) { await api('/api/alerts/' + t.dataset.del, { method: 'DELETE' }); navigate('/alertes'); }
        } catch (er) { toast(er.message, 'err'); }
      });
    },
  };
}

// ---------- Notifications
export async function notifications() {
  const r = await api('/api/notifications');
  return {
    title: 'Notifications | MANOU',
    html: html`<div class="container narrow" style="padding:2rem 0"><div class="sec-head"><h1 style="margin:0">Notifications</h1>${r.unread ? html`<button class="btn btn-sm" id="readall">Tout marquer comme lu</button>` : ''}</div>
      ${r.items.length ? r.items.map((n) => html`<div class="card" style="padding:1rem;margin-bottom:.7rem;${n.read ? 'opacity:.75' : 'border-color:var(--gold)'}"><div class="row between"><span class="small muted">${dateTimeFr(n.created_at)} ${n.read ? '' : html`<span class="tag gold">Nouveau</span>`}</span><button class="link small" data-del="${n.id}">Supprimer</button></div><p style="margin:.3rem 0">${n.message}</p>${n.link ? html`<a href="${n.link}">Voir le produit</a>` : ''}</div>`)
        : empty('Aucune notification', 'Vos alertes de prix apparaîtront ici.')}</div>`,
    mount(root) {
      root.querySelector('#readall')?.addEventListener('click', async () => { await api('/api/notifications/read', { method: 'POST' }); state.unread = 0; navigate('/notifications'); });
      root.addEventListener('click', async (e) => { if (e.target.dataset.del) { await api('/api/notifications/' + e.target.dataset.del, { method: 'DELETE' }); navigate('/notifications'); } });
      if (r.unread) setTimeout(() => { state.unread = 0; }, 0);
    },
  };
}

// ---------- Mon compte
export async function settings() {
  const u = state.user; if (!u) throw Object.assign(new Error('Connexion requise'), { status: 401 });
  return {
    title: 'Mon compte | MANOU',
    html: html`<div class="container narrow" style="padding:2rem 0"><h1>Mon compte</h1>
      <form id="inf" class="card" style="padding:1.2rem;margin-bottom:1.2rem"><h2 style="font-size:1.4rem">Informations</h2><div class="field"><label>Email</label><input value="${u.email}" disabled></div><div class="field"><label for="nm">Prénom ou pseudo</label><input id="nm" name="name" value="${u.name || ''}" maxlength="80"></div><button class="btn btn-primary btn-sm">Enregistrer</button></form>
      <form id="pwf" class="card" style="padding:1.2rem;margin-bottom:1.2rem"><h2 style="font-size:1.4rem">Mot de passe</h2><div class="field"><label for="cp">Mot de passe actuel</label><input id="cp" name="current" type="password" autocomplete="current-password" required></div><div class="field"><label for="np">Nouveau mot de passe</label><input id="np" name="password" type="password" autocomplete="new-password" required minlength="10"></div><button class="btn btn-primary btn-sm">Changer</button></form>
      <div class="card" style="padding:1.2rem;margin-bottom:1.2rem"><h2 style="font-size:1.4rem">Données personnelles</h2><p class="small muted">Vous pouvez exporter toutes vos données ou supprimer votre compte à tout moment (RGPD).</p><div class="row"><button class="btn" id="exp">Exporter mes données (JSON)</button><button class="btn" id="req">Demander la suppression à l’équipe</button><button class="btn btn-danger" id="del">Supprimer mon compte maintenant</button></div>${u.deletionRequested ? html`<div class="notice">Demande de suppression enregistrée le ${dateFr(u.deletionRequested)}.</div>` : ''}</div>
      <div class="row"><button class="btn" id="out">Se déconnecter</button><a class="btn" href="/cookies">Gérer mes cookies</a></div></div>`,
    mount(root) {
      root.querySelector('#inf').onsubmit = async (e) => { e.preventDefault(); try { state.user = await api('/api/me', { method: 'PUT', body: formValues(e.target) }); toast('Enregistré'); } catch (er) { showFieldErrors(e.target, er); } };
      root.querySelector('#pwf').onsubmit = async (e) => { e.preventDefault(); try { await api('/api/me/password', { method: 'PUT', body: formValues(e.target) }); e.target.reset(); toast('Mot de passe modifié'); } catch (er) { showFieldErrors(e.target, er); } };
      root.querySelector('#exp').onclick = async () => { const d = await api('/api/me/export'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' })); a.download = 'velune-mes-donnees.json'; a.click(); };
      root.querySelector('#req').onclick = async () => { await api('/api/me/deletion-request', { method: 'POST' }); toast('Demande enregistrée'); };
      root.querySelector('#del').onclick = () => {
        const { el, close } = modal(html`<h3>Supprimer mon compte</h3><p>Cette action est définitive : compte, favoris, alertes, paniers et historique seront supprimés.</p><form id="df"><div class="field"><label for="dp">Confirmez avec votre mot de passe</label><input id="dp" name="password" type="password" required autofocus></div><div class="row" style="justify-content:flex-end"><button type="button" class="btn" data-close>Annuler</button><button class="btn btn-danger">Supprimer définitivement</button></div></form>`, { title: 'Suppression du compte' });
        el.querySelector('#df').onsubmit = async (e) => { e.preventDefault(); try { await api('/api/me', { method: 'DELETE', body: formValues(e.target) }); close(); await refreshUser(); toast('Compte supprimé'); navigate('/'); } catch (er) { showFieldErrors(e.target, er); } };
      };
      root.querySelector('#out').onclick = async () => { await api('/api/auth/logout', { method: 'POST' }); await refreshUser(); navigate('/'); };
    },
  };
}
void raw; void dateTimeFr; void spinner; void ls;

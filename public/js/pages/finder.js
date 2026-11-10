import { html, api, state, grid, spinner, empty, formValues, productCard } from '../lib.js';

// États d'une note : none → inc (recherchée) → exc (exclue) → pref (préférée) → sec (secondaire) → none
const CYCLE = ['', 'inc', 'exc', 'pref', 'sec'];
const LABEL = { inc: 'recherchée', exc: 'exclue', pref: 'préférée', sec: 'secondaire' };

export default async function finder() {
  const m = state.meta;
  const noteState = {};
  const groups = Object.entries(m.noteGroups);
  return {
    title: 'Trouver mon parfum — recherche olfactive | VELUNE', desc: 'Combinez familles olfactives, notes de tête, cœur et fond, intensité, saison, occasion et budget.',
    html: html`<div class="container" style="padding-top:1.5rem"><div class="crumbs"><a href="/">Accueil</a> › <a href="/parfums">Parfums</a> › Trouver mon parfum</div>
      <h1>Trouver mon parfum</h1><p class="muted" style="max-width:64ch">Décrivez ce que vous aimez : VELUNE classe les parfums par <strong>score de correspondance</strong> et indique les critères satisfaits. Un parfum qui ne contient qu’une seule des notes recherchées n’est jamais présenté comme parfait.</p>
      <div class="catalog" style="grid-template-columns:minmax(0,420px) 1fr">
      <form id="ff" class="card" style="padding:1.2rem;gap:1rem" autocomplete="off">
        <fieldset class="field" style="border:0;padding:0"><legend><strong>Familles olfactives</strong></legend><div class="chips">${m.families.map((f) => html`<label class="chip" title="${f.desc}" style="cursor:pointer"><input type="checkbox" name="families" value="${f.id}" style="display:none"> ${f.name}</label>`)}</div></fieldset>
        <div class="field"><strong>Notes</strong><p class="small muted" style="margin:.2rem 0 .6rem">Cliquez une note pour la faire passer par : <span class="chip inc">recherchée</span> <span class="chip exc">exclue</span> <span class="chip pref">préférée</span> <span class="chip sec">secondaire</span> puis aucune.</p>
          ${groups.map(([id, name]) => html`<p class="small muted" style="margin:.6rem 0 .2rem">${name}</p><div class="chips">${m.notes.filter((n) => n.group === id).map((n) => html`<button type="button" class="chip" data-note="${n.name}" aria-label="${n.name} : aucune sélection">${n.name}</button>`)}</div>`)}
        </div>
        <details><summary><strong>Par couche olfactive (avancé)</strong></summary><p class="small muted">Exiger une note précisément en tête, en cœur ou en fond.</p>
          ${[['top', 'Notes de tête'], ['heart', 'Notes de cœur'], ['base', 'Notes de fond']].map(([k, l]) => html`<div class="field"><label for="l-${k}">${l}</label><select id="l-${k}" name="${k}" multiple size="4">${m.notes.map((n) => html`<option>${n.name}</option>`)}</select></div>`)}</details>
        <div class="inline-form">
          <div class="field"><label for="g">Genre</label><select id="g" name="gender"><option value="">Tous</option><option value="F">Femme</option><option value="H">Homme</option><option value="M">Mixte</option></select></div>
          <div class="field"><label for="b">Budget max (€)</label><input id="b" name="budget" type="number" min="10" placeholder="Ex. 100"></div>
          <div class="field"><label for="i">Intensité souhaitée : <output id="iv">indifférent</output></label><input id="i" name="intensity" type="range" min="0" max="5" value="0"></div>
          <div class="field"><label for="c">Concentration</label><select id="c" name="conc"><option value="">Toutes</option>${m.concentrations.map((c) => html`<option value="${c.id}">${c.name}</option>`)}</select></div>
          <div class="field"><label for="s">Saison</label><select id="s" name="seasons"><option value="">Toutes</option>${m.seasons.map((s) => html`<option>${s}</option>`)}</select></div>
          <div class="field"><label for="o">Occasion</label><select id="o" name="occasions"><option value="">Toutes</option>${m.occasions.map((s) => html`<option>${s}</option>`)}</select></div>
        </div>
        <div class="row"><button class="btn btn-primary" type="submit">Voir les parfums</button><button class="btn" type="reset" id="rst">Réinitialiser</button></div>
        <p class="small muted">Saisons et occasions sont des indications déduites des familles et de l’intensité, non des données du fabricant.</p>
      </form>
      <section aria-live="polite"><div id="fres"><div class="empty"><p>Choisissez vos critères puis lancez la recherche.</p></div></div></section></div></div>`,
    mount(root) {
      const form = root.querySelector('#ff'); const res = root.querySelector('#fres');
      form.querySelectorAll('.chip input').forEach((i) => i.addEventListener('change', () => i.parentElement.classList.toggle('on', i.checked)));
      form.addEventListener('click', (e) => {
        const b = e.target.closest('[data-note]'); if (!b) return;
        const n = b.dataset.note; const cur = CYCLE.indexOf(noteState[n] || ''); const next = CYCLE[(cur + 1) % CYCLE.length];
        noteState[n] = next; b.className = 'chip ' + next; b.setAttribute('aria-label', `${n} : ${next ? LABEL[next] : 'aucune sélection'}`); b.title = next ? LABEL[next] : '';
      });
      const iv = form.querySelector('#i'); iv.addEventListener('input', () => { form.querySelector('#iv').textContent = +iv.value ? `${iv.value}/5` : 'indifférent'; });
      form.querySelector('#rst').addEventListener('click', () => { for (const k of Object.keys(noteState)) delete noteState[k]; form.querySelectorAll('[data-note]').forEach((b) => { b.className = 'chip'; }); form.querySelectorAll('.chip input').forEach((i) => i.parentElement.classList.remove('on')); res.innerHTML = '<div class="empty"><p>Critères réinitialisés.</p></div>'; });
      form.addEventListener('submit', async (e) => {
        e.preventDefault(); const v = formValues(e.target);
        const by = (s) => Object.entries(noteState).filter(([, x]) => x === s).map(([n]) => n);
        const arr = (x) => [].concat(x || []).filter(Boolean);
        const q = { notes: by('inc'), notesExcl: by('exc'), notesPref: by('pref'), notesSec: by('sec'), families: arr(v.families), top: arr(v.top), heart: arr(v.heart), base: arr(v.base), gender: v.gender, budget: v.budget, intensity: +v.intensity || '', conc: v.conc, seasons: v.seasons, occasions: v.occasions };
        res.innerHTML = spinner('Calcul des correspondances…').s;
        try {
          const r = await api('/api/perfumes/finder', { query: q });
          if (!r.items.length) { res.innerHTML = empty('Aucun parfum ne correspond', 'Retirez une note exclue, élargissez le budget ou décochez une famille.').s; return; }
          res.innerHTML = html`<div class="toolbar"><div><strong>${r.total}</strong> parfum${r.total > 1 ? 's' : ''} classé${r.total > 1 ? 's' : ''} par score de correspondance (indicatif)</div></div>
            <div class="grid g3">${r.items.slice(0, 30).map((p) => html`<div>${productCard(p, { showMatch: true })}<details style="margin-top:.4rem"><summary class="small">Pourquoi ce score ?</summary>${p.criteria.map((c) => html`<div class="crit"><span>${c.label}</span><span class="bar"><i style="width:${c.value}%"></i></span><span>${c.value}%</span></div>${c.detail?.length ? html`<div class="small muted" style="margin:-.1rem 0 .3rem">${c.detail.join(', ')}</div>` : ''}`)}</details></div>`)}</div>`.s;
          res.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (er) { res.innerHTML = html`<div class="notice err" role="alert">${er.message}</div>`.s; }
      });
    },
  };
}
void grid;

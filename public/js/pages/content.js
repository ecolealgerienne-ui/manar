import { html, api, state, toast, formValues, showFieldErrors, ls, esc } from '../lib.js';
import { navigate } from '../router.js';

export async function guides() {
  const g = state.meta.guides;
  return { title: 'Guides beauté | VELUNE', desc: 'Guides pour comprendre les parfums, les actifs skincare et comparer les prix.',
    html: html`<div class="container" style="padding:2rem 0"><div class="crumbs"><a href="/">Accueil</a> › Guides</div><h1>Guides</h1><div class="grid g3">${g.map((x) => html`<a class="card" style="padding:1.4rem;text-decoration:none" href="/guides/${x.slug}"><h2 style="font-size:1.5rem">${x.title}</h2><p class="muted small">${x.desc}</p><span class="small">Lire le guide →</span></a>`)}</div></div>` };
}
export async function guide(ctx) {
  const g = await api('/api/guides/' + ctx.params[0]);
  return { title: `${g.title} | Guides VELUNE`, desc: g.desc,
    html: html`<article class="container narrow prose" style="padding:2rem 0"><div class="crumbs"><a href="/">Accueil</a> › <a href="/guides">Guides</a></div><h1>${g.title}</h1>${g.body.map(([h, t]) => html`<h2>${h}</h2><p>${t}</p>`)}
      <div class="notice demo">Contenu éditorial à vocation informative, sans conseil médical.</div><p><a class="btn" href="/guides">Tous les guides</a> <a class="btn btn-primary" href="/parfums">Explorer les parfums</a></p></article>` };
}
export async function ingredients() {
  const r = await api('/api/ingredients');
  return { title: 'Base d’ingrédients cosmétiques | VELUNE', desc: 'Fonction cosmétique et sources documentaires des principaux actifs.',
    html: html`<div class="container" style="padding:2rem 0"><div class="crumbs"><a href="/">Accueil</a> › Ingrédients</div><h1>Ingrédients cosmétiques</h1><div class="notice">${r.disclaimer}</div>
      <div class="grid g3">${r.ingredients.map((i) => html`<article class="card" style="padding:1.2rem" id="${encodeURIComponent(i.name)}"><h2 style="font-size:1.5rem">${i.name}</h2><p><strong>Fonction cosmétique :</strong> ${i.fn}</p><p class="small">${i.desc}</p>
        <p class="small muted"><strong>Dans :</strong> ${i.cats.join(', ')}.<br><strong>Source documentaire :</strong> ${i.src}</p><a class="btn btn-sm" href="/recherche?q=${encodeURIComponent(i.name)}">${i.products} produit${i.products > 1 ? 's' : ''} contenant ${i.name.toLowerCase()}</a></article>`)}</div></div>` };
}
export async function faq() {
  const { faq } = await api('/api/faq');
  return { title: 'FAQ | VELUNE', desc: 'Questions fréquentes.',
    html: html`<div class="container narrow" style="padding:2rem 0"><h1>Questions fréquentes</h1>${faq.map(([q, a]) => html`<details class="card" style="padding:1rem;margin-bottom:.6rem"><summary><strong>${q}</strong></summary><p style="margin:.6rem 0 0">${a}</p></details>`)}<p style="margin-top:2rem">Une autre question ? <a href="/contact">Contactez-nous</a>.</p></div>` };
}
export async function legal(ctx) {
  const p = await api('/api/pages/' + ctx.params[0]);
  return { title: `${p.title} | VELUNE`, desc: p.desc,
    html: html`<article class="container narrow prose" style="padding:2rem 0"><h1>${p.title}</h1>${p.sections.map(([h, t]) => html`<h2>${h}</h2><p>${t}</p>`)}${ctx.params[0] === 'confidentialite' ? html`<p><a class="btn" href="/cookies">Gérer mes cookies</a></p>` : ''}</article>` };
}
export async function contact() {
  return { title: 'Contact | VELUNE', desc: 'Contactez l’équipe VELUNE.',
    html: html`<div class="container narrow" style="padding:2rem 0"><h1>Contact</h1><p class="muted">Question, signalement d’un prix ou demande relative à vos données personnelles : écrivez-nous.</p>
      <form id="cf" class="card" style="padding:1.4rem" novalidate><div class="field"><label for="cn">Nom</label><input id="cn" name="name" required maxlength="100" value="${state.user?.name || ''}"></div>
      <div class="field"><label for="ce">Email</label><input id="ce" name="email" type="email" required value="${state.user?.email || ''}"></div>
      <div class="field"><label for="cs">Sujet</label><input id="cs" name="subject" maxlength="150"></div>
      <div class="field"><label for="cb">Message</label><textarea id="cb" name="body" rows="6" required minlength="10" maxlength="3000"></textarea></div><button class="btn btn-primary">Envoyer</button></form></div>`,
    mount(root) {
      root.querySelector('#cf').onsubmit = async (e) => { e.preventDefault(); const f = e.target; f.querySelectorAll('.err').forEach((x) => x.remove());
        try { await api('/api/contact', { method: 'POST', body: formValues(f) }); f.innerHTML = '<div class="notice ok" role="status">Merci, votre message a bien été enregistré. Nous vous répondrons dès que possible.</div>'; } catch (er) { showFieldErrors(f, { ...er, data: { field: er.message.includes('email') ? 'email' : er.message.includes('Nom') ? 'name' : 'body' }, message: er.message }); } };
    } };
}
export async function cookies() {
  const c = ls.get('velune.cookies', { perso: false });
  const p = await api('/api/pages/cookies');
  return { title: 'Gestion des cookies | VELUNE', desc: p.desc,
    html: html`<article class="container narrow prose" style="padding:2rem 0"><h1>Gestion des cookies</h1>${p.sections.map(([h, t]) => html`<h2>${h}</h2><p>${t}</p>`)}
      <form id="kf" class="card" style="padding:1.2rem"><h2 style="margin-top:0">Mes choix</h2><label class="check"><input type="checkbox" checked disabled> Strictement nécessaires (toujours actifs)</label>
      <label class="check"><input type="checkbox" name="perso" ${c.perso ? 'checked' : ''}> Personnalisation : mémoriser mes recherches pour mes recommandations</label>
      <label class="check"><input type="checkbox" disabled> Mesure d’audience — non utilisée</label><label class="check"><input type="checkbox" disabled> Publicité — non utilisée</label><button class="btn btn-primary" style="margin-top:.8rem">Enregistrer mes choix</button></form></article>`,
    mount(root) { root.querySelector('#kf').onsubmit = async (e) => { e.preventDefault(); const perso = e.target.perso.checked; ls.set('velune.cookies', { perso, at: Date.now() }); document.getElementById('cookie-root').innerHTML = '';
      if (state.user) { try { state.user = await api('/api/me', { method: 'PUT', body: { profile: { ...state.user.profile, consentPerso: perso } } }); } catch { /* ignore */ } } toast('Choix enregistrés'); }; } };
}
void navigate; void esc;

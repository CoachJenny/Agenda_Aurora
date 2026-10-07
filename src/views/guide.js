// Le guide « Mon Aurora » : une question à la fois pour personnaliser l'appli,
// puis une conclusion à vérifier avant de valider. Rien n'est enregistré avant la validation.

import { app, render, go } from '../app.js';
import { S, save, uid, replaceRecurring, weekPrios, isKidsRule, ruleHalf } from '../data/store.js';
import { DEFAULT_THEMES, PALETTE, WEEKDAYS_SHORT, SPORTS, WB_DURATIONS } from '../data/constants.js';
import { H0, H1, hm, today, mondayOf, addDays, weekDates, weekLabel, DAYS_L, parse } from '../lib/time.js';
import { esc, toast, timeField, onTime } from '../lib/ui.js';

const clone = x => JSON.parse(JSON.stringify(x));
const KID_PRESETS = [
  { key: 'ecole-matin', title: "Dépôt à l'école", days: [0, 1, 3, 4], start: 480, end: 525 },
  { key: 'ecole-soir', title: "Sortie d'école", days: [0, 1, 3, 4], start: 990, end: 1050 },
  { key: 'mercredi', title: 'Mercredi avec les enfants', days: [2], start: 720, end: 1080 },
  { key: 'activite', title: 'Activité des enfants', days: [2], start: 840, end: 930 },
  { key: 'diner', title: 'Dîner, bain, coucher', days: [0, 1, 2, 3, 4, 5, 6], start: 1140, end: 1260 }
];

// focus : ouvre directement un seul écran (catégories, moments fixes, garde) avec Annuler / Enregistrer.
export function startGuide(focus = null) {
  const usedThemes = new Set(S.blocks.map(b => b.theme));
  app.guide = {
    step: 0,
    focus: typeof focus === 'string' ? focus : null,
    returnTo: app.tab === 'guide' ? 'accueil' : app.tab,
    themesTuned: S.profile.done || typeof focus === 'string',
    used: [...usedThemes],
    d: {
      name: S.profile.name || '',
      kids: S.profile.kids,
      custodyMode: S.profile.custody ? 'shared' : S.profile.kids ? 'always' : null,
      custody: clone(S.profile.custody),
      sports: [...(S.profile.sports || [])],
      rules: clone(S.recurring),
      themes: clone(S.themes),
      prios: [...weekPrios(mondayOf(today()))],
      wbTags: clone(S.wbTags)
    }
  };
  go('guide');
}

// Raccourcis toujours visibles vers le paramétrage
export function quickLinksHTML() {
  return `<div class="qlinks">
    <button type="button" class="chip" data-qg="themes"><span class="dot" style="--c:var(--t-travail)"></span>Mes catégories</button>
    <button type="button" class="chip" data-qg="allFixed">↻ Mes moments fixes</button>
    ${S.profile.custody ? '<button type="button" class="chip" data-qg="custodyGrid">Ma garde A / B</button>' : ''}
    <button type="button" class="chip" data-qg="all">Tout mon paramétrage</button></div>`;
}
export function bindQuickLinks(v) {
  v.querySelectorAll('[data-qg]').forEach(b => b.onclick = () => startGuide(b.dataset.qg === 'all' ? null : b.dataset.qg));
}

// ---------- Étapes ----------
const STEPS = [
  { id: 'intro' },
  { id: 'name' },
  { id: 'kids' },
  { id: 'custody', when: d => d.kids === true },
  { id: 'custodyGrid', when: d => d.kids === true && d.custodyMode === 'shared' },
  { id: 'kidsTimes', when: d => d.kids === true },
  { id: 'sport' },
  { id: 'sportTimes', when: d => d.sports.length > 0 },
  { id: 'fixed' },
  { id: 'themes' },
  { id: 'prios' },
  { id: 'wb' },
  { id: 'recap' }
];
const visible = d => (app.guide?.focus ? [{ id: app.guide.focus }] : STEPS.filter(s => !s.when || s.when(d)));

// Un moment fixe, modifiable : titre, catégorie, jours, horaires
function ruleEditor(r, d, { pickTheme = true, titleEditable = true, half = false } = {}) {
  return `<div class="rule" data-rule="${r.id}">
    <div class="row" style="flex-wrap:nowrap">${titleEditable ? `<input type="text" data-rt value="${esc(r.title)}" placeholder="Ex. cours de chant" style="flex:1;min-width:0">` : `<b style="flex:1;font-weight:600">${esc(r.title)}</b>`}
      <button type="button" class="iconbtn" data-rdel aria-label="Retirer ce moment" style="width:34px;height:34px;flex:none">✕</button></div>
    ${pickTheme ? `<label class="f">Catégorie<select data-rth>${d.themes.map(t => `<option value="${t.id}" ${t.id === r.theme ? 'selected' : ''}>${esc(t.name)}</option>`).join('')}</select></label>` : ''}
    <div class="row days7">${WEEKDAYS_SHORT.map((w, i) => `<button type="button" class="chip" data-rday="${i}" aria-pressed="${r.days.includes(i)}">${w}</button>`).join('')}</div>
    <div class="row"><label class="f" style="flex:1">De${timeField('ra-' + r.id, r.start)}</label><label class="f" style="flex:1">À${timeField('rb-' + r.id, r.end)}</label></div>
    ${half ? `<div class="f">Posé quand tu as les enfants<div class="seg" role="group" style="margin-top:6px"><button type="button" data-rhalf="0" aria-pressed="${ruleHalf(r) === 0}">le matin</button><button type="button" data-rhalf="1" aria-pressed="${ruleHalf(r) === 1}">le soir</button></div></div>` : ''}
  </div>`;
}
const emptyGrid = () => Array.from({ length: 7 }, () => [false, false]);
const HALF = ['matin', 'soir'];
function gridSummary(grid) {
  const parts = grid.map((c, i) => c[0] && c[1] ? `${DAYS_L[i]} matin et soir` : c[0] ? `${DAYS_L[i]} matin` : c[1] ? `${DAYS_L[i]} soir` : '').filter(Boolean);
  return parts.length ? parts.join(', ') : 'aucun moment';
}
// Semaine (A ou B) d'un lundi, d'après la référence en cours d'édition
function draftWeekType(d, monday) {
  if (!d.custody) return null;
  const w = Math.round((parse(monday) - parse(d.custody.refMonday)) / (7 * 864e5));
  return Math.abs(w) % 2 === 0 ? 'A' : 'B';
}
function draftApplies(d, r, date, i) {
  if (!isKidsRule(r) || d.custodyMode !== 'shared' || !d.custody) return true;
  return !!d.custody.grid[draftWeekType(d, mondayOf(date))][i][ruleHalf(r)];
}
const ruleLine = r => `${esc(r.title)} · ${r.days.length === 7 ? 'tous les jours' : r.days.map(i => WEEKDAYS_SHORT[i]).join(' ')} · ${hm(r.start)}–${hm(r.end)}`;
const themeName = (d, id) => (d.themes.find(t => t.id === id) || { name: '?' }).name;

function stepHTML(id, d, g) {
  switch (id) {
    case 'intro':
      return `<p class="g-eyebrow">Mon Aurora</p><h2>Faisons connaissance avec <em>ton rythme</em></h2>
        <p class="lead">Quelques questions, une à la fois, pour qu'Aurora ressemble à ta vie : tes enfants s'il y en a, ton sport, tes moments fixes, tes catégories.</p>
        <p class="lead">Compte deux à trois minutes. Tu peux passer une question, revenir en arrière, et tout modifier plus tard. Rien n'est enregistré avant que tu valides la conclusion.</p>`;
    case 'name':
      return `<h2>Comment veux-tu qu'Aurora <em>t'appelle</em> ?</h2>
        <p class="lead">Un prénom, un surnom, ou rien du tout.</p>
        <input type="text" id="gName" value="${esc(d.name)}" placeholder="Ton prénom" autocomplete="given-name" style="font-size:18px">`;
    case 'kids':
      return `<h2>As-tu des <em>enfants</em> à la maison ?</h2>
        <p class="lead">Leurs horaires structurent souvent la journée. Autant les poser une fois pour toutes.</p>
        <div class="row"><button type="button" class="chip big" data-kids="1" aria-pressed="${d.kids === true}">Oui</button><button type="button" class="chip big" data-kids="0" aria-pressed="${d.kids === false}">Non</button></div>`;
    case 'custody':
      return `<h2>Les enfants sont-ils avec toi <em>toutes les semaines</em> ?</h2>
        <p class="lead">En garde partagée, Aurora ne posera les moments avec eux que les jours où tu les as.</p>
        <div class="stack"><button type="button" class="chip big" data-cm="always" aria-pressed="${d.custodyMode === 'always'}">Oui, toutes les semaines</button>
        <button type="button" class="chip big" data-cm="shared" aria-pressed="${d.custodyMode === 'shared'}">Garde partagée, en alternance sur deux semaines</button></div>`;
    case 'custodyGrid': {
      const mon = mondayOf(today()), cur = draftWeekType(d, mon);
      const grid = W => `<div class="card stack" style="padding:12px"><div class="row" style="justify-content:space-between"><b style="font-weight:600">Semaine ${W}</b>${cur === W ? '<span class="kv">cette semaine</span>' : '<span class="kv">semaine prochaine</span>'}</div>
        <div class="cgrid">${DAYS_L.map((dl, i) => `<span class="cgd">${dl}</span>${[0, 1].map(h => `<button type="button" class="chip" data-cg="${W}-${i}-${h}" aria-pressed="${d.custody.grid[W][i][h]}">${HALF[h]}</button>`).join('')}`).join('')}</div></div>`;
      return `<h2>Ton rythme de <em>garde</em></h2>
        <p class="lead">Cette semaine, du ${weekLabel(mon)}, c'est…</p>
        <div class="row"><button type="button" class="chip big" data-ab="A" aria-pressed="${cur === 'A'}">une semaine A</button><button type="button" class="chip big" data-ab="B" aria-pressed="${cur === 'B'}">une semaine B</button></div>
        <p class="lead" style="margin-top:14px">Coche les matins et les soirs où tu as tes enfants. Par exemple, si tu les récupères le vendredi soir et les déposes à l'école le lundi suivant : vendredi soir, samedi et dimanche matin et soir, puis lundi matin de l'autre semaine.</p>
        <div class="stack">${grid('A')}${grid('B')}</div>`;
    }
    case 'kidsTimes': {
      const kidRules = d.rules.filter(isKidsRule), shared = d.custodyMode === 'shared';
      return `<h2>Quels <em>moments fixes</em> avec eux ?</h2>
        <p class="lead">Touche ce qui existe chez toi, puis ajuste les jours et les heures. Ces moments seront posés automatiquement dans ton agenda${shared ? ', seulement les matins ou les soirs où tu as tes enfants' : ' chaque semaine'}.</p>
        <div class="row">${KID_PRESETS.map(p => `<button type="button" class="chip" data-kp="${p.key}" aria-pressed="${kidRules.some(r => r.preset === p.key)}">${p.title}</button>`).join('')}</div>
        <div class="stack" style="margin-top:14px">${kidRules.map(r => ruleEditor(r, d, { pickTheme: false, half: shared })).join('')}</div>
        <button class="link" type="button" data-addrule="enfants" style="margin-top:12px">+ Un autre moment avec les enfants</button>`;
    }
    case 'sport':
      return `<h2>Fais-tu du <em>sport</em>, ou bouges-tu régulièrement ?</h2>
        <p class="lead">Tout compte, même la marche. Touche ce que tu pratiques.</p>
        <div class="row">${[...new Set([...SPORTS, ...d.sports])].map(s => `<button type="button" class="chip" data-sp="${esc(s)}" aria-pressed="${d.sports.includes(s)}">${esc(s)}</button>`).join('')}</div>
        <div class="row" style="margin-top:12px;flex-wrap:nowrap"><input type="text" id="gSpOther" placeholder="Autre activité" style="flex:1;min-width:0"><button class="btn small" type="button" id="gSpAdd">Ajouter</button></div>
        <p class="lead" style="margin-top:12px">${d.sports.length ? '' : 'Pas de sport en ce moment ? Passe simplement à la suite.'}</p>`;
    case 'sportTimes': {
      return `<h2>Certains ont-ils un <em>horaire fixe</em> ?</h2>
        <p class="lead">Un cours le mardi soir, un footing le dimanche matin… Si rien n'est fixe, pas de souci : tu placeras tes séances quand tu veux.</p>
        <div class="stack">${d.sports.map(s => {
          const rs = d.rules.filter(r => r.sport === s);
          return `<div class="card stack" style="padding:12px"><div class="row" style="justify-content:space-between"><b style="font-weight:600">${esc(s)}</b><button class="link" type="button" data-addsport="${esc(s)}">${rs.length ? '+ un autre créneau' : '+ horaire fixe'}</button></div>
            ${rs.map(r => ruleEditor(r, d, { pickTheme: false, titleEditable: false })).join('')}</div>`;
        }).join('')}</div>`;
    }
    case 'fixed': {
      const other = d.rules.filter(r => !isKidsRule(r) && !r.sport);
      return `<h2>D'autres activités à <em>horaires fixes</em> ?</h2>
        <p class="lead">Un cours, une chorale, un rendez-vous chaque semaine, une permanence, un créneau que tu protèges… Tout ce qui revient au même moment.</p>
        <div class="stack">${other.map(r => ruleEditor(r, d)).join('') || '<p class="empty">Aucun pour l\'instant.</p>'}</div>
        <button class="btn ghost small" type="button" data-addrule="other" style="margin-top:12px">+ Ajouter une activité fixe</button>`;
    }
    case 'allFixed': {
      const shared = d.kids === true && d.custodyMode === 'shared';
      const kidsR = d.rules.filter(isKidsRule), sportR = d.rules.filter(r => r.sport && !isKidsRule(r)), otherR = d.rules.filter(r => !isKidsRule(r) && !r.sport);
      const group = (title, rules, opts, add) => `<h3>${title}</h3><div class="stack">${rules.map(r => ruleEditor(r, d, opts)).join('') || '<p class="empty" style="margin:0">Aucun.</p>'}</div>${add || ''}`;
      return `<h2>Mes <em>moments fixes</em></h2>
        <p class="lead">Ce qui revient au même moment chaque semaine. Tes changements s'appliquent aux jours à venir ; les journées déjà commencées ne bougent pas.</p>
        ${d.kids === true ? group('Avec les enfants' + (shared ? ' (selon ta garde)' : ''), kidsR, { pickTheme: false, half: shared }, '<button class="link" type="button" data-addrule="enfants" style="margin-top:10px">+ Un moment avec les enfants</button>') : ''}
        ${sportR.length ? group('Sport', sportR, { pickTheme: false, titleEditable: false }) : ''}
        ${group('Autres activités', otherR, {}, '<button class="link" type="button" data-addrule="other" style="margin-top:10px">+ Une activité fixe</button>')}`;
    }
    case 'themes':
      return `<h2>Tes <em>catégories</em></h2>
        <p class="lead">D'après tes réponses, voici les étiquettes de ton agenda. Renomme, change la couleur (touche la pastille), retire ou ajoute ce qui te ressemble.</p>
        <div class="stack">${d.themes.map(t => `<div class="trow" data-tid="${t.id}">
          <button type="button" class="tdot" data-tcol style="--c:var(${t.c})" aria-label="Changer la couleur de ${esc(t.name)}"></button>
          <input type="text" data-tname value="${esc(t.name)}" style="flex:1;min-width:0">
          ${t.id === 'bienetre' ? '<span class="tlock" title="Utilisée par le bouton Bien-être">❀</span>' : `<button type="button" class="iconbtn" data-tdel aria-label="Retirer ${esc(t.name)}" style="width:34px;height:34px;flex:none">✕</button>`}
        </div>`).join('')}</div>
        <div class="row" style="margin-top:12px;flex-wrap:nowrap"><input type="text" id="gThNew" placeholder="Nouvelle catégorie" style="flex:1;min-width:0"><button class="btn small" type="button" id="gThAdd">Ajouter</button></div>`;
    case 'prios':
      return `<h2>Qu'est-ce qui <em>compte le plus</em> en ce moment ?</h2>
        <p class="lead">Choisis jusqu'à 3 catégories. Ce seront tes priorités de la semaine ; tu pourras les changer chaque semaine, et chaque matin pour la journée.</p>
        <div class="row">${d.themes.map(t => `<button type="button" class="chip" data-gp="${t.id}" aria-pressed="${d.prios.includes(t.id)}"><span class="dot" style="--c:var(${t.c})"></span>${esc(t.name)}</button>`).join('')}</div>`;
    case 'wb':
      return `<h2>Tes petits moments qui <em>font du bien</em></h2>
        <p class="lead">Ils apparaîtront derrière le bouton Bien-être, pour les noter en un geste. Retire ceux qui ne te parlent pas, ajoute les tiens.</p>
        <div class="row">${d.wbTags.map((t, i) => `<span class="chip" aria-pressed="true">${esc(t.name)} <span style="color:var(--ivory-3);font-size:11px">${t.dur} min</span> <button type="button" data-wbdel="${i}" aria-label="Retirer ${esc(t.name)}" style="background:none;border:0;color:var(--coral);padding:0 0 0 4px">✕</button></span>`).join('')}</div>
        <div class="row" style="margin-top:12px;flex-wrap:nowrap"><input type="text" id="gWbNew" placeholder="Ex. thé au jardin" style="flex:2;min-width:0"><select id="gWbDur" style="flex:1;min-width:0">${WB_DURATIONS.map(x => `<option value="${x}">${x} min</option>`).join('')}</select><button class="btn small" type="button" id="gWbAdd">Ajouter</button></div>`;
    case 'recap': {
      const mon = mondayOf(today());
      const count = d.rules.reduce((n, r) => n + weekDates(mon).filter((dd, i) => r.days.includes(i) && dd >= today() && draftApplies(d, r, dd, i)).length, 0);
      const sec = (title, step, body) => `<div class="card stack"><div class="row" style="justify-content:space-between"><b style="font-weight:600">${title}</b><button class="link" type="button" data-jump="${step}">Modifier</button></div>${body}</div>`;
      const kidsRules = d.rules.filter(isKidsRule), sportRules = d.rules.filter(r => r.sport), other = d.rules.filter(r => !isKidsRule(r) && !r.sport);
      const custodyTxt = d.kids === true && d.custodyMode === 'shared' && d.custody ? `<b style="color:var(--ivory)">Garde partagée</b> (cette semaine est une semaine ${draftWeekType(d, mon)})<br>Semaine A : ${gridSummary(d.custody.grid.A)}<br>Semaine B : ${gridSummary(d.custody.grid.B)}<br>` : '';
      return `<p class="g-eyebrow">Conclusion</p><h2>Voici ce que j'ai <em>compris</em> de ton rythme</h2>
        <p class="lead">Vérifie avant de valider : c'est ce qui va organiser ton agenda.</p>
        <div class="stack">
        ${sec('Toi', 'name', `<p class="lead" style="margin:0">${d.name ? `Aurora t'appellera <b style="color:var(--ivory)">${esc(d.name)}</b>.` : 'Pas de prénom.'}</p>`)}
        ${sec('Les enfants', 'kids', `<p class="lead" style="margin:0">${d.kids === true ? custodyTxt + (kidsRules.length ? kidsRules.map(ruleLine).join('<br>') : 'Des enfants, sans moment fixe pour l\'instant.') : d.kids === false ? 'Pas d\'enfants à la maison.' : 'Non renseigné.'}</p>`)}
        ${sec('Le sport', 'sport', `<p class="lead" style="margin:0">${d.sports.length ? esc(d.sports.join(', ')) + (sportRules.length ? '<br>' + sportRules.map(ruleLine).join('<br>') : '<br>Sans horaire fixe.') : 'Pas de sport pour l\'instant.'}</p>`)}
        ${sec('Autres moments fixes', 'fixed', `<p class="lead" style="margin:0">${other.length ? other.map(r => `${ruleLine(r)} <span style="color:var(--ivory-3)">(${esc(themeName(d, r.theme))})</span>`).join('<br>') : 'Aucun.'}</p>`)}
        ${sec('Tes catégories', 'themes', `<div class="row">${d.themes.map(t => `<span class="chip" style="cursor:default"><span class="dot" style="--c:var(${t.c})"></span>${esc(t.name)}</span>`).join('')}</div>`)}
        ${sec('Tes priorités', 'prios', `<p class="lead" style="margin:0">${d.prios.length ? d.prios.map(id => esc(themeName(d, id))).join(', ') : 'Pas encore choisies.'}</p>`)}
        ${sec('Tes moments bien-être', 'wb', `<p class="lead" style="margin:0">${esc(d.wbTags.map(t => t.name).join(', ')) || 'Aucun.'}</p>`)}
        </div>
        <div class="card" style="margin-top:12px;border-color:rgb(255 230 109 / .4)"><p class="lead" style="margin:0">${d.rules.length ? `En validant, <b style="color:var(--ivory)">${count} moment${count > 1 ? 's' : ''} fixe${count > 1 ? 's' : ''}</b> ser${count > 1 ? 'ont' : 'a'} posé${count > 1 ? 's' : ''} dans ton agenda d'ici dimanche, puis chaque semaine. Tu pourras toujours les déplacer un par un.` : 'Aucun moment fixe à poser : ton agenda reste libre.'}</p></div>`;
    }
  }
  return '';
}

export function renderGuide() {
  const g = app.guide;
  if (!g) { startGuide(); return ''; }
  const steps = visible(g.d);
  g.step = Math.min(g.step, steps.length - 1);
  const id = steps[g.step].id;
  // Catégories proposées d'après les réponses, la première fois qu'on arrive sur l'étape
  if (id === 'themes' && !g.themesTuned) {
    g.themesTuned = true;
    const keep = t => !((t.id === 'enfants' && g.d.kids === false) || (t.id === 'sport' && !g.d.sports.length)) || g.used.includes(t.id);
    g.d.themes = g.d.themes.filter(keep);
  }
  const last = g.step === steps.length - 1;
  if (g.focus) {
    return `<div class="guide"><div class="gbody">${stepHTML(id, g.d, g)}</div>
      <div class="gnav"><button class="btn ghost small" type="button" id="gQuit">Annuler</button><button class="btn" type="button" id="gDone">Enregistrer</button></div></div>`;
  }
  return `<div class="guide">
    <div class="gprog" aria-label="Étape ${g.step + 1} sur ${steps.length}">${steps.map((s, i) => `<span class="${i < g.step ? 'done' : i === g.step ? 'cur' : ''}"></span>`).join('')}</div>
    <div class="gbody">${stepHTML(id, g.d, g)}</div>
    <div class="gnav">
      ${g.step > 0 ? '<button class="btn ghost small" type="button" id="gPrev">Retour</button>' : '<button class="btn ghost small" type="button" id="gQuit">Plus tard</button>'}
      ${last ? '<button class="btn" type="button" id="gDone">C\'est juste, je valide</button>' : `<button class="btn" type="button" id="gNext">${g.step === 0 ? 'Commencer' : 'Suivant'}</button>`}
    </div></div>`;
}

export function bindGuide(v) {
  const g = app.guide, d = g?.d;
  if (!g) return;
  const q = s => v.querySelector(s);
  const rerender = () => { render(); };
  const steps = visible(d);
  q('#gNext')?.addEventListener('click', () => { g.step++; rerender(); window.scrollTo(0, 0); });
  q('#gPrev')?.addEventListener('click', () => { g.step--; rerender(); window.scrollTo(0, 0); });
  q('#gQuit')?.addEventListener('click', () => { const back = g.returnTo; app.guide = null; go(back || 'accueil'); });
  q('#gDone')?.addEventListener('click', () => commit(d));
  v.querySelectorAll('[data-jump]').forEach(b => b.onclick = () => { g.step = visible(d).findIndex(s => s.id === b.dataset.jump); rerender(); window.scrollTo(0, 0); });

  // Prénom
  q('#gName')?.addEventListener('input', e => (d.name = e.target.value.trim()));
  // Enfants
  v.querySelectorAll('[data-kids]').forEach(b => b.onclick = () => {
    d.kids = b.dataset.kids === '1';
    if (!d.kids) { d.rules = d.rules.filter(r => !isKidsRule(r)); d.custodyMode = null; }
    else if (!d.custodyMode) d.custodyMode = 'always';
    rerender();
  });
  v.querySelectorAll('[data-cm]').forEach(b => b.onclick = () => {
    d.custodyMode = b.dataset.cm;
    if (d.custodyMode === 'shared' && !d.custody) d.custody = { refMonday: mondayOf(today()), grid: { A: emptyGrid(), B: emptyGrid() } };
    rerender();
  });
  v.querySelectorAll('[data-ab]').forEach(b => b.onclick = () => {
    const mon = mondayOf(today());
    d.custody.refMonday = b.dataset.ab === 'A' ? mon : addDays(mon, -7);
    rerender();
  });
  v.querySelectorAll('[data-cg]').forEach(b => b.onclick = () => {
    const [W, i, h] = b.dataset.cg.split('-');
    const cell = d.custody.grid[W][+i];
    cell[+h] = !cell[+h];
    b.setAttribute('aria-pressed', cell[+h]);
  });
  v.querySelectorAll('[data-kp]').forEach(b => b.onclick = () => {
    const p = KID_PRESETS.find(x => x.key === b.dataset.kp);
    const ex = d.rules.find(r => r.preset === p.key);
    if (ex) d.rules = d.rules.filter(r => r !== ex);
    else d.rules.push({ id: uid(), preset: p.key, kids: true, title: p.title, theme: 'enfants', days: [...p.days], start: p.start, end: p.end });
    rerender();
  });
  v.querySelectorAll('[data-addrule]').forEach(b => b.onclick = () => {
    const th = b.dataset.addrule === 'enfants' ? 'enfants' : (d.themes.find(t => t.id === 'travail') || d.themes[0]).id;
    d.rules.push({ id: uid(), kids: b.dataset.addrule === 'enfants', title: '', theme: th, days: [], start: 18 * 60, end: 19 * 60 });
    rerender();
  });
  // Sport
  v.querySelectorAll('[data-sp]').forEach(b => b.onclick = () => {
    const s = b.dataset.sp;
    if (d.sports.includes(s)) { d.sports = d.sports.filter(x => x !== s); d.rules = d.rules.filter(r => r.sport !== s); }
    else d.sports.push(s);
    rerender();
  });
  q('#gSpAdd')?.addEventListener('click', () => {
    const s = q('#gSpOther').value.trim().toLowerCase();
    if (s && !d.sports.includes(s)) { d.sports.push(s); rerender(); }
  });
  v.querySelectorAll('[data-addsport]').forEach(b => b.onclick = () => {
    const s = b.dataset.addsport;
    const th = d.themes.some(t => t.id === 'sport') ? 'sport' : d.themes[0].id;
    d.rules.push({ id: uid(), sport: s, title: s[0].toUpperCase() + s.slice(1), theme: th, days: [], start: 18 * 60, end: 19 * 60 });
    rerender();
  });
  // Éditeurs de moments fixes
  v.querySelectorAll('[data-rule]').forEach(el => {
    const r = d.rules.find(x => x.id === el.dataset.rule);
    el.querySelector('[data-rt]')?.addEventListener('input', e => (r.title = e.target.value));
    el.querySelector('[data-rth]')?.addEventListener('change', e => (r.theme = e.target.value));
    el.querySelectorAll('[data-rhalf]').forEach(c => c.onclick = () => { r.half = +c.dataset.rhalf; rerender(); });
    el.querySelector('[data-rdel]').onclick = () => { d.rules = d.rules.filter(x => x !== r); rerender(); };
    el.querySelectorAll('[data-rday]').forEach(c => c.onclick = () => {
      const i = +c.dataset.rday;
      r.days = r.days.includes(i) ? r.days.filter(x => x !== i) : [...r.days, i].sort();
      c.setAttribute('aria-pressed', r.days.includes(i));
    });
    onTime(el, 'ra-' + r.id, m => { const len = r.end - r.start; r.start = m; if (r.end <= m) { r.end = Math.min(H1 * 60, m + len); rerender(); } });
    onTime(el, 'rb-' + r.id, m => { if (m <= r.start) { toast('La fin doit être après le début'); rerender(); return; } r.end = m; });
  });
  // Catégories
  v.querySelectorAll('[data-tid]').forEach(row => {
    const t = d.themes.find(x => x.id === row.dataset.tid);
    row.querySelector('[data-tname]').addEventListener('input', e => (t.name = e.target.value));
    row.querySelector('[data-tcol]').onclick = () => { t.c = PALETTE[(PALETTE.indexOf(t.c) + 1) % PALETTE.length]; rerender(); };
    const del = row.querySelector('[data-tdel]');
    del && (del.onclick = () => {
      d.themes = d.themes.filter(x => x !== t);
      d.prios = d.prios.filter(x => x !== t.id);
      const fb = (d.themes.find(x => x.id === 'travail') || d.themes[0]).id;
      d.rules.forEach(r => { if (r.theme === t.id) r.theme = fb; });
      rerender();
    });
  });
  q('#gThAdd')?.addEventListener('click', () => {
    const n = q('#gThNew').value.trim();
    if (!n) return;
    const usedCols = d.themes.map(t => t.c);
    d.themes.splice(d.themes.length - 1, 0, { id: 'c-' + uid().slice(0, 8), name: n, c: PALETTE.find(c => !usedCols.includes(c)) || PALETTE[0] });
    rerender();
  });
  // Priorités
  v.querySelectorAll('[data-gp]').forEach(b => b.onclick = () => {
    const id = b.dataset.gp;
    if (d.prios.includes(id)) d.prios = d.prios.filter(x => x !== id);
    else { if (d.prios.length >= 3) { toast('3 priorités maximum'); return; } d.prios.push(id); }
    rerender();
  });
  // Bien-être
  v.querySelectorAll('[data-wbdel]').forEach(b => b.onclick = () => { d.wbTags.splice(+b.dataset.wbdel, 1); rerender(); });
  q('#gWbAdd')?.addEventListener('click', () => {
    const n = q('#gWbNew').value.trim();
    if (n) { d.wbTags.push({ name: n, dur: +q('#gWbDur').value }); rerender(); }
  });
}

function commit(d) {
  const rules = d.rules
    .filter(r => r.days.length && r.end > r.start)
    .map(r => ({ ...r, title: r.title.trim() || themeName(d, r.theme) }));
  const custody = d.kids === true && d.custodyMode === 'shared' ? d.custody : null;
  const custodyChanged = JSON.stringify(custody) !== JSON.stringify(S.profile.custody || null);
  S.profile = { done: app.guide?.focus ? S.profile.done : true, name: d.name, kids: d.kids, sports: d.sports, custody };
  S.themes = d.themes.map(t => ({ ...t, name: t.name.trim() || 'Sans nom' }));
  S.wbTags = d.wbTags;
  S.weekPrios[mondayOf(today())] = d.prios;
  replaceRecurring(rules, custodyChanged ? rules.filter(isKidsRule).map(r => r.id) : []);
  save();
  const focused = !!app.guide?.focus, back = app.guide?.returnTo;
  app.guide = null;
  const skipped = d.rules.length - rules.length;
  toast(skipped ? `C'est enregistré. ${skipped} moment${skipped > 1 ? 's' : ''} sans jour n'a pas été posé.` : focused ? 'Enregistré' : "C'est enregistré, ton agenda est prêt");
  if (focused) go(back || 'accueil');
  else go('plan', { planMode: 'semaine', weekStart: mondayOf(today()) });
}

// Planifier : le plan seul, en jour ou en semaine.
// Une fois la journée commencée, son plan est figé (pour comparer) : le vécu se note dans Ma journée.

import { app, render, go } from '../app.js';
import { S, save, isLocked, effectiveBlocks, planBlocks, theme, weekType, kidsPresent } from '../data/store.js';
import { weekday } from '../lib/time.js';
import { DAYS, DAYS_L, today, mondayOf, weekDates, addDays, dayNum, weekLabel } from '../lib/time.js';
import { esc } from '../lib/ui.js';
import { prioMirror, bindPrio } from './shared.js';
import { daySelectorHTML, bindDaySelector, timelineHTML, bindTimeline, editBlock } from './timeline.js';
import { quickLinksHTML, bindQuickLinks } from './guide.js';

export function renderPlan() {
  const date = app.selDate, monday = app.planMode === 'semaine' ? app.weekStart : mondayOf(date);
  let h = `<h2>Ce que je <em>prévois</em></h2>
  <div class="seg" role="group" aria-label="Vue" style="margin-top:12px"><button type="button" data-mode="jour" aria-pressed="${app.planMode === 'jour'}">Jour</button><button type="button" data-mode="semaine" aria-pressed="${app.planMode === 'semaine'}">Semaine</button></div>`;
  if (app.planMode === 'semaine') {
    h += `<div class="weeknav"><button type="button" data-wk="-1" aria-label="Semaine précédente">‹</button><span class="wl">Semaine du ${weekLabel(monday)}${weekType(monday) ? ` · <b class="wab">semaine ${weekType(monday)}</b>` : ''}</span><button type="button" data-wk="1" aria-label="Semaine suivante">›</button></div>
    <div style="margin-top:14px">${prioMirror('semaine', monday)}</div>
    <div class="week" style="margin-top:14px">` + weekDates(monday).map((d, i) => {
      const bl = planBlocks(d).sort((a, b) => a.start - b.start);
      return `<button type="button" class="wcol ${d === today() ? 'today' : ''}" data-wday="${d}" aria-label="Voir ${DAYS_L[i]} ${dayNum(d)}"><span class="wd">${DAYS[i]}<b>${dayNum(d)}</b>${weekType(monday) ? `<span class="kbar" title="Enfants avec toi"><i class="${kidsPresent(d, 0) ? 'on' : ''}"></i><i class="${kidsPresent(d, 1) ? 'on' : ''}"></i></span>` : ''}</span>${bl.map(b => `<span class="wkb ${b.theme === 'bienetre' ? 'pill' : ''}" style="--c:var(${theme(b.theme).c})">${esc(b.title)}</span>`).join('')}</button>`;
    }).join('') + `</div><p class="lead" style="margin-top:10px">Touche un jour pour l'ouvrir et déplacer ses blocs.</p>`;
    const ck = S.checklists[monday] || {};
    h += `<h3>Avant de planifier</h3><div class="card stack">
     <label class="row"><input type="checkbox" data-ck="agendas" ${ck.agendas ? 'checked' : ''}> Ai-je vérifié Outlook, Google Agenda, Calendly ?</label>
     <label class="row"><input type="checkbox" data-ck="dejeuners" ${ck.dejeuners ? 'checked' : ''}> Ai-je des déjeuners prévus cette semaine ?</label>
     <label class="row"><input type="checkbox" data-ck="contraintes" ${ck.contraintes ? 'checked' : ''}> Contraintes enfants, sport, dîners, courses posés ?</label></div>
     <h3>Mon paramétrage</h3>${quickLinksHTML()}`;
    return h;
  }
  const locked = isLocked(date);
  h += `<div style="margin-top:14px">${prioMirror('jour', date)}</div>${daySelectorHTML(date)}`;
  const wt = weekType(mondayOf(date));
  if (wt) {
    const m = kidsPresent(date, 0), s = kidsPresent(date, 1);
    h += `<p class="custline"><b class="wab">Semaine ${wt}</b> · ${m && s ? 'enfants avec toi le matin et le soir' : m ? 'enfants avec toi le matin' : s ? 'enfants avec toi le soir' : 'pas d\'enfants ce jour-là'}</p>`;
  }
  if (locked) {
    h += `<div class="card lockcard stack"><b style="font-weight:600">Cette journée a commencé : son plan est figé</b>
      <p class="lead" style="margin:0">Il reste tel que tu l'avais prévu, pour comparer. Ce qui change en vrai se note dans Ma journée. Touche un bloc pour dire s'il a été fait.</p>
      <div><button class="btn small" type="button" id="toJournee">Ouvrir Ma journée</button></div></div>`;
  }
  h += timelineHTML(date, 'plan');
  if (!locked) h += `<div class="row" style="margin-top:12px;justify-content:space-between"><span class="lead" style="margin:0">Glisse pour déplacer, tire le bas pour la durée</span><button class="btn small" type="button" data-act="add">+ Bloc</button></div>`;
  h += `<h3>Mon paramétrage</h3>${quickLinksHTML()}`;
  return h;
}

export function bindPlan(v) {
  v.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => {
    app.planMode = b.dataset.mode;
    if (app.planMode === 'semaine') app.weekStart = mondayOf(app.selDate);
    render();
  });
  v.querySelectorAll('[data-wday]').forEach(b => b.onclick = () => { app.selDate = b.dataset.wday; app.planMode = 'jour'; render(); });
  v.querySelectorAll('[data-wk]').forEach(b => b.onclick = () => { app.weekStart = addDays(app.weekStart, 7 * +b.dataset.wk); render(); });
  v.querySelectorAll('[data-ck]').forEach(c => c.onchange = () => { (S.checklists[app.weekStart] ??= {})[c.dataset.ck] = c.checked; save(); });
  v.querySelector('#toJournee')?.addEventListener('click', () => go('journee'));
  v.querySelector('[data-act="add"]')?.addEventListener('click', () => editBlock(null, 'plan'));
  bindPrio(v);
  bindQuickLinks(v);
  bindDaySelector(v);
  bindTimeline(v, app.selDate);
}

export { effectiveBlocks };

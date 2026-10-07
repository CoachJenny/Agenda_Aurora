// Ma journée vécue : le prévu et le réel côte à côte, les écarts, et ce qui a compté.

import { app, render } from '../app.js';
import { S, isLocked, lockDay, planBlocks, bodyOn } from '../data/store.js';
import { wordOf } from '../data/constants.js';
import { today } from '../lib/time.js';
import { esc, toast } from '../lib/ui.js';
import { impactRows, impactHTML, planDiffs, diffsHTML } from './shared.js';
import { daySelectorHTML, bindDaySelector, timelineHTML, bindTimeline, editBlock } from './timeline.js';
import { tasksHTML, bindTasks, placebarHTML } from './tasks.js';

export function renderJournee() {
  const date = app.selDate, locked = isLocked(date), plan = planBlocks(date);
  let h = `<h2>Ma journée <em>vécue</em></h2>${daySelectorHTML(date)}`;
  if (!locked) {
    if (date > today()) {
      h += `<div class="card"><p class="lead" style="margin:0">Cette journée n'a pas encore commencé. Son plan se prépare dans Planifier.</p></div>`;
    } else {
      h += `<div class="card lockcard stack"><b style="font-weight:600">${date === today() ? 'Ta journée commence ?' : 'Ce jour-là, que s\'est-il vraiment passé ?'}</b>
        <p class="lead" style="margin:0">${plan.length ? 'Ton plan sera figé tel quel pour comparer, et une colonne « Réel » s\'ouvrira à côté : c\'est là que tu noteras ce qui change.' : 'Rien n\'était prévu. Tu peux quand même noter ce qui s\'est passé.'}</p>
        <div><button class="btn small" type="button" id="lock">${date === today() ? 'Ma journée commence' : 'Noter le réel'}</button></div></div>`;
    }
  } else {
    const bd = bodyOn(date);
    if (bd) h += `<div class="bodyctx" style="margin-bottom:10px"><span class="dot" style="--c:var(--t-enfants)"></span>Mon corps en ce moment : ${esc(bd.tag)}</div>`;
    h += placebarHTML() + timelineHTML(date, 'cmp');
    h += `<div class="row" style="margin-top:12px;justify-content:space-between"><span class="lead" style="margin:0">Touche un créneau vide du réel pour ajouter. Appui long pour déplacer ou étirer.</span><button class="btn small" type="button" data-act="add">+ Réel</button></div>
      <p class="lead" style="margin:10px 0 0;font-size:12px">Au milieu, ton énergie, de <span style="color:#9B6FCF">vidée</span> à <span style="color:#FFE66D">pleine d'élan</span>. Touche un bloc prévu pour dire s'il a été fait et combien de temps il a pris.</p>`;
  }
  // Un résumé de trois lignes ; le détail se déplie à la demande.
  const imp = impactRows(date), diffs = locked ? planDiffs(date) : [];
  if (locked) {
    const plan = planBlocks(date), reviewed = plan.filter(p => p.status), done = plan.filter(p => p.status === 'fait' || p.status === 'partiel').length;
    const en = S.checkins.filter(c => c.date === date && !c.estimated && c.values.energie != null).map(c => c.values.energie);
    const lines = [
      reviewed.length ? `<b>${done}</b> bloc${done > 1 ? 's' : ''} fait${done > 1 ? 's' : ''} sur ${plan.length} prévu${plan.length > 1 ? 's' : ''}` : `${plan.length} bloc${plan.length > 1 ? 's' : ''} prévu${plan.length > 1 ? 's' : ''}, bilan à faire ce soir`,
      `<b>${imp.length}</b> moment${imp.length > 1 ? 's' : ''} qui ${imp.length > 1 ? 'ont' : 'a'} compté`,
      en.length ? `énergie de <b>${wordOf('energie', Math.min(...en))}</b> à <b>${wordOf('energie', Math.max(...en))}</b>` : 'pas encore de check-in d\'énergie'
    ];
    h += `<div class="card daysum">${lines.map(l => `<p>${l}</p>`).join('')}</div>`;
    h += `<details class="fold"><summary>Prévu → réel <span class="muted">${(k => k ? k + ' écart' + (k > 1 ? 's' : '') : 'pas d\'écart')(diffs.filter(x => x.kind !== 'ok').length)}</span></summary>${diffs.length ? `<div class="moments">${diffsHTML(diffs)}</div>` : ''}</details>`;
  }
  if (locked || imp.length) h += `<details class="fold"><summary>Ce qui a compté <span class="muted">${imp.length || 'rien de noté'}</span></summary>${imp.length ? `<div class="moments">${impactHTML(imp)}</div>` : '<p class="empty" style="margin:8px 0 0">Les check-ins et les boutons du bas nourrissent cette partie.</p>'}</details>`;
  if (locked) h += tasksHTML();
  return h;
}

export function bindJournee(v) {
  bindDaySelector(v);
  v.querySelector('#lock')?.addEventListener('click', () => { lockDay(app.selDate); render(); toast('Plan figé : note le réel ici'); });
  v.querySelector('[data-act="add"]')?.addEventListener('click', () => editBlock(null, 'real'));
  bindTimeline(v, app.selDate);
  bindTasks(v);
}

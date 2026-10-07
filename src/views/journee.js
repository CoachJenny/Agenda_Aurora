// Ma journée vécue : le prévu et le réel côte à côte, les écarts, et ce qui a compté.

import { app, render } from '../app.js';
import { isLocked, lockDay, planBlocks, bodyOn } from '../data/store.js';
import { today } from '../lib/time.js';
import { esc, toast } from '../lib/ui.js';
import { impactRows, impactHTML, planDiffs, diffsHTML } from './shared.js';
import { daySelectorHTML, bindDaySelector, timelineHTML, bindTimeline, editBlock } from './timeline.js';

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
    h += timelineHTML(date, 'cmp');
    h += `<div class="row" style="margin-top:12px;justify-content:space-between"><span class="lead" style="margin:0">Le réel se modifie : glisse, étire, touche.</span><button class="btn small" type="button" data-act="add">+ Réel</button></div>
      <p class="lead" style="margin:10px 0 0;font-size:12px">Au milieu, ton énergie, de <span style="color:#9B6FCF">vidée</span> à <span style="color:#FFE66D">pleine d'élan</span>. Touche un bloc prévu pour dire s'il a été fait et combien de temps il a pris.</p>`;
    const diffs = planDiffs(date);
    h += `<h3>Prévu → réel</h3>` + (diffs.length ? `<div class="card"><div class="moments" style="margin:0">${diffsHTML(diffs)}</div></div>` : `<p class="empty">Pas d'écart pour l'instant.</p>`);
  }
  const imp = impactRows(date);
  if (locked || imp.length) h += `<h3>Ce qui a compté</h3>` + (imp.length ? `<div class="card"><div class="moments" style="margin:0">${impactHTML(imp)}</div></div>` : `<p class="empty">Rien de marquant noté. Les check-ins et les boutons du bas nourrissent cette partie.</p>`);
  return h;
}

export function bindJournee(v) {
  bindDaySelector(v);
  v.querySelector('#lock')?.addEventListener('click', () => { lockDay(app.selDate); render(); toast('Plan figé : note le réel ici'); });
  v.querySelector('[data-act="add"]')?.addEventListener('click', () => editBlock(null, 'real'));
  bindTimeline(v, app.selDate);
}

// Mes tâches : une liste collée d'un coup, qui court de semaine en semaine.
// Toucher une tâche, puis l'heure dans l'agenda : elle devient un bloc (durée et catégorie au moment de la poser).
// La cocher sans la placer : on dit quand et combien de temps, et elle va dans le réel.

import { app, render, go } from '../app.js';
import { S, save, uid, removeById, addTasks, lockDay, themes } from '../data/store.js';
import { H1, hm, nowMin, today, addDays, longDate } from '../lib/time.js';
import { esc, openSheet, closeSheet, toast, timeField, readTime } from '../lib/ui.js';
import { durChips } from './timeline.js';

export function placebarHTML() {
  const t = app.placing && S.tasks.find(x => x.id === app.placing);
  if (!t) return '';
  return `<div class="placebar" role="status"><span>Touche l'heure voulue dans l'agenda pour placer <b>« ${esc(t.title)} »</b></span><button type="button" class="link" id="placeCancel">Annuler</button></div>`;
}

export function tasksHTML() {
  const list = S.tasks;
  return `<h3 id="tasksH">Mes tâches${list.length ? ` <span class="muted">${list.length}</span>` : ''}</h3>
  <div class="card stack tasks">
    ${list.length ? `<p class="lead" style="margin:0;font-size:13px">Touche une tâche pour la placer dans l'agenda. Coche-la si elle est déjà faite.</p>
    <ul class="tlist">${list.map(t => `<li class="${app.placing === t.id ? 'sel' : ''}">
      <button type="button" class="tck" data-tdone="${t.id}" aria-label="« ${esc(t.title)} » faite"></button>
      <button type="button" class="ttl" data-tplace="${t.id}">${esc(t.title)}</button>
      <button type="button" class="tdel" data-tdel="${t.id}" aria-label="Retirer « ${esc(t.title)} »">×</button></li>`).join('')}</ul>` : '<p class="lead" style="margin:0;font-size:13px">Colle ici ta liste de choses à faire, une par ligne. Elle reste d\'une semaine à l\'autre tant que tu ne la vides pas.</p>'}
    <textarea id="tIn" rows="2" placeholder="Une tâche par ligne. Ex. Pluxy : commander les titres"></textarea>
    <div><button class="btn small" type="button" id="tAdd">Ajouter</button></div>
  </div>`;
}

export function bindTasks(v) {
  const q = s => v.querySelector(s);
  q('#placeCancel')?.addEventListener('click', () => { app.placing = null; render(); });
  q('#tAdd')?.addEventListener('click', () => {
    const n = addTasks(q('#tIn').value);
    if (!n) { toast('Écris ou colle au moins une tâche'); return; }
    render(); toast(n > 1 ? `${n} tâches ajoutées` : 'Tâche ajoutée');
  });
  v.querySelectorAll('[data-tplace]').forEach(b => b.onclick = () => {
    const id = b.dataset.tplace;
    if (app.placing === id) { app.placing = null; render(); return; }
    app.placing = id;
    // En Planifier, une journée déjà commencée se complète dans Ma journée
    if (app.tab === 'plan' && S.locked[app.selDate]) { go('journee'); toast('Journée commencée : la tâche ira dans ton réel'); }
    else render();
    const tl = document.getElementById('tl');
    if (tl) {
      const m = app.selDate === today() ? nowMin() : 9 * 60;
      window.scrollTo({ top: Math.max(0, tl.getBoundingClientRect().top + window.scrollY + (m - +tl.dataset.from * 60) - 160), behavior: 'smooth' });
    }
  });
  v.querySelectorAll('[data-tdel]').forEach(b => b.onclick = () => {
    const t = S.tasks.find(x => x.id === b.dataset.tdel);
    const at = S.tasks.indexOf(t);
    removeById('tasks', t.id); if (app.placing === t.id) app.placing = null;
    save(); render(); toast(`« ${t.title} » retirée`);
    undoToast(() => { S.tasks.splice(at, 0, t); save(); render(); });
  });
  v.querySelectorAll('[data-tdone]').forEach(b => b.onclick = () => doneSheet(S.tasks.find(x => x.id === b.dataset.tdone)));
}

// Petit bouton « Annuler » sous le toast, quelques secondes
function undoToast(fn) {
  const el = document.getElementById('toast');
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'link undo'; btn.textContent = 'Annuler';
  btn.onclick = () => { fn(); el.hidden = true; };
  el.append(' ', btn);
}

// Cochée sans être placée : quand, combien de temps, quelle catégorie ; elle rejoint le réel de ce jour-là.
function doneSheet(t) {
  if (!t) return;
  const days = [0, 1, 2, 3, 4, 5, 6].map(i => addDays(today(), -i));
  let len = 15, th = null;
  const start0 = Math.max(7 * 60, Math.floor((nowMin() - len) / 5) * 5);
  openSheet(`<h4>« ${esc(t.title)} » : fait !</h4>
  <p class="lead" style="margin:0">Quand, et combien de temps ça a pris ? Ça s'ajoute à ta journée vécue.</p>
  <label class="f">Jour<select id="dD">${days.map((d, i) => `<option value="${d}">${i === 0 ? "Aujourd'hui" : i === 1 ? 'Hier' : longDate(d)}</option>`).join('')}</select></label>
  <label class="f">Commencé à${timeField('dS', start0)}</label>
  <div class="f">Durée${durChips(len)}</div>
  <div class="f">Catégorie, à choisir<div class="row" style="margin-top:6px">${themes().map(x => `<button type="button" class="chip" data-th="${x.id}" aria-pressed="false"><span class="dot" style="--c:var(${x.c})"></span>${esc(x.name)}</button>`).join('')}</div></div>
  <div class="row" style="justify-content:space-between"><button class="btn ghost small" type="button" id="dNo">Annuler</button><button class="btn" type="button" id="dOk">C'est fait</button></div>`, sh => {
    sh.querySelectorAll('[data-du]').forEach(c => c.onclick = () => { len = +c.dataset.du; sh.querySelectorAll('[data-du]').forEach(o => o.setAttribute('aria-pressed', o === c)); });
    sh.querySelectorAll('[data-th]').forEach(c => c.onclick = () => { th = c.dataset.th; sh.querySelectorAll('[data-th]').forEach(o => o.setAttribute('aria-pressed', o === c)); });
    sh.querySelector('#dNo').onclick = closeSheet;
    sh.querySelector('#dOk').onclick = () => {
      const s = readTime(sh, 'dS');
      if (isNaN(s)) { toast('Indique une heure'); return; }
      if (!th) { toast('Choisis une catégorie'); return; }
      const date = sh.querySelector('#dD').value;
      lockDay(date);
      S.blocks.push({ id: uid(), layer: 'real', task: true, date, start: s, end: Math.min(H1 * 60 + 59, s + len), theme: th, title: t.title, note: '', fixed: false });
      removeById('tasks', t.id);
      if (app.placing === t.id) app.placing = null;
      save(); closeSheet(); render(); toast(`Noté dans ta journée vécue, ${hm(s)}`);
    };
  });
}


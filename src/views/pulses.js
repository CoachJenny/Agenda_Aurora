// Les trois boutons toujours accessibles : flow, procrastination, bien-être.

import { render } from '../app.js';
import { S, save, uid, runningPulse } from '../data/store.js';
import { WB_DURATIONS } from '../data/constants.js';
import { H0, hm, dur, nowMin, today, r15 } from '../lib/time.js';
import { $, esc, openSheet, closeSheet, toast, timeField, readTime, onTime } from '../lib/ui.js';
import { startGuide } from './guide.js';

const NAMES = { flow: ['Flow', '✦'], procra: ['Procrastination', '◌'] };

export function renderPulse() {
  [['flow', 'pFlow'], ['procra', 'pProcra']].forEach(([t, id]) => {
    const [name, ic] = NAMES[t], r = runningPulse(t), el = $(id);
    el.classList.toggle('run', !!r);
    el.innerHTML = r ? `<span class="ic">${ic}</span>${name}<small>depuis ${hm(r.start)} · finir</small>` : `<span class="ic">${ic}</span>${name}`;
    el.setAttribute('aria-label', r ? `${name} en cours depuis ${hm(r.start)}, toucher pour terminer` : `Marquer ${name.toLowerCase()} maintenant`);
  });
}

function tapPulse(type) {
  const r = runningPulse(type);
  if (r) {
    r.end = Math.max(r.start + 1, nowMin());
    save(); render(); toast(`${NAMES[type][0]} terminé · ${dur(r.end - r.start)}`);
    return;
  }
  const p = { id: uid(), type, date: today(), start: nowMin(), end: null, note: '', feel: null };
  S.pulses.push(p); save(); render();
  pulseSheet(p, false);
}

const question = t => t === 'flow' ? "Qu'est-ce que tu étais en train de faire ?" : "Qu'est-ce que tu évitais, ou qu'est-ce qui a pris la place ?";

// Après un tap (p fourni) ou après coup (retro)
export function pulseSheet(p, retro) {
  let type = p?.type || 'flow', feel = p?.feel || null, other = false;
  const base = p ? p.start : nowMin();
  openSheet(`<h4>${retro ? 'Après coup' : `${NAMES[type][1]} ${NAMES[type][0]}, depuis ${hm(p.start)}`}</h4>
  ${retro
    ? `<div class="seg" role="group"><button type="button" data-pt="flow" aria-pressed="true">Flow</button><button type="button" data-pt="procra" aria-pressed="false">Procrastination</button></div>
       <div class="row"><label class="f" style="flex:1">De${timeField('pS', base - 90)}</label><label class="f" style="flex:1">À${timeField('pE', base - 30)}</label></div>`
    : `<div class="seg" role="group"><button type="button" data-tm="now" aria-pressed="true">En ce moment</button><button type="button" data-tm="other" aria-pressed="false">À un autre moment</button></div>
       <div class="row" id="pOther" hidden><label class="f" style="flex:1">De${timeField('pS', base - 60)}</label><label class="f" style="flex:1">À${timeField('pE', base - 30)}</label></div>
       <p class="lead" id="pHint" style="margin:0">Facultatif. Touche à nouveau le bouton pour terminer la plage.</p>`}
  <label class="f"><span id="pQt">${question(type)}</span><input type="text" id="pN" placeholder="Un mot suffit"></label>
  <div class="row" id="pFeel" ${type === 'flow' ? '' : 'hidden'}><button type="button" class="chip" data-f="ça m'a nourrie">ça m'a nourrie</button><button type="button" class="chip" data-f="ça m'a vidée">ça m'a vidée</button></div>
  <div class="row" style="justify-content:space-between"><button class="btn ghost small" type="button" id="pLater">${retro ? 'Annuler' : 'Plus tard'}</button><button class="btn" type="button" id="pOk">Enregistrer</button></div>`, sh => {
    const q = s => sh.querySelector(s);
    sh.querySelectorAll('[data-pt]').forEach(b => b.onclick = () => {
      type = b.dataset.pt;
      sh.querySelectorAll('[data-pt]').forEach(o => o.setAttribute('aria-pressed', o === b));
      q('#pQt').textContent = question(type); q('#pFeel').hidden = type !== 'flow';
    });
    sh.querySelectorAll('[data-tm]').forEach(b => b.onclick = () => {
      other = b.dataset.tm === 'other';
      sh.querySelectorAll('[data-tm]').forEach(o => o.setAttribute('aria-pressed', o === b));
      q('#pOther').hidden = !other; q('#pHint').hidden = other;
    });
    sh.querySelectorAll('[data-f]').forEach(c => c.onclick = () => { feel = c.dataset.f; sh.querySelectorAll('[data-f]').forEach(o => o.setAttribute('aria-pressed', o === c)); });
    q('#pLater').onclick = closeSheet;
    q('#pOk').onclick = () => {
      const note = q('#pN').value.trim();
      if (retro || other) {
        const s = readTime(sh, 'pS'), e = readTime(sh, 'pE');
        if (!(e > s)) { toast('La fin doit être après le début'); return; }
        if (retro) S.pulses.push({ id: uid(), type, date: today(), start: s, end: e, note, feel: type === 'flow' ? feel : null });
        else Object.assign(p, { start: s, end: e });
      }
      if (!retro) { p.note = note; if (feel) p.feel = feel; }
      save(); closeSheet(); render(); toast('Noté');
    };
  });
}

export function wbSheet() {
  let tag = null, d = null, when = 'now';
  const draw = () => {
    $('sheet').innerHTML = `<h4 style="color:var(--turq)">❀ Un moment bien-être</h4>
    <div class="row">${S.wbTags.map((t, i) => `<button type="button" class="chip" data-wt="${i}" aria-pressed="${tag === t.name}">${esc(t.name)} <span style="color:var(--ivory-3);font-size:11px">${t.dur} min</span></button>`).join('')}</div>
    <div class="row"><button class="link" type="button" id="wMan">Modifier mes activités (noms, durées)</button></div>
    <div class="f">Durée<div class="row" style="margin-top:6px">${WB_DURATIONS.map(x => `<button type="button" class="chip" data-wd="${x}" aria-pressed="${d === x}">${x} min</button>`).join('')}</div></div>
    <div class="seg" role="group"><button type="button" data-ww="now" aria-pressed="${when === 'now'}">Là, maintenant</button><button type="button" data-ww="t" aria-pressed="${when !== 'now'}">Plus tôt</button></div>
    ${when !== 'now' ? `<label class="f">À${timeField('wT', when)}</label>` : ''}
    <div class="row" style="justify-content:space-between"><button class="btn ghost small" type="button" id="wNo">Annuler</button><button class="btn" type="button" id="wOk" style="background:var(--turq);color:#052523;box-shadow:none">Enregistrer</button></div>`;
    const sh = $('sheet'), q = s => sh.querySelector(s);
    sh.querySelectorAll('[data-wt]').forEach(c => c.onclick = e => {
      const i = +c.dataset.wt;
      tag = S.wbTags[i].name; d = S.wbTags[i].dur; draw();
    });
    q('#wMan').onclick = () => { closeSheet(); startGuide('wb'); };
    sh.querySelectorAll('[data-wd]').forEach(c => c.onclick = () => { d = +c.dataset.wd; draw(); });
    sh.querySelectorAll('[data-ww]').forEach(c => c.onclick = () => { when = c.dataset.ww === 'now' ? 'now' : Math.max(H0 * 60, r15(nowMin() - 60)); draw(); });
    onTime(sh, 'wT', m => (when = m));
    q('#wNo').onclick = closeSheet;
    q('#wOk').onclick = () => {
      if (!tag) { toast('Choisis une activité'); return; }
      const start = when === 'now' ? nowMin() : when;
      S.wellbeing.push({ id: uid(), date: today(), start, tag, dur: d ?? 15 });
      save(); closeSheet(); render(); toast(`❀ ${tag} noté`);
    };
  };
  openSheet('', () => {}); draw();
}

export function initPulses() {
  $('pFlow').onclick = () => tapPulse('flow');
  $('pProcra').onclick = () => tapPulse('procra');
  $('pWb').onclick = wbSheet;
  setInterval(() => { if (runningPulse('flow') || runningPulse('procra')) renderPulse(); }, 60000);
}

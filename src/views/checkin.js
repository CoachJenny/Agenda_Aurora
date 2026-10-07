// Check-in : où j'en suis, à un moment ou sur une plage de la journée.

import { app, render, go } from '../app.js';
import { S, save, uid, onDate, bodyOn } from '../data/store.js';
import { SLIDERS, BODY, SOCIAL, wordOf, sliderName } from '../data/constants.js';
import { hm, nowMin, today, r15, addDays } from '../lib/time.js';
import { esc, openSheet, closeSheet, toast, timeField, onTime } from '../lib/ui.js';
import { momentRows, momentsHTML } from './shared.js';
import { pulseSheet } from './pulses.js';

export const newDraft = start => ({ when: start != null ? 'heure' : 'now', start: start != null ? r15(start) : nowMin(), end: null, values: {}, notes: {}, event: '', social: { modes: [], note: '' } });

export function renderCheckin() {
  app.draft ??= newDraft();
  const d = app.draft, bd = bodyOn(today());
  let h = `<h2>Où <em>j'en suis</em></h2><p class="lead">Ne bouge que ce qui bouge. Le reste reste éteint.</p>
  <div class="card stack"><b style="font-weight:600">Ça concerne…</b>
   <div class="seg" role="group"><button type="button" data-w="now" aria-pressed="${d.when === 'now'}">Maintenant</button><button type="button" data-w="heure" aria-pressed="${d.when === 'heure'}">Un moment</button><button type="button" data-w="plage" aria-pressed="${d.when === 'plage'}">Une plage</button></div>
   ${d.when !== 'now' ? `<div class="row"><label class="f" style="flex:1">${d.when === 'plage' ? 'De' : 'À'}${timeField('cS', d.start)}</label>${d.when === 'plage' ? `<label class="f" style="flex:1">À${timeField('cE', d.end ?? d.start + 60)}</label>` : ''}</div>` : ''}
  </div>
  <div class="card" style="margin-top:12px">` + SLIDERS.map(s => {
    const on = d.values[s.id] != null, w = on ? wordOf(s.id, d.values[s.id]) : 'pas touché';
    return `<div class="sl ${on ? 'on' : ''}" style="--hue:${s.hue};--from:${s.from}"><div class="lab"><b>${s.name}</b><span class="word">${w}</span></div>
    <input type="range" min="0" max="10" step="1" value="${on ? d.values[s.id] : 5}" id="r-${s.id}" aria-label="${s.name}, de ${s.l} à ${s.r}" aria-valuetext="${w}">
    <div class="poles"><span>${s.l}</span><span>${s.r}</span></div>
    ${on ? `<div class="pen"><input type="text" placeholder="✎ préciser, si tu veux" data-n="${s.id}" value="${esc(d.notes[s.id] || '')}"></div>` : ''}</div>`;
  }).join('') + `</div>
  <div class="card stack" style="margin-top:12px"><b style="font-weight:600">Y a-t-il eu un moment fort ou un événement ?</b>
   <input type="text" id="cEv" value="${esc(d.event)}" placeholder="Un mot suffit. Rien, c'est une réponse aussi."></div>
  <div class="card stack" style="margin-top:12px"><b style="font-weight:600">As-tu échangé avec quelqu'un ?</b>
   <div class="row">${SOCIAL.map(m => `<button type="button" class="chip" data-so="${m}" aria-pressed="${d.social.modes.includes(m)}">${m}</button>`).join('')}</div>
   <input type="text" id="cSo" value="${esc(d.social.note)}" placeholder="Avec qui, et comment c'était ? (facultatif)" ${d.social.modes.length && !d.social.modes.includes('personne') ? '' : 'hidden'}></div>
  <div class="row" style="margin-top:16px;justify-content:space-between"><button class="link" type="button" id="cBody">Mon corps en ce moment${bd ? ' : ' + esc(bd.tag) : ''}</button><button class="btn" type="button" id="cOk">Enregistrer</button></div>
  <h3>Aujourd'hui</h3>`;
  const list = onDate('checkins', today()).sort((a, b) => a.start - b.start);
  const rows = [
    ...list.map(c => ({ t: c.start, cls: 'ci', i: '•', tx: Object.entries(c.values).map(([k, v]) => `${sliderName(k).toLowerCase()} <em>${wordOf(k, v)}</em>`).join(', ') + (c.estimated ? ' <em>(reporté)</em>' : '') })).filter(r => r.tx),
    ...momentRows(today())
  ].sort((a, b) => a.t - b.t);
  h += rows.length ? `<div class="card"><div class="moments" style="margin:0">${momentsHTML(rows)}</div></div>` : `<p class="empty">Pas encore de check-in aujourd'hui.</p>`;
  h += `<button class="link" type="button" id="retro" style="margin-top:14px">Marquer un flow ou une procrastination après coup</button>`;
  return h;
}

export function bindCheckin(v) {
  const d = app.draft, q = s => v.querySelector(s);
  v.querySelectorAll('[data-w]').forEach(b => b.onclick = () => {
    d.when = b.dataset.w;
    d.start = d.when === 'now' ? nowMin() : r15(d.start);
    if (d.when === 'plage' && d.end == null) d.end = d.start + 60;
    render();
  });
  onTime(v, 'cS', m => (d.start = m));
  onTime(v, 'cE', m => (d.end = m));
  SLIDERS.forEach(s => {
    const r = q('#r-' + s.id);
    const upd = () => {
      const first = d.values[s.id] == null;
      d.values[s.id] = +r.value;
      const box = r.closest('.sl'), w = wordOf(s.id, +r.value);
      box.classList.add('on'); box.querySelector('.word').textContent = w; r.setAttribute('aria-valuetext', w);
      if (first) {
        const p = document.createElement('div');
        p.className = 'pen';
        p.innerHTML = `<input type="text" placeholder="✎ préciser, si tu veux" data-n="${s.id}">`;
        box.appendChild(p);
        p.firstChild.oninput = e => (d.notes[s.id] = e.target.value);
      }
    };
    r.addEventListener('input', upd);
    r.addEventListener('pointerdown', () => { if (d.values[s.id] == null) upd(); });
  });
  v.querySelectorAll('[data-n]').forEach(i => i.oninput = () => (d.notes[i.dataset.n] = i.value));
  q('#cEv').oninput = e => (d.event = e.target.value);
  v.querySelectorAll('[data-so]').forEach(b => b.onclick = () => {
    const m = b.dataset.so;
    let ms = d.social.modes;
    if (m === 'personne') ms = ms.includes('personne') ? [] : ['personne'];
    else { ms = ms.filter(x => x !== 'personne'); ms = ms.includes(m) ? ms.filter(x => x !== m) : [...ms, m]; }
    d.social.modes = ms;
    v.querySelectorAll('[data-so]').forEach(o => o.setAttribute('aria-pressed', ms.includes(o.dataset.so)));
    q('#cSo').hidden = !(ms.length && !ms.includes('personne'));
  });
  q('#cSo').oninput = e => (d.social.note = e.target.value);
  q('#cOk').onclick = () => {
    if (!Object.keys(d.values).length && !d.event.trim() && !d.social.modes.length) { toast('Bouge au moins un curseur, ou note un moment'); return; }
    const start = d.when === 'now' ? nowMin() : d.start;
    S.checkins.push({ id: uid(), date: today(), start, end: d.when === 'plage' ? d.end : null, values: { ...d.values }, notes: { ...d.notes }, event: d.event.trim(), social: { modes: [...d.social.modes], note: d.social.note.trim() }, estimated: false });
    save(); app.draft = null; toast('Check-in noté à ' + hm(start)); go('journee', { selDate: today() });
  };
  q('#cBody').onclick = editBody;
  q('#retro').onclick = () => pulseSheet(null, true);
}

function editBody() {
  // Plusieurs éléments possibles : on coche ce qui est là aujourd'hui, on décoche ce qui est passé.
  const active = () => S.body.filter(b => b.from <= today() && (!b.to || b.to >= today()));
  const sel = new Set(active().map(b => b.tag));
  let other = '';
  openSheet(`<h4>Mon corps en ce moment</h4><p class="lead" style="margin:0">Ce qui se passe dans ton corps ces jours-ci. Plusieurs choses à la fois, c'est possible. L'outil ne fait que le marquer.</p>
  <div class="row">${[...new Set([...BODY.filter(b => b !== 'autre'), ...sel])].map(b => `<button type="button" class="chip" data-b="${esc(b)}" aria-pressed="${sel.has(b)}">${esc(b)}</button>`).join('')}</div>
  <div class="row" style="flex-wrap:nowrap"><input type="text" id="bdOther" placeholder="Autre chose ? Un mot" style="flex:1;min-width:0"></div>
  <button class="btn" type="button" id="bdOk">Valider</button>`, sh => {
    sh.querySelectorAll('[data-b]').forEach(c => c.onclick = () => {
      const t = c.dataset.b;
      sel.has(t) ? sel.delete(t) : sel.add(t);
      c.setAttribute('aria-pressed', sel.has(t));
    });
    sh.querySelector('#bdOther').oninput = e => (other = e.target.value.trim());
    sh.querySelector('#bdOk').onclick = () => {
      if (other) sel.add(other);
      const now = active();
      // Terminé : ce qui n'est plus coché s'arrête hier (ou disparaît s'il avait commencé aujourd'hui)
      now.filter(b => !sel.has(b.tag)).forEach(b => {
        if (b.from === today()) S.body = S.body.filter(x => x !== b);
        else b.to = addDays(today(), -1);
      });
      // Nouveau : ce qui est coché et pas encore en cours commence aujourd'hui
      [...sel].filter(t => !now.some(b => b.tag === t)).forEach(tag => S.body.push({ id: uid(), tag, from: today(), to: null }));
      save(); closeSheet(); render();
    };
  });
}

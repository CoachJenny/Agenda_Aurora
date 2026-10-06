// Rituels : ouvrir la journée (matin) et la clore (soir).

import { app, render, go } from '../app.js';
import { S, save, uid, onDate, ritual } from '../data/store.js';
import { SLEEP, FACTORS, PRIO_HELD, wordOf, sliderName } from '../data/constants.js';
import { hm, nowMin, today, H0 } from '../lib/time.js';
import { esc, toast } from '../lib/ui.js';
import { prioMirror, bindPrio } from './shared.js';
import { newDraft } from './checkin.js';

export function renderRituels() {
  const r = ritual(today());
  let h = `<div class="seg" role="group" style="margin-top:14px"><button type="button" data-rm="matin" aria-pressed="${app.ritMode === 'matin'}">Matin · 1 min</button><button type="button" data-rm="soir" aria-pressed="${app.ritMode === 'soir'}">Soir · 3 min</button></div>`;
  if (app.ritMode === 'matin') {
    h += `<h2>Ouvrir <em>la journée</em></h2><div class="card stack">
     <label class="f">Un mot pour entrer dans cette journée<input type="text" id="mOpen" value="${esc(r.open || '')}" placeholder="un seul mot" style="font-family:var(--display);font-style:italic;font-size:18px"></label></div>
     <h3>La nuit</h3><div class="card"><div class="row">${SLEEP.map((t, i) => `<button type="button" class="chip" data-sl="${i + 1}" aria-pressed="${r.sleep === i + 1}">${t}</button>`).join('')}</div></div>
     <h3>Priorités du jour</h3>${prioMirror('jour', today())}
     <div class="card" style="margin-top:10px"><label class="row"><input type="checkbox" id="mAg" ${r.agenda ? 'checked' : ''}> Agenda vérifié</label></div>
     <button class="btn" type="button" id="mOk" style="margin-top:16px;width:100%">C'est parti</button>`;
    return h;
  }
  const last = onDate('checkins', today()).sort((a, b) => b.start - a.start)[0];
  h += `<h2>Clore <em>la journée</em></h2>`;
  if (r.open) h += `<p class="lead">Ce matin, tu es entrée avec <span class="word-big">${esc(r.open)}</span></p>`;
  h += `<div class="card stack">` + (last
    ? `<div><b style="font-weight:600">À ${hm(last.start)}, tu étais là :</b><div class="last">${Object.entries(last.values).map(([k, v]) => `<span class="kv">${sliderName(k).toLowerCase()} <b>${wordOf(k, v)}</b></span>`).join('') || '<span class="kv">un moment noté</span>'}</div></div>
       <b style="font-weight:600">Est-ce que ça a bougé depuis ?</b>
       <div class="row"><button class="btn small" type="button" id="sYes">Oui, à quelle heure ?</button>${Object.keys(last.values).length ? '<button class="btn ghost small" type="button" id="sNo">Non, c\'est resté pareil</button>' : ''}</div>`
    : `<p class="empty" style="margin:0">Pas de check-in aujourd'hui. Tu peux en faire un maintenant, sur toute la journée.</p><div><button class="btn small" type="button" id="sYes">Faire un check-in</button></div>`) + `</div>
  <h3>Les priorités</h3><div class="card stack"><b style="font-weight:600">Même si tout n'est pas fini, les priorités ont-elles été tenues ?</b>
   <div class="row">${PRIO_HELD.map(t => `<button type="button" class="chip" data-pr="${t}" aria-pressed="${r.prio === t}">${t}</button>`).join('')}</div>
   <b style="font-weight:600;margin-top:4px">Qu'est-ce qui a pris la place ?</b>
   <div class="row">${FACTORS.map(f => `<button type="button" class="chip" data-fa="${esc(f)}" aria-pressed="${(r.factors || []).includes(f)}">${esc(f)}</button>`).join('')}</div></div>
  <h3>Un mot pour sortir</h3><div class="card"><input type="text" id="sClose" value="${esc(r.close || '')}" placeholder="un seul mot" style="font-family:var(--display);font-style:italic;font-size:18px"></div>
  <h3>Debrief libre</h3><textarea id="sDeb" placeholder="Ce qui a envie d'être dit, ou rien.">${esc(r.debrief || '')}</textarea>
  <button class="btn" type="button" id="sOk" style="margin-top:16px;width:100%">Clore la journée</button>`;
  return h;
}

export function bindRituels(v) {
  const r = ritual(today()), q = s => v.querySelector(s);
  v.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { app.ritMode = b.dataset.rm; render(); });
  if (app.ritMode === 'matin') {
    v.querySelectorAll('[data-sl]').forEach(b => b.onclick = () => { r.sleep = +b.dataset.sl; save(); render(); });
    q('#mOpen').oninput = e => { r.open = e.target.value.trim(); save(); };
    q('#mAg').onchange = e => { r.agenda = e.target.checked; save(); };
    bindPrio(v);
    q('#mOk').onclick = () => { save(); toast(r.open ? `Belle entrée : « ${r.open} »` : 'Matin noté'); go('plan', { planMode: 'jour', selDate: today() }); };
    return;
  }
  q('#sYes').onclick = () => go('checkin', { draft: newDraft(Math.max(H0 * 60, nowMin() - 60)) });
  const no = q('#sNo');
  no && (no.onclick = () => {
    const last = onDate('checkins', today()).sort((a, b) => b.start - a.start)[0];
    S.checkins.push({ id: uid(), date: today(), start: Math.max(last.start + 30, nowMin()), end: null, values: { ...last.values }, notes: {}, event: '', social: { modes: [], note: '' }, estimated: true });
    save(); render(); toast("Reporté jusqu'à maintenant");
  });
  v.querySelectorAll('[data-pr]').forEach(b => b.onclick = () => { r.prio = b.dataset.pr; save(); render(); });
  v.querySelectorAll('[data-fa]').forEach(b => b.onclick = () => {
    const f = b.dataset.fa;
    r.factors = r.factors || [];
    r.factors = r.factors.includes(f) ? r.factors.filter(x => x !== f) : [...r.factors, f];
    save(); b.setAttribute('aria-pressed', r.factors.includes(f));
  });
  q('#sClose').oninput = e => { r.close = e.target.value.trim(); save(); };
  q('#sDeb').oninput = e => { r.debrief = e.target.value; save(); };
  q('#sOk').onclick = () => { save(); toast(r.close ? `Journée close sur « ${r.close} »` : 'Journée close'); go('accueil'); };
}

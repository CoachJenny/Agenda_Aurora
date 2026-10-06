// Facette Planifier : vue jour (blocs déplaçables, vécu superposable) et vue semaine.

import { app, render, go } from '../app.js';
import { S, save, uid, onDate, removeById, bodyOn } from '../data/store.js';
import { THEMES, theme, wordOf, socialText } from '../data/constants.js';
import { H0, H1, DAYS, DAYS_L, hm, nowMin, today, mondayOf, weekDates, addDays, dayNum, weekday, weekLabel, r15 } from '../lib/time.js';
import { esc, openSheet, closeSheet, toast, slotSel, energyCol } from '../lib/ui.js';
import { auroraGradient, prioMirror, bindPrio } from './shared.js';

const PXH = 60, PXM = PXH / 60;

function vecuLayer(date) {
  let h = '';
  const TOT = (H1 - H0) * PXH;
  const g = auroraGradient(date, 'energie', energyCol, '180deg');
  if (g) h += `<div class="aurora" style="right:calc(45% - 7px);top:0;height:${TOT}px;background:${g}"></div>`;
  onDate('pulses', date).forEach(p => {
    const e = p.end ?? nowMin();
    h += `<div class="${p.type === 'flow' ? 'aflow' : 'aprocra'}" style="right:calc(45% - 11px);top:${(p.start - H0 * 60) * PXM}px;height:${Math.max(14, (e - p.start) * PXM)}px"></div>`;
  });
  const items = [];
  onDate('checkins', date).forEach(c => {
    const parts = [];
    if (c.values.energie != null) parts.push('énergie ' + wordOf('energie', c.values.energie));
    if (c.values.emotion != null) parts.push(wordOf('emotion', c.values.emotion));
    if (parts.length) items.push({ t: c.start, cls: 'ci' + (c.estimated ? ' est' : ''), html: `<span class="sw2" style="background:${c.values.energie != null ? energyCol(c.values.energie) : 'var(--ivory-3)'}"></span><span class="tx">${esc(parts.join(' · '))}</span>` });
    if (c.event) items.push({ t: c.start + 1, cls: 'ev', html: `<i>✦</i><span class="tx">${esc(c.event)}</span>` });
    if (socialText(c.social)) items.push({ t: c.start + 2, cls: 'so', html: `<i>◍</i><span class="tx">${esc(socialText(c.social))}</span>` });
  });
  onDate('pulses', date).forEach(p => items.push({ t: p.start, cls: p.type === 'flow' ? 'flow' : 'procra', html: p.type === 'flow' ? `<i>✦</i><span class="tx">flow${p.note ? ' · ' + esc(p.note) : ''}</span>` : `<i>◌</i><span class="tx">procrastination${p.note ? ' · ' + esc(p.note) : ''}</span>` }));
  onDate('wellbeing', date).forEach(w => items.push({ t: w.start, cls: 'wb', html: `<i>❀</i><span class="tx">${esc(w.tag)} · ${w.dur} min</span>` }));
  items.sort((a, b) => a.t - b.t);
  let lastY = -99;
  items.forEach(it => {
    let y = (it.t - H0 * 60) * PXM;
    if (y < lastY + 26) y = lastY + 26;
    lastY = y;
    h += `<div class="note ${it.cls}" style="top:${y + 11}px;max-width:calc(45% - 22px)">${it.html}</div>`;
  });
  return h;
}

export function renderPlan() {
  const date = app.selDate, monday = app.planMode === 'semaine' ? app.weekStart : mondayOf(date);
  let h = `<h2>Ce que je <em>prévois</em></h2>
  <div class="seg" role="group" aria-label="Vue" style="margin-top:12px"><button type="button" data-mode="jour" aria-pressed="${app.planMode === 'jour'}">Jour</button><button type="button" data-mode="semaine" aria-pressed="${app.planMode === 'semaine'}">Semaine</button></div>`;
  if (app.planMode === 'semaine') {
    h += `<div class="weeknav"><button type="button" data-wk="-1" aria-label="Semaine précédente">‹</button><span class="wl">Semaine du ${weekLabel(monday)}</span><button type="button" data-wk="1" aria-label="Semaine suivante">›</button></div>
    <div style="margin-top:14px">${prioMirror('semaine', monday)}</div>
    <div class="week" style="margin-top:14px">` + weekDates(monday).map((d, i) => {
      const bl = onDate('blocks', d).sort((a, b) => a.start - b.start);
      return `<button type="button" class="wcol ${d === today() ? 'today' : ''}" data-date="${d}" aria-label="Voir ${DAYS_L[i]} ${dayNum(d)}"><span class="wd">${DAYS[i]}<b>${dayNum(d)}</b></span>${bl.map(b => `<span class="wkb ${b.theme === 'bienetre' ? 'pill' : ''}" style="--c:var(${theme(b.theme).c})">${esc(b.title)}</span>`).join('')}</button>`;
    }).join('') + `</div><p class="lead" style="margin-top:10px">Touche un jour pour l'ouvrir et déplacer ses blocs.</p>`;
    const ck = S.checklists[monday] || {};
    h += `<h3>Avant de planifier</h3><div class="card stack">
     <label class="row"><input type="checkbox" data-ck="agendas" ${ck.agendas ? 'checked' : ''}> Ai-je vérifié Outlook, Google Agenda, Calendly ?</label>
     <label class="row"><input type="checkbox" data-ck="dejeuners" ${ck.dejeuners ? 'checked' : ''}> Ai-je des déjeuners prévus cette semaine ?</label>
     <label class="row"><input type="checkbox" data-ck="contraintes" ${ck.contraintes ? 'checked' : ''}> Contraintes enfants, sport, dîners, courses posés ?</label></div>`;
    return h;
  }
  const mon = mondayOf(date);
  h += `<div style="margin-top:14px">${prioMirror('jour', date)}</div>
  <div class="dayhead"><div class="days"><button type="button" data-shift="-7" aria-label="Semaine précédente" style="min-width:28px">‹</button>${weekDates(mon).map((d, i) => `<button type="button" data-date="${d}" aria-pressed="${d === date}" class="${d === today() ? 'today' : ''}">${DAYS[i]}<b>${dayNum(d)}</b></button>`).join('')}<button type="button" data-shift="7" aria-label="Semaine suivante" style="min-width:28px">›</button></div>
  <button class="toggle" type="button" id="vecu" aria-pressed="${app.showVecu}"><span class="sw"></span>Voir mon vécu</button></div>`;
  const bd = bodyOn(date);
  if (bd && app.showVecu) h += `<div class="bodyctx" style="margin-bottom:10px"><span class="dot" style="--c:var(--t-enfants)"></span>Mon corps en ce moment : ${esc(bd.tag)}</div>`;
  h += `<div class="timeline" id="tl" style="height:${(H1 - H0) * PXH + 8}px">`;
  for (let x = H0; x < H1; x++) h += `<div class="hour" style="top:${(x - H0) * PXH}px"><span>${x}h</span></div>`;
  onDate('blocks', date).forEach(b => {
    const top = (b.start - H0 * 60) * PXM, ht = Math.max(22, (b.end - b.start) * PXM - 3);
    h += `<div class="block ${b.theme === 'bienetre' ? 'wb' : ''}" data-id="${b.id}" tabindex="0" role="button" aria-label="${esc(b.title)}, ${hm(b.start)} à ${hm(b.end)}" style="--c:var(${theme(b.theme).c});top:${top + 1}px;height:${ht}px;right:${app.showVecu ? 'calc(45% + 12px)' : '8px'}">
    ${b.fixed ? '<span class="lk" title="Bloc fixe">fixe</span>' : ''}<div class="t">${b.theme === 'bienetre' ? '❀ ' : ''}${esc(b.title)}</div>${ht > 36 ? `<div class="n">${hm(b.start)}–${hm(b.end)}${b.note ? ' · ' + esc(b.note) : ''}</div>` : ''}</div>`;
  });
  if (app.showVecu) h += vecuLayer(date);
  if (date === today()) { const m = nowMin(); if (m > H0 * 60 && m < H1 * 60) h += `<div class="nowline" style="top:${(m - H0 * 60) * PXM}px"></div>`; }
  h += `</div><div class="row" style="margin-top:12px;justify-content:space-between"><span class="lead" style="margin:0">Glisse pour déplacer, touche pour enrichir</span><button class="btn small" type="button" data-act="add">+ Bloc</button></div>`;
  if (app.showVecu) h += `<div class="keyline"><span>énergie<span class="grad"></span></span><span style="color:var(--coral)">✦ flow</span><span>◌ procrastination</span><span style="color:var(--turq)">❀ bien-être</span><span style="color:var(--gold)">✦ moment fort</span><span style="color:var(--violet)">◍ échange</span></div>`;
  return h;
}

export function bindPlan(v) {
  v.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => {
    app.planMode = b.dataset.mode;
    if (app.planMode === 'semaine') app.weekStart = mondayOf(app.selDate);
    render();
  });
  v.querySelectorAll('[data-date]').forEach(b => { if (!b.dataset.act) b.onclick = () => { app.selDate = b.dataset.date; app.planMode = 'jour'; render(); }; });
  v.querySelectorAll('[data-shift]').forEach(b => b.onclick = () => { app.selDate = addDays(app.selDate, +b.dataset.shift); render(); });
  v.querySelectorAll('[data-wk]').forEach(b => b.onclick = () => { app.weekStart = addDays(app.weekStart, 7 * +b.dataset.wk); render(); });
  v.querySelectorAll('[data-ck]').forEach(c => c.onchange = () => { (S.checklists[app.weekStart] ??= {})[c.dataset.ck] = c.checked; save(); });
  const vc = v.querySelector('#vecu'); vc && (vc.onclick = () => { app.showVecu = !app.showVecu; render(); });
  v.querySelector('[data-act="add"]')?.addEventListener('click', () => editBlock(null));
  bindPrio(v);
  v.querySelectorAll('.block').forEach(el => {
    const b = S.blocks.find(x => x.id === el.dataset.id);
    let sy = 0, moved = false, orig = 0, active = false;
    el.addEventListener('pointerdown', e => { active = true; moved = false; sy = e.clientY; orig = b.start; el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointermove', e => {
      if (!active) return;
      const dy = e.clientY - sy;
      if (Math.abs(dy) > 5) moved = true;
      if (!moved || b.fixed) return;
      el.classList.add('dragging');
      const len = b.end - b.start;
      let ns = Math.round((orig + dy / PXM) / 15) * 15;
      ns = Math.max(H0 * 60, Math.min(H1 * 60 - len, ns));
      el.style.top = ((ns - H0 * 60) * PXM + 1) + 'px';
      el.dataset.ns = ns;
    });
    el.addEventListener('pointerup', () => {
      if (!active) return;
      active = false; el.classList.remove('dragging');
      if (!moved) { editBlock(b); return; }
      if (b.fixed) { toast('Bloc fixe : il ne bouge pas'); return; }
      const ns = +el.dataset.ns;
      if (!isNaN(ns) && ns !== b.start) { const len = b.end - b.start; b.start = ns; b.end = ns + len; save(); render(); toast(`${b.title} déplacé à ${hm(ns)}`); }
    });
    el.addEventListener('pointercancel', () => { active = false; el.classList.remove('dragging'); render(); });
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); editBlock(b); } });
  });
}

export function scrollToNow() {
  const tl = document.getElementById('tl');
  if (!tl || app.selDate !== today()) return;
  const m = nowMin();
  if (m > H0 * 60) window.scrollTo({ top: Math.max(0, tl.offsetTop + (m - H0 * 60 - 90) * PXM), behavior: 'instant' });
}

function editBlock(b) {
  const isNew = !b;
  const x = b ? { ...b } : { date: app.selDate, start: Math.min(21 * 60, Math.max(H0 * 60, r15(nowMin() + 15))), end: 0, theme: 'travail', title: '', note: '', fixed: false };
  if (isNew) x.end = x.start + 60;
  const mon = mondayOf(x.date);
  openSheet(`<h4>${isNew ? 'Nouveau bloc' : 'Enrichir le bloc'}</h4>
  <label class="f">Titre<input type="text" id="bT" value="${esc(x.title)}" placeholder="Ex. Appel découverte"></label>
  <div class="f">Étiquette<div class="row" style="margin-top:6px">${THEMES.map(t => `<button type="button" class="chip" data-th="${t.id}" aria-pressed="${t.id === x.theme}"><span class="dot" style="--c:var(${t.c})"></span>${t.name}</button>`).join('')}</div></div>
  <div class="row"><label class="f" style="flex:1">Début${slotSel('bS', x.start)}</label><label class="f" style="flex:1">Fin${slotSel('bE', x.end)}</label></div>
  <label class="f">Jour<select id="bD">${weekDates(mon).map((d, i) => `<option value="${d}" ${d === x.date ? 'selected' : ''}>${DAYS_L[i]} ${dayNum(d)}</option>`).join('')}</select></label>
  <label class="f">Commentaire, visible dans le bloc<input type="text" id="bN" value="${esc(x.note)}" placeholder="Ex. relancer 2 factures"></label>
  <label class="row"><input type="checkbox" id="bF" ${x.fixed ? 'checked' : ''}> Bloc fixe (ne se déplace pas)</label>
  <div class="row" style="justify-content:space-between">${isNew ? '<span></span>' : '<button class="btn ghost small" type="button" id="bDel">Supprimer</button>'}<button class="btn" type="button" id="bOk">Enregistrer</button></div>`, sh => {
    let th = x.theme;
    sh.querySelectorAll('[data-th]').forEach(c => c.onclick = () => { th = c.dataset.th; sh.querySelectorAll('[data-th]').forEach(o => o.setAttribute('aria-pressed', o === c)); });
    sh.querySelector('#bOk').onclick = () => {
      const s = +sh.querySelector('#bS').value, e = +sh.querySelector('#bE').value;
      if (e <= s) { toast('La fin doit être après le début'); return; }
      const rec = { title: sh.querySelector('#bT').value.trim() || theme(th).name, theme: th, start: s, end: e, date: sh.querySelector('#bD').value, note: sh.querySelector('#bN').value.trim(), fixed: sh.querySelector('#bF').checked };
      if (isNew) S.blocks.push({ id: uid(), ...rec }); else Object.assign(b, rec);
      save(); closeSheet(); render(); toast(isNew ? 'Bloc ajouté' : 'Bloc mis à jour');
    };
    const del = sh.querySelector('#bDel');
    del && (del.onclick = () => { removeById('blocks', b.id); save(); closeSheet(); render(); toast('Bloc supprimé'); });
  });
}

export { go };

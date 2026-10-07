// Facette Planifier.
// Avant le début de la journée : une seule colonne, le plan, modifiable.
// Une fois la journée commencée (plan figé) : deux colonnes, Prévu (intact) et Réel (modifiable),
// séparées par le ruban d'énergie, avec en dessous les écarts et ce qui a compté.

import { app, render } from '../app.js';
import { S, save, uid, onDate, removeById, bodyOn, isLocked, lockDay, planBlocks, realBlocks, effectiveBlocks, setStatus, setReplacement } from '../data/store.js';
import { THEMES, theme } from '../data/constants.js';
import { H0, H1, DAYS, DAYS_L, hm, nowMin, today, mondayOf, weekDates, addDays, dayNum, weekLabel, r15 } from '../lib/time.js';
import { esc, openSheet, closeSheet, toast, timeField, readTime, energyCol } from '../lib/ui.js';
import { auroraGradient, prioMirror, bindPrio, impactRows, impactHTML, planDiffs, diffsHTML } from './shared.js';

const PXM = 1;            // 1 px par minute
const STATUS = { fait: ['✓', 'fait'], partiel: ['◐', 'en partie'], non: ['✕', 'pas fait'], remplace: ['↷', 'remplacé'] };

function blockHTML(b, { top0, cls, interactive }) {
  const top = top0 + (b.start - H0 * 60) * PXM, ht = Math.max(22, (b.end - b.start) * PXM - 3);
  const st = b.status && STATUS[b.status];
  const label = b.status === 'remplace' && b.replacedBy ? `${esc(b.title)} → ${esc(b.replacedBy)}` : esc(b.title);
  return `<div class="block ${cls} ${b.theme === 'bienetre' ? 'wb' : ''} ${b.status ? 'st-' + b.status : ''}" data-id="${b.id}" ${interactive ? 'data-edit' : 'data-ghost'} tabindex="0" role="button"
    aria-label="${esc(b.title)}, ${hm(b.start)} à ${hm(b.end)}${st ? ', ' + st[1] : ''}" style="--c:var(${theme(b.theme).c});top:${top + 1}px;height:${ht}px">
    ${st ? `<span class="stb" title="${st[1]}">${st[0]}</span>` : b.fixed ? '<span class="lk" title="Bloc fixe">fixe</span>' : ''}
    <div class="t">${b.theme === 'bienetre' ? '❀ ' : ''}${label}</div>${ht > 36 ? `<div class="n">${hm(b.start)}–${hm(b.end)}${b.note ? ' · ' + esc(b.note) : ''}</div>` : ''}
    ${interactive && !b.fixed ? '<span class="rs" aria-hidden="true"></span>' : ''}</div>`;
}

// Repères sur le ruban : une icône par chose qui a compté (toucher pour lire)
function markersHTML(date, top0) {
  let h = '', lastY = -99;
  impactRows(date).forEach((m, i) => {
    let y = top0 + (m.t - H0 * 60) * PXM;
    if (y < lastY + 21) y = lastY + 21;
    lastY = y;
    h += `<button type="button" class="mk" data-mk="${i}" style="top:${y}px;--mc:${m.hue}" aria-label="${hm(m.t)} : ${esc(m.plain)}">${m.i}</button>`;
  });
  return h;
}

function dayView(date) {
  const locked = isLocked(date), plan = planBlocks(date);
  const top0 = locked ? 30 : 0;
  const H = (H1 - H0) * 60 * PXM + 8 + top0;
  let h = '';
  const isToday = date === today(), past = date < today();
  if (!locked && (isToday || (past && plan.length))) {
    h += `<div class="card lockcard stack"><b style="font-weight:600">${isToday ? 'Ta journée commence ?' : 'Ce jour-là, que s\'est-il vraiment passé ?'}</b>
      <p class="lead" style="margin:0">Fige ton plan : il restera intact pour comparer, et les changements de la journée iront dans une colonne « Réel ».</p>
      <div><button class="btn small" type="button" id="lock">${isToday ? 'Ma journée commence' : 'Noter le réel'}</button></div></div>`;
  }
  const bd = bodyOn(date);
  if (bd && locked) h += `<div class="bodyctx" style="margin-bottom:10px"><span class="dot" style="--c:var(--t-enfants)"></span>Mon corps en ce moment : ${esc(bd.tag)}</div>`;
  h += `<div class="timeline ${locked ? 'cmp' : ''}" id="tl" style="height:${H}px">`;
  if (locked) h += `<div class="colhead plan">Prévu</div><div class="colhead real">Réel</div>`;
  for (let x = H0; x < H1; x++) h += `<div class="hour" style="top:${top0 + (x - H0) * 60 * PXM}px"><span>${x}h</span></div>`;
  if (locked) {
    const g = auroraGradient(date, 'energie', energyCol, '180deg');
    h += `<div class="rib" style="top:${top0}px;height:${H - top0 - 8}px;${g ? `background:${g}` : ''}"></div>`;
    plan.forEach(b => (h += blockHTML(b, { top0, cls: 'ghost', interactive: false })));
    realBlocks(date).forEach(b => (h += blockHTML(b, { top0, cls: 'real', interactive: true })));
    h += markersHTML(date, top0);
  } else {
    plan.forEach(b => (h += blockHTML(b, { top0, cls: '', interactive: true })));
  }
  if (isToday) { const m = nowMin(); if (m > H0 * 60 && m < H1 * 60) h += `<div class="nowline" style="top:${top0 + (m - H0 * 60) * PXM}px"></div>`; }
  h += `</div><div class="row" style="margin-top:12px;justify-content:space-between"><span class="lead" style="margin:0">${locked ? 'Le réel se modifie : glisse, étire, touche.' : 'Glisse pour déplacer, tire le bas pour la durée'}</span><button class="btn small" type="button" data-act="add">+ Bloc</button></div>`;
  if (locked) {
    h += `<p class="lead" style="margin:10px 0 0;font-size:12px">Ruban : ton énergie, de <span style="color:#9B6FCF">vidée</span> à <span style="color:#FFE66D">pleine d'élan</span>. Touche un bloc prévu pour dire s'il a été fait.</p>`;
    const diffs = planDiffs(date);
    h += `<h3>Prévu → réel</h3>` + (diffs.length ? `<div class="card"><div class="moments" style="margin:0">${diffsHTML(diffs)}</div></div>` : `<p class="empty">Pas d'écart pour l'instant.</p>`);
    const imp = impactRows(date);
    h += `<h3>Ce qui a compté</h3>` + (imp.length ? `<div class="card"><div class="moments" style="margin:0">${impactHTML(imp)}</div></div>` : `<p class="empty">Rien de marquant noté. Les check-ins et les boutons du bas nourrissent cette partie.</p>`);
  }
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
      const bl = effectiveBlocks(d).sort((a, b) => a.start - b.start);
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
  <div class="dayhead"><div class="days"><button type="button" data-shift="-7" aria-label="Semaine précédente" style="min-width:28px">‹</button>${weekDates(mon).map((d, i) => `<button type="button" data-date="${d}" aria-pressed="${d === date}" class="${d === today() ? 'today' : ''}">${DAYS[i]}<b>${dayNum(d)}</b></button>`).join('')}<button type="button" data-shift="7" aria-label="Semaine suivante" style="min-width:28px">›</button></div></div>`;
  return h + dayView(date);
}

export function bindPlan(v) {
  v.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => {
    app.planMode = b.dataset.mode;
    if (app.planMode === 'semaine') app.weekStart = mondayOf(app.selDate);
    render();
  });
  v.querySelectorAll('[data-date]').forEach(b => { b.onclick = () => { app.selDate = b.dataset.date; app.planMode = 'jour'; render(); }; });
  v.querySelectorAll('[data-shift]').forEach(b => b.onclick = () => { app.selDate = addDays(app.selDate, +b.dataset.shift); render(); });
  v.querySelectorAll('[data-wk]').forEach(b => b.onclick = () => { app.weekStart = addDays(app.weekStart, 7 * +b.dataset.wk); render(); });
  v.querySelectorAll('[data-ck]').forEach(c => c.onchange = () => { (S.checklists[app.weekStart] ??= {})[c.dataset.ck] = c.checked; save(); });
  v.querySelector('#lock')?.addEventListener('click', () => { lockDay(app.selDate); render(); toast('Plan figé : les changements vont maintenant dans le réel'); });
  v.querySelector('[data-act="add"]')?.addEventListener('click', () => editBlock(null, isLocked(app.selDate) ? 'real' : 'plan'));
  bindPrio(v);
  const rows = impactRows(app.selDate);
  v.querySelectorAll('[data-mk]').forEach(m => m.onclick = () => { const r = rows[+m.dataset.mk]; toast(`${hm(r.t)} · ${r.plain}`); });
  v.querySelectorAll('[data-ghost]').forEach(el => {
    const open = () => statusSheet(S.blocks.find(x => x.id === el.dataset.id));
    el.onclick = open;
    el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } };
  });
  bindDrag(v);
}

// Déplacer (glisser le bloc) ou changer la durée (tirer la poignée du bas), par pas de 15 minutes
function bindDrag(v) {
  v.querySelectorAll('[data-edit]').forEach(el => {
    const b = S.blocks.find(x => x.id === el.dataset.id);
    let sy = 0, moved = false, active = false, mode = 'move', s0 = 0, e0 = 0;
    el.addEventListener('pointerdown', e => {
      active = true; moved = false; sy = e.clientY; s0 = b.start; e0 = b.end;
      mode = e.target.closest('.rs') ? 'resize' : 'move';
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', e => {
      if (!active) return;
      const dy = e.clientY - sy;
      if (Math.abs(dy) > 5) moved = true;
      if (!moved || b.fixed) return;
      el.classList.add('dragging');
      if (mode === 'resize') {
        let ne = Math.round((e0 + dy / PXM) / 15) * 15;
        ne = Math.max(b.start + 15, Math.min(H1 * 60, ne));
        el.style.height = ((ne - b.start) * PXM - 3) + 'px';
        el.dataset.ne = ne;
      } else {
        const len = b.end - b.start;
        let ns = Math.round((s0 + dy / PXM) / 15) * 15;
        ns = Math.max(H0 * 60, Math.min(H1 * 60 - len, ns));
        el.style.transform = `translateY(${(ns - s0) * PXM}px)`;
        el.dataset.ns = ns;
      }
    });
    el.addEventListener('pointerup', () => {
      if (!active) return;
      active = false; el.classList.remove('dragging');
      if (!moved) { if (mode === 'move') editBlock(b, b.layer); return; }
      if (b.fixed) { toast('Bloc fixe : il ne bouge pas'); return; }
      if (mode === 'resize') {
        const ne = +el.dataset.ne;
        if (!isNaN(ne) && ne !== b.end) { b.end = ne; save(); render(); toast(`${b.title} : ${hm(b.start)}–${hm(b.end)}`); }
      } else {
        const ns = +el.dataset.ns;
        if (!isNaN(ns) && ns !== b.start) { const len = b.end - b.start; b.start = ns; b.end = ns + len; save(); render(); toast(`${b.title} déplacé à ${hm(ns)}`); }
        else el.style.transform = '';
      }
    });
    el.addEventListener('pointercancel', () => { active = false; el.classList.remove('dragging'); render(); });
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); editBlock(b, b.layer); } });
  });
}

export function scrollToNow() {
  const tl = document.getElementById('tl');
  if (!tl || app.selDate !== today()) return;
  const m = nowMin();
  if (m > H0 * 60) window.scrollTo({ top: Math.max(0, tl.offsetTop + (m - H0 * 60 - 90) * PXM), behavior: 'instant' });
}

// Bloc prévu, une fois la journée commencée : a-t-il été fait ?
export function statusSheet(p) {
  if (!p) return;
  openSheet(`<h4>${esc(p.title)}</h4><p class="lead" style="margin:0">Prévu ${hm(p.start)}–${hm(p.end)}. Et en vrai ?</p>
  <div class="row">${Object.entries(STATUS).map(([k, [ic, l]]) => `<button type="button" class="chip" data-st="${k}" aria-pressed="${p.status === k}">${ic} ${l}</button>`).join('')}</div>
  <label class="f" id="repl" ${p.status === 'remplace' ? '' : 'hidden'}>Remplacé par quoi ?<input type="text" id="replIn" value="${esc(p.replacedBy || '')}" placeholder="Ex. relances mails"></label>
  <button class="btn" type="button" id="stOk">OK</button>`, sh => {
    sh.querySelectorAll('[data-st]').forEach(c => c.onclick = () => {
      setStatus(p, c.dataset.st);
      sh.querySelectorAll('[data-st]').forEach(o => o.setAttribute('aria-pressed', p.status === o.dataset.st));
      sh.querySelector('#repl').hidden = p.status !== 'remplace';
      render();
    });
    sh.querySelector('#replIn').oninput = e => { setReplacement(p, e.target.value.trim()); };
    sh.querySelector('#stOk').onclick = () => { closeSheet(); render(); };
  });
}

export function editBlock(b, layer = 'plan') {
  const isNew = !b;
  const x = b ? { ...b } : { date: app.selDate, start: Math.min(21 * 60, Math.max(H0 * 60, r15(nowMin() + 15))), end: 0, theme: 'travail', title: '', note: '', fixed: false };
  if (isNew) x.end = x.start + 60;
  const mon = mondayOf(x.date);
  const real = (b ? b.layer : layer) === 'real';
  openSheet(`<h4>${isNew ? (real ? 'Ajouter au réel' : 'Nouveau bloc') : 'Enrichir le bloc'}</h4>
  ${real ? `<p class="lead" style="margin:0">${isNew ? "Ce qui s'est passé sans être prévu." : 'Tu modifies le réel : le plan reste intact.'}</p>` : ''}
  <label class="f">Titre<input type="text" id="bT" value="${esc(x.title)}" placeholder="Ex. Appel découverte"></label>
  <div class="f">Étiquette<div class="row" style="margin-top:6px">${THEMES.map(t => `<button type="button" class="chip" data-th="${t.id}" aria-pressed="${t.id === x.theme}"><span class="dot" style="--c:var(${t.c})"></span>${t.name}</button>`).join('')}</div></div>
  <div class="row"><label class="f" style="flex:1">Début${timeField('bS', x.start)}</label><label class="f" style="flex:1">Fin${timeField('bE', x.end)}</label></div>
  ${real ? '' : `<label class="f">Jour<select id="bD">${weekDates(mon).map((d, i) => `<option value="${d}" ${d === x.date ? 'selected' : ''}>${DAYS_L[i]} ${dayNum(d)}</option>`).join('')}</select></label>`}
  <label class="f">Commentaire, visible dans le bloc<input type="text" id="bN" value="${esc(x.note)}" placeholder="Ex. relancer 2 factures"></label>
  <label class="row"><input type="checkbox" id="bF" ${x.fixed ? 'checked' : ''}> Bloc fixe (ne se déplace pas)</label>
  <div class="row" style="justify-content:space-between">${isNew ? '<span></span>' : '<button class="btn ghost small" type="button" id="bDel">Supprimer</button>'}<button class="btn" type="button" id="bOk">Enregistrer</button></div>`, sh => {
    let th = x.theme;
    sh.querySelectorAll('[data-th]').forEach(c => c.onclick = () => { th = c.dataset.th; sh.querySelectorAll('[data-th]').forEach(o => o.setAttribute('aria-pressed', o === c)); });
    sh.querySelector('#bOk').onclick = () => {
      const s = readTime(sh, 'bS'), e = readTime(sh, 'bE');
      if (e <= s) { toast('La fin doit être après le début'); return; }
      const dateSel = sh.querySelector('#bD');
      const rec = { title: sh.querySelector('#bT').value.trim() || theme(th).name, theme: th, start: s, end: e, date: dateSel ? dateSel.value : x.date, note: sh.querySelector('#bN').value.trim(), fixed: sh.querySelector('#bF').checked };
      if (!real && isLocked(rec.date) && rec.date !== x.date) { toast('Ce jour a déjà commencé : ajoute le bloc dans son réel'); return; }
      if (isNew) S.blocks.push({ id: uid(), layer: real ? 'real' : 'plan', ...rec }); else Object.assign(b, rec);
      save(); closeSheet(); render(); toast(isNew ? (real ? 'Ajouté au réel' : 'Bloc ajouté') : 'Bloc mis à jour');
    };
    const del = sh.querySelector('#bDel');
    del && (del.onclick = () => { removeById('blocks', b.id); save(); closeSheet(); render(); toast(real ? 'Retiré du réel' : 'Bloc supprimé'); });
  });
}

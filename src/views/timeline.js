// L'agenda d'une journée, partagé par trois écrans :
// - 'plan'   : Planifier, le plan seul (modifiable tant que la journée n'a pas commencé)
// - 'cmp'    : Ma journée, Prévu | Réel côte à côte avec le ruban d'énergie
// - 'review' : la clôture du soir, le plan resserré sur la journée, chaque bloc à qualifier

import { app, render } from '../app.js';
import { S, save, uid, removeById, isLocked, lockDay, planBlocks, realBlocks, realOf, setStatus, setReplacement, themes, theme } from '../data/store.js';
import { H0, H1, DAYS, DAYS_L, hm, dur, nowMin, today, mondayOf, weekDates, addDays, dayNum, r15, toTime } from '../lib/time.js';
import { $, esc, openSheet, closeSheet, toast, timeField, readTime, onTime, energyCol } from '../lib/ui.js';
import { auroraGradient, impactRows } from './shared.js';
import { startGuide } from './guide.js';

export const PXM = 1; // 1 px par minute
export const STATUS = { fait: ['✓', 'fait'], partiel: ['½', 'en partie'], non: ['✕', 'pas fait'], remplace: ['↷', 'remplacé'] };

// ---------- Sélecteur de jour ----------
export function daySelectorHTML(date) {
  const mon = mondayOf(date);
  return `<div class="dayhead"><div class="days"><button type="button" data-shift="-7" aria-label="Semaine précédente" style="min-width:28px">‹</button>${weekDates(mon).map((d, i) => `<button type="button" data-date="${d}" aria-pressed="${d === date}" class="${d === today() ? 'today' : ''}">${DAYS[i]}<b>${dayNum(d)}</b></button>`).join('')}<button type="button" data-shift="7" aria-label="Semaine suivante" style="min-width:28px">›</button></div></div>`;
}
export function bindDaySelector(v) {
  v.querySelectorAll('.days [data-date]').forEach(b => { b.onclick = () => { app.selDate = b.dataset.date; render(); }; });
  v.querySelectorAll('.days [data-shift]').forEach(b => b.onclick = () => { app.selDate = addDays(app.selDate, +b.dataset.shift); render(); });
}

// ---------- Blocs ----------
// Les blocs qui se chevauchent se rangent côte à côte (comme dans Outlook) : [colonne, nombre de colonnes]
const MINH = 24; // hauteur minimale à l'écran, pour qu'un bloc de 5 minutes reste lisible et touchable
function lanes(list) {
  const out = new Map(), sorted = [...list].sort((a, b) => a.start - b.start || b.end - a.end);
  const vEnd = b => Math.max(b.end, b.start + MINH / PXM);
  let group = [], cols = [], maxEnd = -1;
  const flush = () => { group.forEach(([b, i]) => out.set(b.id, [i, cols.length])); group = []; cols = []; };
  sorted.forEach(b => {
    if (b.start >= maxEnd) { flush(); maxEnd = -1; }
    let i = cols.findIndex(end => end <= b.start);
    if (i < 0) { i = cols.length; cols.push(0); }
    cols[i] = vEnd(b); group.push([b, i]); maxEnd = Math.max(maxEnd, vEnd(b));
  });
  flush();
  return out;
}

function blockHTML(b, { y, cls, interactive, sub, lane = [0, 1] }) {
  const top = y(b.start), ht = Math.max(MINH - 2, (b.end - b.start) * PXM - 3);
  const st = b.status && STATUS[b.status];
  const label = b.status === 'remplace' && b.replacedBy ? `${esc(b.title)} → ${esc(b.replacedBy)}` : esc(b.title);
  const line = sub ?? `${hm(b.start)}–${hm(b.end)}${b.note ? ' · ' + esc(b.note) : ''}`;
  return `<div class="block ${cls} ${b.theme === 'bienetre' ? 'wb' : ''} ${b.status ? 'st-' + b.status : ''}" data-id="${b.id}" ${interactive ? 'data-edit' : 'data-ghost'} tabindex="0" role="button"
    aria-label="${esc(b.title)}, ${hm(b.start)} à ${hm(b.end)}${st ? ', ' + st[1] : ''}" style="--c:var(${theme(b.theme).c});--li:${lane[0]};--ln:${lane[1]};top:${top + 1}px;height:${ht}px">
    ${st ? `<span class="stb" title="${st[1]}">${st[0]}</span>` : b.fixed && interactive ? '<span class="lk" title="Bloc fixe">fixe</span>' : ''}
    <div class="t">${b.theme === 'bienetre' ? '❀ ' : b.task ? '☐ ' : ''}${label}</div>${ht > 36 ? `<div class="n">${line}</div>` : ''}
    ${interactive && !b.fixed && ht >= 40 ? '<span class="rs" aria-hidden="true"></span>' : ''}</div>`;
}

// Le réel d'un bloc prévu, en une ligne : utile dans la revue du soir
function realLine(p) {
  if (p.status === 'non') return `prévu ${hm(p.start)}–${hm(p.end)} · pas fait`;
  const r = realOf(p);
  if (!r || (r.start === p.start && r.end === p.end)) return `${hm(p.start)}–${hm(p.end)}`;
  return `prévu ${hm(p.start)}–${hm(p.end)} · réel ${hm(r.start)}–${hm(r.end)}`;
}

export function timelineHTML(date, mode, opts = {}) {
  const locked = isLocked(date), plan = planBlocks(date), real = realBlocks(date);
  let from = H0, to = H1;
  if (mode === 'review' || opts.compact) {
    const all = [...plan, ...real];
    if (all.length) {
      from = Math.max(H0, Math.floor(Math.min(...all.map(b => b.start)) / 60));
      to = Math.min(H1, Math.ceil(Math.max(...all.map(b => b.end)) / 60));
    }
  }
  const top0 = mode === 'cmp' ? 30 : 0;
  const y = m => top0 + (m - from * 60) * PXM;
  const H = (to - from) * 60 * PXM + 8 + top0;
  let h = `<div class="timeline ${mode === 'cmp' ? 'cmp' : ''} ${mode === 'review' ? 'review' : ''}" id="tl" data-mode="${mode}" data-from="${from}" data-top0="${top0}" data-locked="${locked ? 1 : 0}" style="height:${H}px">`;
  if (mode === 'cmp') h += `<div class="colhead plan">Prévu</div><div class="colhead real">Réel</div>`;
  for (let x = from; x < to; x++) h += `<div class="hour" style="top:${y(x * 60)}px"><span>${x}h</span></div>`;
  if (mode === 'cmp') {
    const g = auroraGradient(date, 'energie', energyCol, '180deg');
    h += `<div class="rib" style="top:${top0}px;height:${H - top0 - 8}px;${g ? `background:${g}` : ''}"></div>`;
    const lp = lanes(plan), lr = lanes(real);
    plan.forEach(b => (h += blockHTML(b, { y, cls: 'ghost', interactive: false, lane: lp.get(b.id) })));
    real.forEach(b => (h += blockHTML(b, { y, cls: 'real', interactive: true, lane: lr.get(b.id) })));
    let lastY = -99;
    impactRows(date).forEach((m, i) => {
      let my = y(m.t);
      if (my < lastY + 21) my = lastY + 21;
      lastY = my;
      h += `<button type="button" class="mk" data-mk="${i}" style="top:${my}px;--mc:${m.hue}" aria-label="${hm(m.t)} : ${esc(m.plain)}">${m.i}</button>`;
    });
  } else if (mode === 'review') {
    const lp = lanes(plan), extras = real.filter(r => !r.fromId), le = lanes(extras);
    plan.forEach(b => (h += blockHTML(b, { y, cls: 'locked', interactive: false, sub: realLine(b), lane: lp.get(b.id) })));
    extras.forEach(b => (h += blockHTML(b, { y, cls: 'extra', interactive: false, sub: `non prévu · ${hm(b.start)}–${hm(b.end)}`, lane: le.get(b.id) })));
  } else {
    const lp = lanes(plan);
    plan.forEach(b => (h += blockHTML(b, { y, cls: locked ? 'locked' : '', interactive: !locked, lane: lp.get(b.id) })));
  }
  if (date === today() && mode !== 'review') { const m = nowMin(); if (m > from * 60 && m < to * 60) h += `<div class="nowline" style="top:${y(m)}px"></div>`; }
  return h + `</div>`;
}

export function bindTimeline(v, date) {
  const rows = impactRows(date);
  v.querySelectorAll('[data-mk]').forEach(m => m.onclick = () => { const r = rows[+m.dataset.mk]; toast(`${hm(r.t)} · ${r.plain}`); });
  v.querySelectorAll('[data-ghost]').forEach(el => {
    const b = S.blocks.find(x => x.id === el.dataset.id);
    const open = () => (b.layer === 'real' ? editBlock(b) : statusSheet(b));
    el.onclick = open;
    el.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } };
  });
  bindDrag(v);
  bindEmptyTap(v, date);
}

// Toucher un créneau vide ouvre un nouveau bloc à cette heure-là ; en mode « placer une tâche », toucher l'agenda la pose.
function minuteAt(tl, clientY) {
  const r = tl.getBoundingClientRect();
  return +tl.dataset.from * 60 + (clientY - r.top - +tl.dataset.top0) / PXM;
}
function bindEmptyTap(v, date) {
  const tl = v.querySelector('#tl');
  if (!tl || tl.dataset.mode === 'review') return;
  const cmp = tl.dataset.mode === 'cmp';
  const realSide = e => { const ch = tl.querySelector('.colhead.real'); return !ch || e.clientX >= ch.getBoundingClientRect().left - 4; };
  tl.addEventListener('click', e => {
    if (justDragged) return;
    const m = minuteAt(tl, e.clientY);
    if (m < H0 * 60 || m > H1 * 60) return;
    if (app.placing) {
      const t = S.tasks.find(x => x.id === app.placing);
      if (!t) { app.placing = null; render(); return; }
      e.stopPropagation(); e.preventDefault();
      const layer = cmp ? 'real' : 'plan';
      if (!cmp && tl.dataset.locked === '1') { toast('Cette journée a commencé : place la tâche dans Ma journée'); return; }
      editBlock(null, layer, { title: t.title, start: Math.floor(m / 5) * 5, taskId: t.id, date });
      return;
    }
    if (e.target.closest('.block,.mk,.colhead')) return;
    if (cmp) { if (realSide(e)) editBlock(null, 'real', { start: Math.floor(m / 15) * 15, date }); return; }
    if (tl.dataset.locked === '1') return;
    editBlock(null, 'plan', { start: Math.floor(m / 15) * 15, date });
  }, true);
}

// Déplacer ou changer la durée : appui long (~0,35 s) puis glisser, par pas de 15 minutes.
// Faire défiler la journée ne bouge jamais un bloc : sans appui long, le geste reste un défilement.
const LONG = 350;
export const drag = { active: false };
let justDragged = false;
if (typeof document !== 'undefined') document.addEventListener('touchmove', e => { if (drag.active) e.preventDefault(); }, { passive: false });

function bindDrag(v) {
  v.querySelectorAll('[data-edit]').forEach(el => {
    const b = S.blocks.find(x => x.id === el.dataset.id);
    let st = null;
    const end = () => { if (st) clearTimeout(st.timer); drag.active = false; el.classList.remove('lifted', 'dragging'); };
    el.addEventListener('pointerdown', e => {
      if (e.button > 0 || app.placing) return;
      st = { x: e.clientX, y: e.clientY, s0: b.start, e0: b.end, mode: e.target.closest('.rs') ? 'resize' : 'move', armed: false, moved: false, scroll: false, pid: e.pointerId };
      const arm = () => {
        if (!st || st.scroll) return;
        st.armed = true; drag.active = true; el.classList.add('lifted');
        try { el.setPointerCapture(st.pid); } catch (err) { /* rien */ }
        navigator.vibrate?.(12);
      };
      if (e.pointerType === 'mouse') arm(); else st.timer = setTimeout(arm, LONG);
    });
    el.addEventListener('pointermove', e => {
      if (!st) return;
      const dx = e.clientX - st.x, dy = e.clientY - st.y;
      if (!st.armed) { if (Math.hypot(dx, dy) > 8) { st.scroll = true; clearTimeout(st.timer); } return; }
      if (Math.abs(dy) > 4) st.moved = true;
      if (!st.moved || b.fixed) return;
      el.classList.add('dragging');
      const steps = Math.round(dy / PXM / 15) * 15;
      if (st.mode === 'resize') {
        const ne = Math.max(b.start + 5, Math.min(H1 * 60, st.e0 + steps));
        el.style.height = (Math.max(MINH - 2, (ne - b.start) * PXM - 3)) + 'px';
        el.dataset.ne = ne;
      } else {
        const len = b.end - b.start;
        const ns = Math.max(H0 * 60, Math.min(H1 * 60 - len, st.s0 + steps));
        el.style.transform = `translateY(${(ns - st.s0) * PXM}px)`;
        el.dataset.ns = ns;
      }
    });
    el.addEventListener('pointerup', () => {
      if (!st) return;
      const s = st; end(); st = null;
      if (!s.armed || !s.moved) return; // un simple toucher : le clic ouvre le bloc
      justDragged = true; setTimeout(() => (justDragged = false), 350);
      if (b.fixed) { toast('Bloc fixe : il ne bouge pas'); return; }
      if (s.mode === 'resize') {
        const ne = +el.dataset.ne;
        if (!isNaN(ne) && ne !== b.end) { b.end = ne; save(); render(); toast(`${b.title} : ${hm(b.start)}–${hm(b.end)}`); }
      } else {
        const ns = +el.dataset.ns;
        if (!isNaN(ns) && ns !== b.start) { const len = b.end - b.start; b.start = ns; b.end = ns + len; save(); render(); toast(`${b.title} déplacé à ${hm(ns)}`); }
        else el.style.transform = '';
      }
    });
    el.addEventListener('pointercancel', () => { const was = st && st.moved; end(); st = null; if (was) render(); });
    el.addEventListener('contextmenu', e => e.preventDefault());
    el.addEventListener('click', e => { if (justDragged || app.placing) return; e.stopPropagation(); editBlock(b); });
    el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); editBlock(b); } });
  });
}

export function scrollToNow() {
  const tl = document.getElementById('tl');
  if (!tl || app.selDate !== today() || tl.classList.contains('review')) return;
  const m = nowMin();
  if (m > H0 * 60) window.scrollTo({ top: Math.max(0, tl.offsetTop + (m - H0 * 60 - 90) * PXM), behavior: 'instant' });
}

// ---------- Un bloc prévu : fait ou pas, et combien de temps il a vraiment pris ----------
function durHint(p, r) {
  const parts = [];
  if (r.start !== p.start) parts.push(`commencé ${r.start > p.start ? 'plus tard' : 'plus tôt'}, à ${hm(r.start)}`);
  const dd = (r.end - r.start) - (p.end - p.start);
  parts.push(dd === 0 ? 'durée comme prévu' : `${dd > 0 ? 'plus long' : 'plus court'} de ${dur(Math.abs(dd))}`);
  return cap1(parts.join(' · '));
}
const cap1 = s => s[0].toUpperCase() + s.slice(1);

export function statusSheet(p) {
  if (!p) return;
  lockDay(p.date);
  const draw = () => {
    const r = p.status === 'non' ? null : realOf(p);
    $('sheet').innerHTML = `<h4>${esc(p.title)}</h4><p class="lead" style="margin:0">Prévu ${hm(p.start)}–${hm(p.end)}. Et en vrai ?</p>
    <div class="row">${Object.entries(STATUS).map(([k, [ic, l]]) => `<button type="button" class="chip" data-st="${k}" aria-pressed="${p.status === k}">${ic} ${l}</button>`).join('')}</div>
    ${p.status === 'remplace' ? `<label class="f">Remplacé par quoi ?<input type="text" id="replIn" value="${esc(p.replacedBy || '')}" placeholder="Ex. relances mails"></label>` : ''}
    ${r ? `<div class="card stack" style="padding:12px">
      <b style="font-weight:600">Combien de temps, en vrai ?</b>
      <div class="row"><label class="f" style="flex:1">De${timeField('rS', r.start)}</label><label class="f" style="flex:1">À${timeField('rE', r.end)}</label></div>
      <div class="row">${[-15, -5, 5, 15, 30].map(d => `<button type="button" class="chip" data-adj="${d}">${d > 0 ? '+' : '−'}${Math.abs(d)} min</button>`).join('')}</div>
      <p class="lead" style="margin:0;color:var(--gold)">${durHint(p, r)}</p></div>` : ''}
    <button class="btn" type="button" id="stOk">OK</button>`;
    const sh = $('sheet');
    sh.querySelectorAll('[data-st]').forEach(c => c.onclick = () => { setStatus(p, c.dataset.st); draw(); render(); });
    const ri = sh.querySelector('#replIn');
    ri && (ri.oninput = e => { setReplacement(p, e.target.value.trim()); render(); });
    sh.querySelectorAll('[data-adj]').forEach(c => c.onclick = () => {
      r.end = Math.max(r.start + 5, Math.min(H1 * 60, r.end + +c.dataset.adj));
      save(); draw(); render();
    });
    if (r) {
      onTime(sh, 'rS', m => { const len = r.end - r.start; r.start = m; if (r.end <= m) r.end = Math.min(H1 * 60, m + len); save(); draw(); render(); });
      onTime(sh, 'rE', m => { if (m <= r.start) { toast('La fin doit être après le début'); draw(); return; } r.end = m; save(); draw(); render(); });
    }
    sh.querySelector('#stOk').onclick = () => { closeSheet(); render(); };
  };
  openSheet('', () => {});
  draw();
}

// ---------- Créer ou modifier un bloc (du plan, ou du réel) ----------
export const DURS = [5, 10, 15, 30, 45, 60, 90, 120];
export const durLabel = d => d < 60 ? `${d} min` : d % 60 ? `${Math.floor(d / 60)} h ${d % 60}` : `${d / 60} h`;
export function durChips(cur) {
  return `<div class="row durs">${DURS.map(d => `<button type="button" class="chip" data-du="${d}" aria-pressed="${d === cur}">${durLabel(d)}</button>`).join('')}</div>`;
}

// pre : { start, date, title, taskId } pour un nouveau bloc (créneau touché, tâche à placer)
export function editBlock(b, layer = 'plan', pre = {}) {
  const isNew = !b;
  const fromTask = !!pre.taskId;
  const x = b ? { ...b } : { date: pre.date || app.selDate, start: pre.start ?? Math.min(21 * 60, Math.max(H0 * 60, r15(nowMin() + 15))), end: 0, theme: fromTask ? null : 'travail', title: pre.title || '', note: '', fixed: false };
  if (isNew) x.end = Math.min(H1 * 60, x.start + (fromTask ? 15 : 60));
  const mon = mondayOf(x.date);
  const real = (b ? b.layer : layer) === 'real';
  const head = fromTask ? `Placer « ${esc(x.title)} »` : isNew ? (real ? 'Ajouter au réel' : 'Nouveau bloc') : 'Enrichir le bloc';
  openSheet(`<h4>${head}</h4>
  ${real && !fromTask ? `<p class="lead" style="margin:0">${isNew ? "Ce qui s'est passé sans être prévu." : 'Tu modifies le réel : le plan reste intact.'}</p>` : ''}
  ${fromTask ? '' : `<label class="f">Titre<input type="text" id="bT" value="${esc(x.title)}" placeholder="Ex. Appel découverte"></label>`}
  <div class="row"><label class="f" style="flex:1">Début${timeField('bS', x.start)}</label><label class="f" style="flex:1">Fin${timeField('bE', x.end)}</label></div>
  <div class="f">Durée${durChips(x.end - x.start)}</div>
  <div class="f">${fromTask ? 'Catégorie, à choisir' : 'Étiquette'}<div class="row" style="margin-top:6px">${themes().map(t => `<button type="button" class="chip" data-th="${t.id}" aria-pressed="${t.id === x.theme}"><span class="dot" style="--c:var(${t.c})"></span>${esc(t.name)}</button>`).join('')}</div>${fromTask ? '' : '<button class="link" type="button" id="manageTh" style="margin-top:8px;align-self:flex-start">Gérer mes catégories</button>'}</div>
  ${real || fromTask ? '' : `<label class="f">Jour<select id="bD">${weekDates(mon).map((d, i) => `<option value="${d}" ${d === x.date ? 'selected' : ''}>${DAYS_L[i]} ${dayNum(d)}</option>`).join('')}</select></label>`}
  ${fromTask ? '' : `<label class="f">Commentaire, visible dans le bloc<input type="text" id="bN" value="${esc(x.note)}" placeholder="Ex. relancer 2 factures"></label>
  <label class="row"><input type="checkbox" id="bF" ${x.fixed ? 'checked' : ''}> Bloc fixe (ne se déplace pas)</label>`}
  ${!isNew && b.task && b.layer !== 'real' ? '<button class="link" type="button" id="bBack" style="align-self:flex-start">Remettre dans mes tâches</button>' : ''}
  <div class="row" style="justify-content:space-between">${isNew ? '<span></span>' : '<button class="btn ghost small" type="button" id="bDel">Supprimer</button>'}<button class="btn" type="button" id="bOk">${fromTask ? 'Placer' : 'Enregistrer'}</button></div>`, sh => {
    const q = s => sh.querySelector(s);
    let th = x.theme;
    sh.querySelectorAll('[data-th]').forEach(c => c.onclick = () => { th = c.dataset.th; sh.querySelectorAll('[data-th]').forEach(o => o.setAttribute('aria-pressed', o === c)); });
    q('#manageTh') && (q('#manageTh').onclick = () => { closeSheet(); startGuide('themes'); });
    // Début, fin et durée restent liés : changer le début garde la durée, une pastille pose la fin
    const setEnd = m => { q('#bE').value = toTime(Math.min(H1 * 60 + 59, m)); syncDur(); };
    const syncDur = () => { const d = readTime(sh, 'bE') - readTime(sh, 'bS'); sh.querySelectorAll('[data-du]').forEach(c => c.setAttribute('aria-pressed', +c.dataset.du === d)); };
    let len = x.end - x.start;
    sh.querySelectorAll('[data-du]').forEach(c => c.onclick = () => { len = +c.dataset.du; setEnd(readTime(sh, 'bS') + len); });
    q('#bS').addEventListener('change', () => { const s = readTime(sh, 'bS'); if (!isNaN(s)) setEnd(s + len); });
    q('#bE').addEventListener('change', () => { const d = readTime(sh, 'bE') - readTime(sh, 'bS'); if (d > 0) len = d; syncDur(); });
    q('#bOk').onclick = () => {
      const s = readTime(sh, 'bS'), e = readTime(sh, 'bE');
      if (!(e > s)) { toast('La fin doit être après le début'); return; }
      if (!th) { toast('Choisis une catégorie'); return; }
      const dateSel = q('#bD');
      const title = fromTask ? x.title : q('#bT').value.trim() || theme(th).name;
      const rec = { title, theme: th, start: s, end: e, date: dateSel ? dateSel.value : x.date, note: q('#bN') ? q('#bN').value.trim() : x.note, fixed: q('#bF') ? q('#bF').checked : false };
      if (!real && isLocked(rec.date)) { toast('Ce jour a déjà commencé : ajoute le bloc dans Ma journée'); return; }
      if (isNew) {
        const nb = { id: uid(), layer: real ? 'real' : 'plan', ...rec };
        if (fromTask) { nb.task = true; removeById('tasks', pre.taskId); app.placing = null; }
        S.blocks.push(nb);
      } else Object.assign(b, rec);
      save(); closeSheet(); render();
      toast(fromTask ? `« ${title} » placée à ${hm(s)}` : isNew ? (real ? 'Ajouté au réel' : 'Bloc ajouté') : 'Bloc mis à jour');
    };
    const del = q('#bDel');
    del && (del.onclick = () => { removeById('blocks', b.id); save(); closeSheet(); render(); toast(real ? 'Retiré du réel' : 'Bloc supprimé'); });
    const back = q('#bBack');
    back && (back.onclick = () => { removeById('blocks', b.id); S.tasks.push({ id: uid(), title: b.title, created: today() }); save(); closeSheet(); render(); toast('Remise dans tes tâches'); });
  });
}

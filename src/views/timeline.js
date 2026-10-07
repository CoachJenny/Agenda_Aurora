// L'agenda d'une journée, partagé par trois écrans :
// - 'plan'   : Planifier, le plan seul (modifiable tant que la journée n'a pas commencé)
// - 'cmp'    : Ma journée, Prévu | Réel côte à côte avec le ruban d'énergie
// - 'review' : la clôture du soir, le plan resserré sur la journée, chaque bloc à qualifier

import { app, render } from '../app.js';
import { S, save, uid, removeById, isLocked, lockDay, planBlocks, realBlocks, realOf, setStatus, setReplacement, themes, theme } from '../data/store.js';
import { H0, H1, DAYS, DAYS_L, hm, dur, nowMin, today, mondayOf, weekDates, addDays, dayNum, r15 } from '../lib/time.js';
import { $, esc, openSheet, closeSheet, toast, timeField, readTime, onTime, energyCol } from '../lib/ui.js';
import { auroraGradient, impactRows } from './shared.js';

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
function blockHTML(b, { y, cls, interactive, sub }) {
  const top = y(b.start), ht = Math.max(22, (b.end - b.start) * PXM - 3);
  const st = b.status && STATUS[b.status];
  const label = b.status === 'remplace' && b.replacedBy ? `${esc(b.title)} → ${esc(b.replacedBy)}` : esc(b.title);
  const line = sub ?? `${hm(b.start)}–${hm(b.end)}${b.note ? ' · ' + esc(b.note) : ''}`;
  return `<div class="block ${cls} ${b.theme === 'bienetre' ? 'wb' : ''} ${b.status ? 'st-' + b.status : ''}" data-id="${b.id}" ${interactive ? 'data-edit' : 'data-ghost'} tabindex="0" role="button"
    aria-label="${esc(b.title)}, ${hm(b.start)} à ${hm(b.end)}${st ? ', ' + st[1] : ''}" style="--c:var(${theme(b.theme).c});top:${top + 1}px;height:${ht}px">
    ${st ? `<span class="stb" title="${st[1]}">${st[0]}</span>` : b.fixed && interactive ? '<span class="lk" title="Bloc fixe">fixe</span>' : ''}
    <div class="t">${b.theme === 'bienetre' ? '❀ ' : ''}${label}</div>${ht > 36 ? `<div class="n">${line}</div>` : ''}
    ${interactive && !b.fixed ? '<span class="rs" aria-hidden="true"></span>' : ''}</div>`;
}

// Le réel d'un bloc prévu, en une ligne : utile dans la revue du soir
function realLine(p) {
  if (p.status === 'non') return `prévu ${hm(p.start)}–${hm(p.end)} · pas fait`;
  const r = realOf(p);
  if (!r || (r.start === p.start && r.end === p.end)) return `${hm(p.start)}–${hm(p.end)}`;
  return `prévu ${hm(p.start)}–${hm(p.end)} · réel ${hm(r.start)}–${hm(r.end)}`;
}

export function timelineHTML(date, mode) {
  const locked = isLocked(date), plan = planBlocks(date), real = realBlocks(date);
  let from = H0, to = H1;
  if (mode === 'review') {
    const all = [...plan, ...real];
    if (all.length) {
      from = Math.max(H0, Math.floor(Math.min(...all.map(b => b.start)) / 60));
      to = Math.min(H1, Math.ceil(Math.max(...all.map(b => b.end)) / 60));
    }
  }
  const top0 = mode === 'cmp' ? 30 : 0;
  const y = m => top0 + (m - from * 60) * PXM;
  const H = (to - from) * 60 * PXM + 8 + top0;
  let h = `<div class="timeline ${mode === 'cmp' ? 'cmp' : ''} ${mode === 'review' ? 'review' : ''}" id="tl" style="height:${H}px">`;
  if (mode === 'cmp') h += `<div class="colhead plan">Prévu</div><div class="colhead real">Réel</div>`;
  for (let x = from; x < to; x++) h += `<div class="hour" style="top:${y(x * 60)}px"><span>${x}h</span></div>`;
  if (mode === 'cmp') {
    const g = auroraGradient(date, 'energie', energyCol, '180deg');
    h += `<div class="rib" style="top:${top0}px;height:${H - top0 - 8}px;${g ? `background:${g}` : ''}"></div>`;
    plan.forEach(b => (h += blockHTML(b, { y, cls: 'ghost', interactive: false })));
    real.forEach(b => (h += blockHTML(b, { y, cls: 'real', interactive: true })));
    let lastY = -99;
    impactRows(date).forEach((m, i) => {
      let my = y(m.t);
      if (my < lastY + 21) my = lastY + 21;
      lastY = my;
      h += `<button type="button" class="mk" data-mk="${i}" style="top:${my}px;--mc:${m.hue}" aria-label="${hm(m.t)} : ${esc(m.plain)}">${m.i}</button>`;
    });
  } else if (mode === 'review') {
    plan.forEach(b => (h += blockHTML(b, { y, cls: 'locked', interactive: false, sub: realLine(b) })));
    real.filter(r => !r.fromId).forEach(b => (h += blockHTML(b, { y, cls: 'extra', interactive: false, sub: `non prévu · ${hm(b.start)}–${hm(b.end)}` })));
  } else {
    plan.forEach(b => (h += blockHTML(b, { y, cls: locked ? 'locked' : '', interactive: !locked })));
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
      if (!moved) { if (mode === 'move') editBlock(b); return; }
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
      <div class="row">${[-30, -15, 15, 30].map(d => `<button type="button" class="chip" data-adj="${d}">${d > 0 ? '+' : '−'}${Math.abs(d)} min</button>`).join('')}</div>
      <p class="lead" style="margin:0;color:var(--gold)">${durHint(p, r)}</p></div>` : ''}
    <button class="btn" type="button" id="stOk">OK</button>`;
    const sh = $('sheet');
    sh.querySelectorAll('[data-st]').forEach(c => c.onclick = () => { setStatus(p, c.dataset.st); draw(); render(); });
    const ri = sh.querySelector('#replIn');
    ri && (ri.oninput = e => { setReplacement(p, e.target.value.trim()); render(); });
    sh.querySelectorAll('[data-adj]').forEach(c => c.onclick = () => {
      r.end = Math.max(r.start + 15, Math.min(H1 * 60, r.end + +c.dataset.adj));
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
export function editBlock(b, layer = 'plan') {
  const isNew = !b;
  const x = b ? { ...b } : { date: app.selDate, start: Math.min(21 * 60, Math.max(H0 * 60, r15(nowMin() + 15))), end: 0, theme: 'travail', title: '', note: '', fixed: false };
  if (isNew) x.end = x.start + 60;
  const mon = mondayOf(x.date);
  const real = (b ? b.layer : layer) === 'real';
  openSheet(`<h4>${isNew ? (real ? 'Ajouter au réel' : 'Nouveau bloc') : 'Enrichir le bloc'}</h4>
  ${real ? `<p class="lead" style="margin:0">${isNew ? "Ce qui s'est passé sans être prévu." : 'Tu modifies le réel : le plan reste intact.'}</p>` : ''}
  <label class="f">Titre<input type="text" id="bT" value="${esc(x.title)}" placeholder="Ex. Appel découverte"></label>
  <div class="f">Étiquette<div class="row" style="margin-top:6px">${themes().map(t => `<button type="button" class="chip" data-th="${t.id}" aria-pressed="${t.id === x.theme}"><span class="dot" style="--c:var(${t.c})"></span>${t.name}</button>`).join('')}</div></div>
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
      if (!real && isLocked(rec.date)) { toast('Ce jour a déjà commencé : ajoute le bloc dans Ma journée'); return; }
      if (isNew) S.blocks.push({ id: uid(), layer: real ? 'real' : 'plan', ...rec }); else Object.assign(b, rec);
      save(); closeSheet(); render(); toast(isNew ? (real ? 'Ajouté au réel' : 'Bloc ajouté') : 'Bloc mis à jour');
    };
    const del = sh.querySelector('#bDel');
    del && (del.onclick = () => { removeById('blocks', b.id); save(); closeSheet(); render(); toast(real ? 'Retiré du réel' : 'Bloc supprimé'); });
  });
}

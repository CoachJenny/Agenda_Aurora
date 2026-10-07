// Éléments communs à plusieurs écrans : rubans d'aurore, liste des moments, miroir des priorités.

import { S, onDate, weekPrios, dayPrios, save, effectiveBlocks, planBlocks, realBlocks, realOf, bodyOn, themes, theme } from '../data/store.js';
import { SLIDERS, socialText, sliderName, wordOf } from '../data/constants.js';
import { pct, hm, dur, today, mondayOf, DAYS_L, weekday, weekDates } from '../lib/time.js';
import { esc, openSheet, closeSheet, toast } from '../lib/ui.js';
import { render } from '../app.js';

// Dégradé d'une dimension (énergie, émotion) sur la journée, à partir des check-ins
export function auroraGradient(date, key, col, dir) {
  const pts = onDate('checkins', date).filter(c => c.values[key] != null).sort((a, b) => a.start - b.start);
  if (!pts.length) return null;
  const first = pct(pts[0].start), last = pct(pts[pts.length - 1].start);
  const stops = pts.map(c => `${col(c.values[key])} ${pct(c.start).toFixed(1)}%`);
  return `linear-gradient(${dir},transparent ${Math.max(0, first - 4).toFixed(1)}%,${stops.join(',')},transparent ${Math.min(100, last + 4).toFixed(1)}%)`;
}

// Les moments d'une journée, écrits en clair (flow, procrastination, bien-être, événements, échanges, précisions)
export function momentRows(date) {
  const cs = onDate('checkins', date), ps = onDate('pulses', date), ws = onDate('wellbeing', date);
  return [
    ...ps.map(p => ({ t: p.start, cls: p.type === 'flow' ? 'flow' : 'pr', i: p.type === 'flow' ? '✦' : '◌', tx: `${p.type === 'flow' ? 'flow' : 'procrastination'} <em>${p.end != null ? dur(p.end - p.start) : 'en cours'}${p.note ? ' · ' + esc(p.note) : ''}${p.feel ? ' · ' + esc(p.feel) : ''}</em>` })),
    ...ws.map(w => ({ t: w.start, cls: 'wb', i: '❀', tx: `${esc(w.tag)} <em>${w.dur} min</em>` })),
    ...cs.filter(c => c.event).map(c => ({ t: c.start, cls: 'ev', i: '✦', tx: esc(c.event) })),
    ...cs.filter(c => socialText(c.social)).map(c => ({ t: c.start, cls: 'so', i: '◍', tx: `échange <em>${esc(socialText(c.social))}</em>` })),
    ...cs.filter(c => Object.values(c.notes || {}).some(Boolean)).map(c => ({ t: c.start, cls: 'ci', i: '✎', tx: Object.entries(c.notes).filter(([, n]) => n).map(([k, n]) => `${sliderName(k).toLowerCase()} <em>${esc(n)}</em>`).join(', ') }))
  ].sort((a, b) => a.t - b.t);
}
export const momentsHTML = rows => rows.map(m => `<div class="mo ${m.cls}"><span class="h">${hm(m.t)}</span><span class="i">${m.i}</span><span class="tx">${m.tx}</span></div>`).join('');

// ---------- Ce qui a compté ----------
// On ne garde que ce qui a eu de l'impact : fortes variations, états intenses, événements, échanges, précisions écrites.
const BIPOLAR = ['emotion', 'energie', 'corps'];
export function impactRows(date) {
  const rows = [], prev = {};
  onDate('checkins', date).filter(c => !c.estimated).sort((a, b) => a.start - b.start).forEach(c => {
    Object.entries(c.values).forEach(([k, v]) => {
      const p = prev[k]; prev[k] = v;
      const s = SLIDERS.find(x => x.id === k);
      const extreme = BIPOLAR.includes(k) ? (v <= 2 || v >= 8) : v >= 7;
      if (p != null && Math.abs(v - p) >= 3) {
        rows.push({ t: c.start, kind: 'dim', hue: s.hue, i: v > p ? '↗' : '↘', tx: `${s.name} : ${wordOf(k, p)} → <b>${wordOf(k, v)}</b>`, plain: `${s.name} : ${wordOf(k, p)} → ${wordOf(k, v)}` });
      } else if (extreme && (p == null || wordOf(k, p) !== wordOf(k, v))) {
        rows.push({ t: c.start, kind: 'dim', hue: s.hue, i: '●', tx: `${s.name} <b>${wordOf(k, v)}</b>`, plain: `${s.name} ${wordOf(k, v)}` });
      }
    });
    Object.entries(c.notes || {}).filter(([, n]) => n).forEach(([k, n]) => rows.push({ t: c.start, kind: 'ci', hue: 'var(--ivory-2)', i: '✎', tx: `${sliderName(k)} : <em>${esc(n)}</em>`, plain: `${sliderName(k)} : ${n}` }));
    if (c.event) rows.push({ t: c.start, kind: 'ev', hue: 'var(--gold)', i: '◆', tx: `<b>${esc(c.event)}</b>`, plain: c.event });
    const so = socialText(c.social);
    if (so) rows.push({ t: c.start, kind: 'so', hue: 'var(--violet)', i: '◍', tx: `Échange <em>${esc(so)}</em>`, plain: 'Échange ' + so });
  });
  onDate('pulses', date).forEach(p => {
    const len = p.end != null ? dur(p.end - p.start) : 'en cours';
    const extra = [p.note, p.feel].filter(Boolean).map(esc).join(' · ');
    rows.push(p.type === 'flow'
      ? { t: p.start, kind: 'flow', hue: 'var(--coral)', i: '✦', tx: `Flow <em>${len}${extra ? ' · ' + extra : ''}</em>`, plain: `Flow ${len}` }
      : { t: p.start, kind: 'pr', hue: 'var(--ivory-3)', i: '◌', tx: `Procrastination <em>${len}${extra ? ' · ' + extra : ''}</em>`, plain: `Procrastination ${len}` });
  });
  onDate('wellbeing', date).forEach(w => rows.push({ t: w.start, kind: 'wb', hue: 'var(--turq)', i: '❀', tx: `${esc(w.tag)} <em>${w.dur} min</em>`, plain: `${w.tag} ${w.dur} min` }));
  return rows.sort((a, b) => a.t - b.t);
}
export const impactHTML = rows => rows.map(m => `<div class="mo ${m.kind}"><span class="h">${hm(m.t)}</span><span class="i" style="color:${m.hue}">${m.i}</span><span class="tx">${m.tx}</span></div>`).join('');

// ---------- Prévu → réel ----------
export function planDiffs(date) {
  const rows = [];
  planBlocks(date).forEach(p => {
    const r = realOf(p);
    let tx, kind = 'chg';
    if (p.status === 'remplace') { tx = `remplacé${p.replacedBy ? ' par <b>' + esc(p.replacedBy) + '</b>' : ''}`; kind = 'rep'; }
    else if (!r || p.status === 'non') { tx = 'pas fait'; kind = 'non'; }
    else {
      const parts = [];
      if (r.start !== p.start) parts.push(`${r.start > p.start ? 'décalé' : 'avancé'} à ${hm(r.start)}`);
      const dd = (r.end - r.start) - (p.end - p.start);
      if (dd) parts.push(`${dd > 0 ? 'plus long' : 'plus court'} de ${dur(Math.abs(dd))}`);
      if (p.status === 'partiel') parts.push('fait en partie');
      if (parts.length) tx = parts.join(' · ');
      else if (p.status === 'fait') { tx = 'fait comme prévu'; kind = 'ok'; }
      else return;
    }
    rows.push({ t: p.start, title: p.title, theme: p.theme, tx, kind });
  });
  realBlocks(date).filter(r => !r.fromId).forEach(r => rows.push({ t: r.start, title: r.title, theme: r.theme, tx: `non prévu · ${hm(r.start)}–${hm(r.end)}`, kind: 'add' }));
  return rows.sort((a, b) => a.t - b.t);
}
const DIFF_ICON = { ok: '✓', chg: '↔', non: '✕', rep: '↷', add: '+' };
export const diffsHTML = rows => rows.map(d => `<div class="cmprow ${d.kind}"><span class="h">${hm(d.t)}</span><span class="di">${DIFF_ICON[d.kind]}</span><span class="tx"><span class="dot" style="--c:var(${theme(d.theme).c})"></span><b>${esc(d.title)}</b> <em>${d.tx}</em></span></div>`).join('');
export function diffSummary(date) {
  const plan = planBlocks(date);
  if (!plan.length) return '';
  const c = { fait: 0, partiel: 0, non: 0, remplace: 0 };
  plan.forEach(p => { if (p.status) c[p.status]++; });
  const added = realBlocks(date).filter(r => !r.fromId).length;
  const parts = [];
  if (c.fait) parts.push(`${c.fait} fait${c.fait > 1 ? 's' : ''}`);
  if (c.partiel) parts.push(`${c.partiel} en partie`);
  if (c.non) parts.push(`${c.non} pas fait${c.non > 1 ? 's' : ''}`);
  if (c.remplace) parts.push(`${c.remplace} remplacé${c.remplace > 1 ? 's' : ''}`);
  if (added) parts.push(`${added} non prévu${added > 1 ? 's' : ''}`);
  return parts.length ? `${plan.length} bloc${plan.length > 1 ? 's' : ''} prévu${plan.length > 1 ? 's' : ''} : ${parts.join(' · ')}` : '';
}

// « Tes priorités, et ce qui y correspond pour l'instant dans l'agenda »
export function prioMirror(scope, date) {
  const monday = mondayOf(date);
  const ids = scope === 'jour' ? dayPrios(date) : weekPrios(monday);
  const inScope = b => scope === 'jour' ? b.date === date : mondayOf(b.date) === monday;
  const rows = ids.map(id => {
    const pool = scope === 'jour' ? effectiveBlocks(date) : weekDates(monday).flatMap(effectiveBlocks);
    const bl = pool.filter(b => b.theme === id && inScope(b));
    const tot = bl.reduce((a, b) => a + (b.end - b.start), 0);
    const meta = bl.length ? `${bl.length} bloc${bl.length > 1 ? 's' : ''} · ${dur(tot)}` : "rien de prévu pour l'instant";
    return `<div class="prio ${bl.length ? '' : 'empty'}"><span class="dot" style="--c:var(${theme(id).c})"></span><span class="name">${esc(theme(id).name)}</span><span class="meta">${meta}</span></div>`;
  }).join('');
  const label = scope === 'jour' ? `Tes priorités ${date === today() ? 'du jour' : 'pour ' + DAYS_L[weekday(date)]}` : 'Tes priorités de la semaine';
  return `<div class="card"><div class="row" style="justify-content:space-between"><b style="font-weight:600">${label}</b><button class="link" type="button" data-act="prio" data-scope="${scope}" data-date="${date}">${ids.length ? 'Ajuster' : 'Choisir'}</button></div>
  ${ids.length ? `<p class="lead" style="margin:4px 0 8px">Voici ce qui y correspond pour l'instant dans l'agenda.</p>${rows}` : `<p class="lead" style="margin:6px 0 0">Choisis jusqu'à 3 thématiques qui comptent ${scope === 'jour' ? "aujourd'hui" : 'cette semaine'}.</p>`}</div>`;
}
export function bindPrio(root) {
  root.querySelectorAll('[data-act="prio"]').forEach(b => b.onclick = () => editPrio(b.dataset.scope, b.dataset.date));
}
export function editPrio(scope, date) {
  const monday = mondayOf(date);
  let sel = [...(scope === 'jour' ? dayPrios(date) : weekPrios(monday))];
  openSheet(`<h4>${scope === 'jour' ? 'Priorités du jour' : 'Priorités de la semaine'}</h4><p class="lead" style="margin:0">Jusqu'à 3 thématiques.</p>
  <div class="row">${themes().map(t => `<button type="button" class="chip" data-p="${t.id}" aria-pressed="${sel.includes(t.id)}"><span class="dot" style="--c:var(${t.c})"></span>${t.name}</button>`).join('')}</div>
  <button class="btn" type="button" id="pOk">Valider</button>`, sh => {
    sh.querySelectorAll('[data-p]').forEach(c => c.onclick = () => {
      const id = c.dataset.p;
      if (sel.includes(id)) sel = sel.filter(s => s !== id);
      else { if (sel.length >= 3) { toast('3 priorités maximum'); return; } sel.push(id); }
      c.setAttribute('aria-pressed', sel.includes(id));
    });
    sh.querySelector('#pOk').onclick = () => {
      if (scope === 'jour') S.dayPrios[date] = sel; else S.weekPrios[monday] = sel;
      save(); closeSheet(); render();
    };
  });
}

export const sliderValues = values => Object.entries(values).map(([k, v]) => ({ k, name: SLIDERS.find(s => s.id === k).name, v }));

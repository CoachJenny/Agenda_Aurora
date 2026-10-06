// Éléments communs à plusieurs écrans : rubans d'aurore, liste des moments, miroir des priorités.

import { S, onDate, weekPrios, dayPrios, save } from '../data/store.js';
import { SLIDERS, THEMES, theme, socialText, sliderName } from '../data/constants.js';
import { pct, hm, dur, today, mondayOf, DAYS_L, weekday } from '../lib/time.js';
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

// « Tes priorités, et ce qui y correspond pour l'instant dans l'agenda »
export function prioMirror(scope, date) {
  const monday = mondayOf(date);
  const ids = scope === 'jour' ? dayPrios(date) : weekPrios(monday);
  const inScope = b => scope === 'jour' ? b.date === date : mondayOf(b.date) === monday;
  const rows = ids.map(id => {
    const bl = S.blocks.filter(b => b.theme === id && inScope(b));
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
  <div class="row">${THEMES.map(t => `<button type="button" class="chip" data-p="${t.id}" aria-pressed="${sel.includes(t.id)}"><span class="dot" style="--c:var(${t.c})"></span>${t.name}</button>`).join('')}</div>
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

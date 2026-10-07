// Mon journal : la progression sur plusieurs semaines. Des barres simples, des valeurs écrites,
// et toujours le même principe : l'outil montre, c'est toi qui fais les liens.

import { app, render, go } from '../app.js';
import { today, addDays, dur, dayNum, MONTHS, parse } from '../lib/time.js';
import { esc, energyCol } from '../lib/ui.js';
import { wordOf } from '../data/constants.js';
import { SLOTS, lastMondays, weekDays, datesBetween, prioCounts, statusCounts, overflowByTheme, factorCounts, wbMinutes, wbByActivity, pulseBySlot, energyBySlot } from '../data/stats.js';

// Couleurs validées sur le fond sombre (contraste, daltonismes) : fait, en partie, remplacé, pas fait
const ST = [
  { k: 'fait', label: 'fait', c: '#1C9A93' },
  { k: 'partiel', label: 'en partie', c: '#AD8826' },
  { k: 'remplace', label: 'remplacé', c: '#9566CC' },
  { k: 'non', label: 'pas fait', c: '#D45E7C' }
];
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const wlabel = mon => { const a = parse(mon), b = parse(addDays(mon, 6)); return a.getMonth() === b.getMonth() ? `${a.getDate()}–${b.getDate()} ${MONTHS[a.getMonth()].slice(0, 4)}.` : `${a.getDate()} ${MONTHS[a.getMonth()].slice(0, 3)}.–${b.getDate()} ${MONTHS[b.getMonth()].slice(0, 3)}.`; };

// Une ligne de barre : libellé, barre proportionnelle, valeur écrite
const barRow = (label, frac, value, color, aria) => `<div class="brow" role="img" aria-label="${esc(aria || `${label} : ${value}`)}" title="${esc(aria || `${label} : ${value}`)}">
  <span class="bl">${label}</span><span class="bt"><span class="bf" style="width:${Math.max(frac > 0 ? 2 : 0, Math.min(100, frac * 100)).toFixed(1)}%;background:${color}"></span></span><span class="bv">${value}</span></div>`;

export function renderJournal() {
  const n = app.journalWeeks || 4;
  const mons = lastMondays(n);
  const from = mons[0], all = datesBetween(from, today());
  let h = `<button class="link" type="button" id="jBack" style="margin-top:10px">‹ Synthèse</button>
  <h2>Mon <em>journal</em></h2>
  <div class="seg" role="group" aria-label="Période" style="margin-top:10px"><button type="button" data-jw="4" aria-pressed="${n === 4}">4 semaines</button><button type="button" data-jw="12" aria-pressed="${n === 12}">12 semaines</button></div>
  <p class="lead" style="margin-top:12px">Depuis le ${dayNum(from)} ${MONTHS[parse(from).getMonth()]}. L'outil montre, c'est toi qui fais les liens.</p>`;

  // ---- Priorités, semaine par semaine
  const pc = prioCounts(all);
  h += `<h3 id="j-prios">◆ Tes priorités</h3><div class="card">`;
  if (!pc.answered) h += `<p class="empty" style="margin:0">Elles apparaîtront ici dès tes premiers bilans du soir.</p>`;
  else {
    h += `<p class="jhead"><b>${pc.held} jour${pc.held > 1 ? 's' : ''} sur ${pc.answered}</b> où tu as tenu tes priorités${pc.partiel ? `, dont ${pc.partiel} en partie` : ''}.</p>
    <div class="legend2"><span><i style="background:#AD8826"></i>tenues</span><span><i class="tex"></i>en partie</span><span class="lead" style="margin:0;font-size:12px">sur 7 jours</span></div>`;
    mons.forEach(m => {
      const c = prioCounts(weekDays(m).filter(d => d <= today()));
      const aria = `Semaine du ${wlabel(m)} : ${c.oui} jour(s) tenus, ${c.partiel} en partie, sur ${c.answered} bilan(s)`;
      h += `<div class="brow" role="img" aria-label="${aria}" title="${aria}"><span class="bl">${wlabel(m)}</span><span class="bt">
        <span class="bf" style="width:${(c.oui / 7) * 100}%;background:#AD8826"></span><span class="bf tex" style="width:${(c.partiel / 7) * 100}%"></span></span>
        <span class="bv">${c.answered ? `${c.held} / ${c.answered}` : '<span class="muted">—</span>'}</span></div>`;
    });
    h += `<p class="lead" style="margin:10px 0 0;font-size:12px">À droite : jours tenus sur jours avec un bilan. Un tiret : pas de bilan cette semaine-là, ce n'est pas compté.</p>`;
  }
  h += `</div>`;

  // ---- Prévu → réel
  const st = statusCounts(all);
  h += `<h3 id="j-plan">↔ Prévu → réel</h3><div class="card stack">`;
  if (!st.reviewed) h += `<p class="empty" style="margin:0">Le soir, touche tes blocs pour dire ce qui a été fait : la répartition s'affichera ici.</p>`;
  else {
    h += `<p class="jhead" style="margin:0"><b>${st.fait + st.partiel} blocs faits</b> sur ${st.reviewed} dont tu as fait le bilan.</p>
    <div class="stackbar" role="img" aria-label="${ST.map(s => `${s.label} ${st[s.k]}`).join(', ')}">${ST.filter(s => st[s.k]).map(s => `<span style="flex:${st[s.k]};background:${s.c}" title="${s.label} : ${st[s.k]}"></span>`).join('')}</div>
    <div class="legend2">${ST.map(s => `<span><i style="background:${s.c}"></i>${s.label} <b>${st[s.k]}</b> <span class="muted">${pct(st[s.k], st.reviewed)} %</span></span>`).join('')}</div>`;
    const ov = overflowByTheme(all).slice(0, 5);
    if (ov.length) {
      const max = Math.max(...ov.map(o => Math.abs(o.min)));
      h += `<b style="font-weight:600;margin-top:6px">Ce qui a pris plus ou moins de temps que prévu</b>
      <div class="legend2"><span><i style="background:#5F8FE0"></i>plus court</span><span><i style="background:#BA7E30"></i>plus long</span></div>`;
      ov.forEach(o => {
        const w = (Math.abs(o.min) / max) * 50, long = o.min > 0;
        const aria = `${o.name} : ${long ? 'plus long' : 'plus court'} de ${dur(Math.abs(o.min))} au total`;
        h += `<div class="brow div" role="img" aria-label="${esc(aria)}" title="${esc(aria)}"><span class="bl"><span class="dot" style="--c:var(${o.c})"></span>${esc(o.name)}</span>
          <span class="bt center"><span class="bf" style="${long ? 'left:50%' : `left:${50 - w}%`};width:${w}%;background:${long ? '#BA7E30' : '#5F8FE0'}"></span></span><span class="bv">${long ? '+' : '−'}${dur(Math.abs(o.min))}</span></div>`;
      });
    }
    const fc = factorCounts(all).slice(0, 5);
    if (fc.length) {
      const max = fc[0][1];
      h += `<b style="font-weight:600;margin-top:6px">Ce qui a pris la place, le plus souvent</b>`;
      fc.forEach(([f, k]) => (h += barRow(esc(f), k / max, `${k} fois`, '#9566CC')));
    }
  }
  h += `</div>`;

  // ---- Bien-être
  const wbAll = wbMinutes(all);
  h += `<h3 id="j-wb" style="color:var(--turq)">❀ Bien-être</h3><div class="card stack">`;
  if (!wbAll) h += `<p class="empty" style="margin:0">Pas encore de moment bien-être noté sur la période.</p>`;
  else {
    const perWeek = mons.map(m => ({ m, min: wbMinutes(weekDays(m)) })), max = Math.max(...perWeek.map(x => x.min), 1);
    h += `<p class="jhead" style="margin:0"><b>${dur(wbAll)}</b> de moments pour toi sur la période.</p>`;
    perWeek.forEach(x => (h += barRow(wlabel(x.m), x.min / max, x.min ? dur(x.min) : '<span class="muted">—</span>', '#1C9A93', `Semaine du ${wlabel(x.m)} : ${x.min ? dur(x.min) : 'aucun moment noté'}`)));
    const acts = wbByActivity(all).slice(0, 5), amax = acts[0][1].m;
    h += `<b style="font-weight:600;margin-top:6px">Tes activités</b>`;
    acts.forEach(([name, o]) => (h += barRow(esc(name), o.m / amax, `${o.n}× · ${dur(o.m)}`, '#1C9A93')));
  }
  h += `</div>`;

  // ---- Énergie par moment de la journée
  const en = energyBySlot(all);
  h += `<h3 id="j-energie">Énergie selon le moment</h3>`;
  if (!en.some(s => s.n)) h += `<div class="card"><p class="empty" style="margin:0">Tes check-ins d'énergie dessineront ici tes moments.</p></div>`;
  else h += `<div class="etiles">${en.map(s => `<div class="etile"><span class="k">${s.short[0].toUpperCase() + s.short.slice(1)}</span>${s.n ? `<span class="sw3" style="background:${energyCol(s.avg)}"></span><b>${wordOf('energie', s.avg)}</b><span class="muted">${s.n} relevé${s.n > 1 ? 's' : ''}</span>` : '<span class="muted">pas de relevé</span>'}</div>`).join('')}</div>
    <p class="lead" style="margin:8px 0 0;font-size:12px">Moyenne de tes check-ins d'énergie, de vidée à pleine d'élan.</p>`;

  // ---- Flow et procrastination par moment
  const fl = pulseBySlot(all, 'flow'), pr = pulseBySlot(all, 'procra');
  const fmax = Math.max(...Object.values(fl), 1), pmax = Math.max(...Object.values(pr), 1);
  h += `<h3 id="j-flow">✦ Flow et ◌ procrastination</h3><div class="card stack">`;
  if (!Object.values(fl).some(Boolean) && !Object.values(pr).some(Boolean)) h += `<p class="empty" style="margin:0">Les boutons Flow et Procrastination rempliront cette partie.</p>`;
  else {
    h += `<b style="font-weight:600">Flow</b>`;
    SLOTS.forEach(s => (h += barRow(s.short, fl[s.id] / fmax, fl[s.id] ? dur(fl[s.id]) : '<span class="muted">—</span>', '#FF6B6B', `Flow ${s.name} : ${fl[s.id] ? dur(fl[s.id]) : 'rien'}`)));
    h += `<b style="font-weight:600;margin-top:6px">Procrastination</b>`;
    SLOTS.forEach(s => (h += barRow(s.short, pr[s.id] / pmax, pr[s.id] ? dur(pr[s.id]) : '<span class="muted">—</span>', '#8F8EA3', `Procrastination ${s.name} : ${pr[s.id] ? dur(pr[s.id]) : 'rien'}`)));
  }
  h += `</div>`;
  return h;
}

export function bindJournal(v) {
  v.querySelector('#jBack').onclick = () => go('synthese');
  v.querySelectorAll('[data-jw]').forEach(b => b.onclick = () => { app.journalWeeks = +b.dataset.jw; render(); });
}

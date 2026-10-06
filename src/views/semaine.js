// Ma semaine : la vue de séance. L'outil montre, la cliente fait les liens.

import { app, render } from '../app.js';
import { S, onDate, bodyOn } from '../data/store.js';
import { DAYS, DAYS_L, dur, pct, today, weekDates, addDays, dayNum, cap, weekLabel, mondayOf } from '../lib/time.js';
import { esc, energyCol, emoCol } from '../lib/ui.js';
import { auroraGradient, momentRows, momentsHTML } from './shared.js';

export function renderSemaine() {
  const days = weekDates(app.weekStart), inWeek = x => days.includes(x.date);
  const flows = S.pulses.filter(p => p.type === 'flow' && p.end != null && inWeek(p));
  const pros = S.pulses.filter(p => p.type === 'procra' && p.end != null && inWeek(p));
  const wbs = S.wellbeing.filter(inWeek);
  const fT = flows.reduce((a, p) => a + p.end - p.start, 0), pT = pros.reduce((a, p) => a + p.end - p.start, 0), wT = wbs.reduce((a, w) => a + w.dur, 0);
  const rits = days.map(d => S.rituals[d]).filter(Boolean);
  const prioDays = rits.filter(r => r.prio);
  const held = prioDays.filter(r => r.prio === 'oui').length, part = prioDays.filter(r => r.prio === 'en partie').length;
  const pl = n => n > 1 ? 's' : '';
  let story = '';
  days.forEach((d, i) => { const r = S.rituals[d]; if (r && (r.open || r.close)) story += `<span class="d">${DAYS[i]}</span><span class="w">${esc(r.open || '…')}</span><span class="ar">→</span><span class="w c">${esc(r.close || '…')}</span>`; });

  let h = `<h2>Ma <em>semaine</em></h2>
  <div class="weeknav"><button type="button" data-wk="-1" aria-label="Semaine précédente">‹</button><span class="wl">Semaine du ${weekLabel(app.weekStart)}</span><button type="button" data-wk="1" aria-label="Semaine suivante">›</button></div>
  <p class="lead" style="margin-top:12px">À regarder ensemble en séance. L'outil montre, c'est toi qui fais les liens.</p>
  <h3>L'histoire en mots</h3><div class="card">${story ? `<div class="story">${story}</div>` : '<p class="empty" style="margin:0">Les mots du matin et du soir apparaîtront ici.</p>'}</div>
  <h3>En un coup d'œil</h3><div class="tiles">
   <div class="tile flow"><div class="k"><i>✦</i>Flow</div><div class="v">${dur(fT)}</div><div class="s">${flows.length} moment${pl(flows.length)}</div></div>
   <div class="tile wbt"><div class="k"><i>❀</i>Bien-être</div><div class="v">${dur(wT)}</div><div class="s">${wbs.length} moment${pl(wbs.length)} · ${S.blocks.filter(b => b.theme === 'bienetre' && inWeek(b)).length} prévus</div></div>
   <div class="tile"><div class="k"><i>◌</i>Procrastination</div><div class="v">${dur(pT)}</div><div class="s">${pros.length} moment${pl(pros.length)}</div></div>
   <div class="tile tprio"><div class="k"><i>◆</i>Priorités tenues</div><div class="v">${held + part}<span style="font-size:16px;color:var(--ivory-3)"> / ${prioDays.length} j</span></div><div class="s">${held} oui · ${part} en partie</div></div>
  </div>
  <h3>Jour par jour</h3><div class="stack">`;
  days.forEach(d => {
    const r = S.rituals[d] || {}, cs = onDate('checkins', d), mo = momentRows(d);
    const any = cs.length || mo.length || r.open || r.close;
    const ws = (r.open || r.close) ? `${esc(r.open || '…')}<span>→</span>${esc(r.close || '…')}` : '';
    h += `<div class="dcard ${d === today() ? 'today' : ''}"><div class="dtop"><span class="dn">${cap(DAYS_L[days.indexOf(d)])}<span>${dayNum(d)}</span></span><span class="ws">${ws}</span></div>`;
    if (!any) { h += `<p class="empty" style="margin:8px 0 0">${d > today() ? 'À venir' : 'Rien de noté'}</p></div>`; return; }
    const bd = bodyOn(d);
    if (bd) h += `<div class="bodyctx" style="margin-top:10px;padding:5px 10px;font-size:12px"><span class="dot" style="--c:var(--t-enfants)"></span>Mon corps : ${esc(bd.tag)}</div>`;
    const ge = auroraGradient(d, 'energie', energyCol, '90deg'), gm = auroraGradient(d, 'emotion', emoCol, '90deg');
    if (ge) h += `<div class="rlab"><span>énergie</span><span>de vidée à pleine d'élan</span></div><div class="ribbon" style="background:${ge},var(--surface-2)"></div>`;
    if (gm) h += `<div class="rlab" style="margin-top:7px"><span>émotion</span><span>de très lourd à très positif</span></div><div class="ribbon emo" style="background:${gm},var(--surface-2)"></div>`;
    if (ge || gm) h += `<div class="ticks">${[9, 12, 15, 18, 21].map(x => `<span style="left:${pct(x * 60)}%">${x}h</span>`).join('')}</div>`;
    if (mo.length) h += `<div class="moments">${momentsHTML(mo)}</div>`;
    if (r.debrief) h += `<p class="lead" style="margin:10px 0 0;font-style:italic">« ${esc(r.debrief)} »</p>`;
    h += `</div>`;
  });
  h += `</div>`;
  const by = {};
  wbs.forEach(w => { (by[w.tag] ??= { n: 0, m: 0 }); by[w.tag].n++; by[w.tag].m += w.dur; });
  const maxM = Math.max(1, ...Object.values(by).map(o => o.m));
  h += `<h3 style="color:var(--turq)">❀ Bien-être, par activité</h3><div class="card">${Object.entries(by).sort((a, b) => b[1].m - a[1].m).map(([k, o]) => `<div class="wbrow"><span>${esc(k)} <span style="color:var(--ivory-3);font-size:12px">${o.n}×</span></span><span style="font-variant-numeric:tabular-nums">${o.m} min</span><div class="wbbar"><span style="width:${(o.m / maxM * 100).toFixed(0)}%"></span></div></div>`).join('') || '<p class="empty" style="margin:0">Aucun moment bien-être noté cette semaine.</p>'}</div>
  <p class="lead" style="margin-top:12px">Et l'énergie, les jours de marche ou de musique ? Les rubans du jour par jour sont là pour en parler.</p>`;
  return h;
}

export function bindSemaine(v) {
  v.querySelectorAll('[data-wk]').forEach(b => b.onclick = () => { app.weekStart = addDays(app.weekStart, 7 * +b.dataset.wk); render(); });
}

export { mondayOf };

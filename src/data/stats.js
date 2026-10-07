// Calculs de la Synthèse et du journal. On compte ce qui a été fait, jamais ce qui a manqué ;
// un jour sans bilan n'est ni pour ni contre, il est simplement absent.

import { S, planBlocks, realOf, theme } from './store.js';
import { today, addDays, mondayOf, weekDates } from '../lib/time.js';

export const SLOTS = [
  { id: 'matin', name: 'le matin', short: 'matin', from: 0, to: 12 * 60 },
  { id: 'midi', name: 'le midi', short: 'midi', from: 12 * 60, to: 14 * 60 },
  { id: 'aprem', name: "l'après-midi", short: 'après-midi', from: 14 * 60, to: 18 * 60 },
  { id: 'soir', name: 'le soir', short: 'soir', from: 18 * 60, to: 24 * 60 }
];
export const slotOf = m => SLOTS.find(s => m >= s.from && m < s.to) || SLOTS[3];

export function datesBetween(from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

// ---------- Priorités ----------
export function prioCounts(dates) {
  const c = { oui: 0, partiel: 0, non: 0, answered: 0 };
  dates.forEach(d => {
    const p = S.rituals[d]?.prio;
    if (!p) return;
    c.answered++;
    if (p === 'oui') c.oui++; else if (p === 'en partie') c.partiel++; else c.non++;
  });
  c.held = c.oui + c.partiel;
  return c;
}
// Les 3 dernières semaines (21 jours jusqu'à aujourd'hui), comparées aux 3 précédentes
export function prioThreeWeeks() {
  const t = today();
  const cur = prioCounts(datesBetween(addDays(t, -20), t));
  const prev = prioCounts(datesBetween(addDays(t, -41), addDays(t, -21)));
  const rate = c => (c.answered ? c.held / c.answered : 0);
  return { cur, prev, better: prev.answered >= 3 && cur.answered >= 3 && rate(cur) > rate(prev) };
}

// ---------- Prévu → réel ----------
export function statusCounts(dates) {
  const c = { fait: 0, partiel: 0, remplace: 0, non: 0, reviewed: 0, planned: 0 };
  dates.forEach(d => planBlocks(d).forEach(p => {
    c.planned++;
    if (p.status) { c[p.status]++; c.reviewed++; }
  }));
  return c;
}
// Par catégorie : minutes réelles moins minutes prévues, pour les blocs faits ou faits en partie
export function overflowByTheme(dates) {
  const by = {};
  dates.forEach(d => planBlocks(d).forEach(p => {
    if (p.status === 'non' || p.status === 'remplace') return;
    const r = realOf(p);
    if (!r) return;
    const diff = (r.end - r.start) - (p.end - p.start);
    if (!diff) return;
    by[p.theme] = (by[p.theme] || 0) + diff;
  }));
  return Object.entries(by).filter(([, min]) => min !== 0).map(([id, min]) => ({ id, name: theme(id).name, c: theme(id).c, min })).sort((a, b) => Math.abs(b.min) - Math.abs(a.min));
}
export function factorCounts(dates) {
  const by = {};
  dates.forEach(d => (S.rituals[d]?.factors || []).forEach(f => (by[f] = (by[f] || 0) + 1)));
  return Object.entries(by).sort((a, b) => b[1] - a[1]);
}

// ---------- Bien-être, flow, procrastination, énergie ----------
export const wbMinutes = dates => S.wellbeing.filter(w => dates.includes(w.date)).reduce((a, w) => a + w.dur, 0);
export function wbByActivity(dates) {
  const by = {};
  S.wellbeing.filter(w => dates.includes(w.date)).forEach(w => { (by[w.tag] ??= { n: 0, m: 0 }); by[w.tag].n++; by[w.tag].m += w.dur; });
  return Object.entries(by).sort((a, b) => b[1].m - a[1].m);
}
export function pulseBySlot(dates, type) {
  const out = Object.fromEntries(SLOTS.map(s => [s.id, 0]));
  S.pulses.filter(p => p.type === type && p.end != null && dates.includes(p.date)).forEach(p => (out[slotOf(p.start).id] += p.end - p.start));
  return out;
}
export const pulseMinutes = (dates, type) => Object.values(pulseBySlot(dates, type)).reduce((a, b) => a + b, 0);
export function topSlot(bySlot) {
  const best = Object.entries(bySlot).sort((a, b) => b[1] - a[1])[0];
  return best && best[1] > 0 ? SLOTS.find(s => s.id === best[0]) : null;
}
export function energyBySlot(dates) {
  const acc = Object.fromEntries(SLOTS.map(s => [s.id, { sum: 0, n: 0 }]));
  S.checkins.filter(c => !c.estimated && c.values.energie != null && dates.includes(c.date)).forEach(c => {
    const a = acc[slotOf(c.start).id]; a.sum += c.values.energie; a.n++;
  });
  return SLOTS.map(s => ({ ...s, n: acc[s.id].n, avg: acc[s.id].n ? acc[s.id].sum / acc[s.id].n : null }));
}

// Semaines (lundis) de la plus ancienne à la plus récente
export function lastMondays(n) {
  const m = mondayOf(today());
  return Array.from({ length: n }, (_, i) => addDays(m, -7 * (n - 1 - i)));
}
export const weekDays = monday => weekDates(monday);

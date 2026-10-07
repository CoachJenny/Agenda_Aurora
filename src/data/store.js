// État de l'appli, stocké sur le téléphone (localStorage).
// Les collections reprennent la forme des futures tables Supabase : un enregistrement = une ligne, avec un id uuid et une date.

import { DEFAULT_WB, DEFAULT_THEMES } from './constants.js';
import { today, mondayOf, addDays, nowMin, weekDates, weekday, parse } from '../lib/time.js';

const KEY = 'aurora-journal-v1';
const SCHEMA = 1;

export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36));

const empty = () => ({
  schema: SCHEMA,
  blocks: [],        // { id, layer: 'plan'|'real', date, start, end, theme, title, note, fixed, fromId?, status?, replacedBy? }
  locked: {},        // date -> horodatage : le plan du jour est figé, les changements vont dans le réel
  checkins: [],      // { id, date, start, end, values, notes, event, social, estimated }
  pulses: [],        // { id, type: 'flow'|'procra', date, start, end, note, feel }
  wellbeing: [],     // { id, date, start, tag, dur }
  rituals: {},       // date -> { open, close, sleep, agenda, prio, factors, debrief }
  weekPrios: {},     // lundi -> [thèmes]
  dayPrios: {},      // date -> [thèmes]
  checklists: {},    // lundi -> { agendas, dejeuners, contraintes }
  body: [],          // { id, tag, from, to }
  wbTags: DEFAULT_WB.map(t => ({ ...t })),
  themes: DEFAULT_THEMES.map(t => ({ ...t })),   // catégories de l'agenda, personnalisables
  recurring: [],     // moments fixes : { id, title, theme, days: [0..6], start, end }
  recApplied: {},    // lundi -> [id des moments fixes déjà posés cette semaine-là]
  profile: { done: false, name: '', kids: null, sports: [], custody: null },
  // custody : { refMonday: lundi d'une semaine A, grid: { A: [[matin, soir] × 7], B: [...] } } en garde partagée
  isSample: false
});

export let S = load();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return migrate({ ...empty(), ...JSON.parse(raw) });
  } catch (e) { /* stockage indisponible : on démarre vide */ }
  return empty();
}

function migrate(x) {
  x.blocks.forEach(b => { b.layer ??= 'plan'; });
  x.locked ??= {};
  x.themes ??= DEFAULT_THEMES.map(t => ({ ...t }));
  x.recurring ??= [];
  x.recApplied ??= {};
  x.profile ??= { done: false, name: '', kids: null, sports: [] };
  return x;
}

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); return true; }
  catch (e) { return false; }
}

export function resetAll() { S = empty(); save(); }

export const onDate = (coll, date) => S[coll].filter(x => x.date === date);
export const removeById = (coll, id) => { S[coll] = S[coll].filter(x => x.id !== id); };
export const ritual = date => (S.rituals[date] ??= {});
export const hasAnyData = () => S.profile.done || S.blocks.length + S.checkins.length + S.pulses.length + S.wellbeing.length + Object.keys(S.rituals).length > 0;

// Priorités : celles de la semaine, sinon celles de la semaine précédente (on ne repart pas de zéro chaque lundi).
export function weekPrios(monday) {
  if (S.weekPrios[monday]) return S.weekPrios[monday];
  const prev = Object.keys(S.weekPrios).filter(k => k < monday).sort().pop();
  return prev ? S.weekPrios[prev] : [];
}
export const dayPrios = date => S.dayPrios[date] || weekPrios(mondayOf(date));

// ---------- Catégories ----------
const FALLBACK = { id: 'autre', name: 'Autre', c: '--t-maison' };
export const themes = () => S.themes;
export const theme = id => S.themes.find(t => t.id === id) || DEFAULT_THEMES.find(t => t.id === id) || FALLBACK;

// ---------- Garde partagée : semaines A et B, matins et soirs avec les enfants ----------
export function weekType(monday) {
  const c = S.profile.custody;
  if (!c) return null;
  const weeks = Math.round((parse(monday) - parse(c.refMonday)) / (7 * 864e5));
  return Math.abs(weeks) % 2 === 0 ? 'A' : 'B';
}
// half : 0 = matin, 1 = soir. Sans garde partagée, les enfants sont toujours là.
export function kidsPresent(date, half) {
  const c = S.profile.custody;
  if (!c) return true;
  return !!c.grid[weekType(mondayOf(date))][weekday(date)][half];
}
export const isKidsRule = r => !!r.kids || r.theme === 'enfants';
export const ruleHalf = r => r.half ?? (r.start < 12 * 60 ? 0 : 1);
const ruleApplies = (r, date) => !isKidsRule(r) || kidsPresent(date, ruleHalf(r));

// ---------- Moments fixes : posés automatiquement dans le plan, semaine après semaine ----------
export function applyRecurring(monday) {
  const applied = (S.recApplied[monday] ??= []);
  let changed = false;
  S.recurring.forEach(rule => {
    if (applied.includes(rule.id)) return;
    weekDates(monday).forEach((d, i) => {
      if (!rule.days.includes(i) || d < today() || isLocked(d) || !ruleApplies(rule, d)) return;
      if (S.blocks.some(b => b.ruleId === rule.id && b.date === d && b.layer !== 'real')) return;
      S.blocks.push({ id: uid(), layer: 'plan', ruleId: rule.id, date: d, start: rule.start, end: rule.end, theme: rule.theme, title: rule.title, note: '', fixed: true });
    });
    applied.push(rule.id);
    changed = true;
  });
  if (changed) save();
}
const ruleKey = r => JSON.stringify([r.title, r.theme, r.days, r.start, r.end, r.half ?? null]);
// Remplace les moments fixes ; seuls ceux qui ont changé sont reposés dans les jours à venir.
export function replaceRecurring(next, forceIds = []) {
  const nextById = Object.fromEntries(next.map(r => [r.id, r]));
  const changedIds = [...S.recurring.filter(r => !nextById[r.id] || ruleKey(r) !== ruleKey(nextById[r.id])).map(r => r.id), ...forceIds];
  S.blocks = S.blocks.filter(b => !(b.ruleId && changedIds.includes(b.ruleId) && b.layer !== 'real' && b.date >= today() && !isLocked(b.date)));
  const mon = mondayOf(today());
  Object.keys(S.recApplied).forEach(k => { if (k >= mon) S.recApplied[k] = S.recApplied[k].filter(id => !changedIds.includes(id)); });
  S.recurring = next;
  applyRecurring(mon);
  applyRecurring(addDays(mon, 7));
  save();
}

// ---------- Prévu / réel ----------
// Avant le début de la journée, on modifie le plan. Une fois la journée commencée (plan figé),
// le plan reste intact et les changements vont dans une copie « réel », pour comparer le soir.
export const isLocked = date => !!S.locked[date];
export const planBlocks = date => S.blocks.filter(b => b.date === date && b.layer !== 'real');
export const realBlocks = date => S.blocks.filter(b => b.date === date && b.layer === 'real');
export const effectiveBlocks = date => isLocked(date) ? realBlocks(date) : planBlocks(date);
export const realOf = p => S.blocks.find(b => b.layer === 'real' && b.fromId === p.id);

const realCopy = p => ({ id: uid(), layer: 'real', fromId: p.id, date: p.date, start: p.start, end: p.end, theme: p.theme, title: p.title, note: p.note, fixed: p.fixed });

export function lockDay(date) {
  if (isLocked(date)) return false;
  planBlocks(date).forEach(p => S.blocks.push(realCopy(p)));
  S.locked[date] = new Date().toISOString();
  save();
  return true;
}

// Bilan du soir : fait, en partie, pas fait, remplacé. Le réel suit.
export function setStatus(p, st) {
  lockDay(p.date);
  p.status = p.status === st ? null : st;
  const r = realOf(p);
  if (p.status === 'non') { if (r) removeById('blocks', r.id); }
  else if (!r) S.blocks.push(realCopy(p));
  if (p.status !== 'remplace') { delete p.replacedBy; const rr = realOf(p); if (rr && rr.title !== p.title && rr.replaced) { rr.title = p.title; delete rr.replaced; } }
  save();
}
export function setReplacement(p, text) {
  p.replacedBy = text;
  const r = realOf(p);
  if (r) { r.title = text || p.title; r.replaced = !!text; }
  save();
}

export const runningPulse = type => S.pulses.find(p => p.type === type && p.end == null && p.date === today());

export function bodyOn(date) {
  return S.body.find(b => b.from <= date && (!b.to || b.to >= date));
}

// ---------- Export / import : le filet de sécurité de la cliente ----------
export function exportJSON() {
  return JSON.stringify({ app: 'aurora', exportedAt: new Date().toISOString(), data: S }, null, 2);
}
export function importJSON(text) {
  const parsed = JSON.parse(text);
  const data = parsed && parsed.app === 'aurora' ? parsed.data : null;
  if (!data || !Array.isArray(data.blocks)) throw new Error('Ce fichier ne vient pas d\'Aurora.');
  S = migrate({ ...empty(), ...data });
  save();
}

// ---------- Semaine d'exemple, pour découvrir l'appli ----------
export function loadSample() {
  const mon = mondayOf(today());
  const d = i => addDays(mon, i);
  const t = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
  const b = (i, s, e, theme, title, fixed, note) => ({ id: uid(), layer: 'plan', date: d(i), start: t(s), end: t(e), theme, title, fixed: !!fixed, note: note || '' });
  const ci = (i, s, values, extra = {}) => ({ id: uid(), date: d(i), start: t(s), end: null, values, notes: {}, event: '', social: { modes: [], note: '' }, estimated: false, ...extra });
  const x = empty();
  x.isSample = true;
  x.blocks = [
    b(0, '08:00', '08:45', 'enfants', 'École', 1), b(0, '09:30', '12:00', 'travail', 'Proposition client'), b(0, '12:30', '13:30', 'repas', 'Déjeuner dehors avec Lou'),
    b(0, '14:00', '15:00', 'prospect', 'Appel découverte'), b(0, '16:30', '17:30', 'enfants', "Sortie d'école", 1), b(0, '18:00', '19:00', 'sport', 'Course'), b(0, '20:30', '22:00', 'libre', 'Série'),
    b(1, '08:00', '08:45', 'enfants', 'École', 1), b(1, '09:00', '11:00', 'travail', 'Atelier offre'), b(1, '11:30', '12:30', 'client', 'Séance client'),
    b(1, '12:30', '13:15', 'repas', 'Sur le pouce'), b(1, '13:15', '13:30', 'bienetre', 'Marche'), b(1, '14:00', '16:00', 'travail', 'Compta du mois', 0, 'Relancer 2 factures'),
    b(1, '16:30', '17:30', 'enfants', "Sortie d'école", 1), b(1, '19:30', '20:30', 'repas', 'Dîner'), b(1, '21:00', '22:00', 'libre', 'Lecture'),
    b(2, '09:00', '12:00', 'travail', 'Écriture contenu'), b(2, '14:00', '15:00', 'prospect', 'Visio prospect'), b(2, '15:00', '18:00', 'enfants', 'Mercredi enfants', 1),
    b(3, '10:00', '11:00', 'sport', 'Yoga'), b(3, '11:00', '13:00', 'travail', 'Préparation atelier'), b(3, '15:30', '15:45', 'bienetre', 'Méditation'), b(3, '18:00', '19:00', 'maison', 'Courses'),
    b(4, '09:00', '12:00', 'travail', 'Admin & factures'), b(4, '12:30', '14:00', 'repas', 'Déjeuner réseau'), b(4, '14:00', '14:15', 'bienetre', 'Marche'), b(4, '15:00', '16:00', 'client', 'Séance client'),
    b(5, '10:00', '12:00', 'sorties', 'Marché + café'), b(5, '15:00', '18:00', 'libre', 'Rien de prévu'),
    b(6, '11:00', '13:00', 'repas', 'Déjeuner famille')
  ];
  x.checkins = [
    ci(0, '08:30', { energie: 3, emotion: 5, corps: 6, anxiete: 4, sens: 3 }),
    ci(0, '11:00', { energie: 8, emotion: 7 }),
    ci(0, '13:40', { energie: 5, emotion: 6 }, { social: { modes: ['en face'], note: "Lou, ça m'a fait du bien" } }),
    ci(0, '15:00', { energie: 2, emotion: 3, anxiete: 7, corps: 3 }, { notes: { corps: 'ventre noué' }, event: 'Appel prospect plus long que prévu', social: { modes: ['au téléphone'], note: 'le prospect' } }),
    ci(0, '18:30', { energie: 5, emotion: 6 }),
    ci(0, '21:30', { energie: 4, emotion: 7 }),
    ci(1, '08:40', { energie: 2, emotion: 5, sens: 2 }),
    ci(1, '10:30', { energie: 7, emotion: 8, ennui: 1 }, { social: { modes: ['par messages'], note: "groupe d'entrepreneures" } })
  ];
  x.pulses = [
    { id: uid(), type: 'flow', date: d(0), start: t('09:50'), end: t('11:20'), note: 'Proposition client', feel: "ça m'a nourrie" },
    { id: uid(), type: 'procra', date: d(0), start: t('15:20'), end: t('15:50'), note: 'le mail de relance' },
    { id: uid(), type: 'flow', date: d(1), start: t('09:15'), end: t('10:40'), note: 'Atelier offre', feel: "ça m'a nourrie" }
  ];
  x.wellbeing = [
    { id: uid(), date: d(0), start: t('12:05'), tag: 'Marche', dur: 15 },
    { id: uid(), date: d(0), start: t('16:00'), tag: 'Musique', dur: 10 },
    { id: uid(), date: d(1), start: t('11:05'), tag: 'Respiration', dur: 5 },
    { id: uid(), date: d(1), start: t('13:20'), tag: 'Snack healthy', dur: 5 }
  ];
  x.weekPrios[mon] = ['prospect', 'sport', 'libre'];
  x.dayPrios[d(1)] = ['prospect', 'libre'];
  x.rituals[d(0)] = { open: 'brouillard', close: 'rebond', sleep: 3, agenda: true, prio: 'en partie' };
  x.rituals[d(1)] = { open: 'curieuse', sleep: 4, agenda: true };
  x.body = [{ id: uid(), tag: 'règles', from: d(0), to: null }];
  S = x;
  // Lundi : journée figée et bilan du soir fait. Mardi : journée figée, bilan pas encore fait.
  const find = (i, title, layer = 'plan') => S.blocks.find(k => k.date === d(i) && k.title === title && k.layer === layer);
  if (d(0) <= today()) {
    lockDay(d(0));
    const appel = find(0, 'Appel découverte', 'real'); appel.end = t('15:30');
    S.blocks.push({ id: uid(), layer: 'real', date: d(0), start: t('15:45'), end: t('16:15'), theme: 'travail', title: 'Relances mails', note: '', fixed: false });
    ['École', 'Proposition client', 'Déjeuner dehors avec Lou', 'Appel découverte', "Sortie d'école", 'Série'].forEach(n => (find(0, n).status = 'fait'));
    setStatus(find(0, 'Course'), 'non');
  }
  if (d(1) <= today()) {
    lockDay(d(1));
    const compta = find(1, 'Compta du mois', 'real'); compta.start = t('14:30'); compta.end = t('15:30');
  }
  save();
}

export { nowMin };

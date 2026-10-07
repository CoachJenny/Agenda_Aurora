// Petits outils d'interface : échappement, toast, feuille du bas, menus d'heures, couleurs d'aurore.

import { H0, H1, hm, toTime, fromTime } from './time.js';

export const $ = id => document.getElementById(id);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let toastTimer;
export function toast(text) {
  const el = $('toast');
  el.textContent = text; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (el.hidden = true), 2400);
}

let lastFocus = null;
export function openSheet(html, bind) {
  lastFocus = document.activeElement;
  $('sheet').innerHTML = html;
  $('sheetWrap').hidden = false;
  bind && bind($('sheet'));
}
export function closeSheet() {
  $('sheetWrap').hidden = true;
  $('sheet').innerHTML = '';
  lastFocus && lastFocus.focus && lastFocus.focus({ preventScroll: true });
}
export function initSheet() {
  $('scrim').onclick = closeSheet;
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('sheetWrap').hidden) closeSheet(); });
}

// Champ d'heure : un vrai champ d'heure, modifiable à la minute (roulette sur iPhone, clavier ailleurs).
export function timeField(id, val, from = H0 * 60, to = H1 * 60) {
  const v = Math.max(from, Math.min(to, Math.round(val / 5) * 5));
  return `<input type="time" class="tf" id="${id}" value="${toTime(v)}" min="${toTime(from)}" max="${toTime(Math.min(to, 23 * 60 + 59))}" step="300">`;
}
export function readTime(root, id) {
  const x = root.querySelector('#' + id);
  return x && x.value ? fromTime(x.value) : NaN;
}
// Appelle fn(minutes) quand l'heure change (une heure vide est ignorée).
export function onTime(root, id, fn) {
  const x = root.querySelector('#' + id);
  if (!x) return;
  x.addEventListener('change', () => { const m = readTime(root, id); if (!isNaN(m)) fn(m); });
}
export function initTimeFields() { /* plus rien à préparer : champs d'heure natifs */ }


// Échelles d'aurore : violet → corail → or (le corail est la seule jonction entre violet et or, règle de la charte)
const lerp = (a, b, t) => a + (b - a) * t;
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const scale = stops => v => {
  v = Math.max(0, Math.min(10, v)) / 10;
  const n = stops.length - 1, i = Math.min(n - 1, Math.floor(v * n)), t = v * n - i, a = hex(stops[i]), b = hex(stops[i + 1]);
  return `rgb(${a.map((x, k) => Math.round(lerp(x, b[k], t))).join(',')})`;
};
export const energyCol = scale(['#1C1747', '#6B3FA0', '#B0558A', '#FF6B6B', '#FFE66D']);
export const emoCol = scale(['#2E2B4E', '#6B3FA0', '#9B6FCF', '#FF6B6B']);

// Rappel quotidien à ajouter au calendrier du téléphone (fichier .ics, sans serveur)
export function eveningIcs(minutes, appUrl) {
  const p = n => String(n).padStart(2, '0');
  const d = new Date(), ymd = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Nahara//Auror-Agenda//FR', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:aurora-soir-${Date.now()}@nahara`, `DTSTAMP:${stamp}`, `DTSTART:${ymd}T${p(Math.floor(minutes / 60))}${p(minutes % 60)}00`, 'DURATION:PT5M', 'RRULE:FREQ=DAILY',
    'SUMMARY:Auror-Agenda · le point du soir', `DESCRIPTION:Trois minutes pour clore la journée. ${appUrl}`, `URL:${appUrl}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Auror-Agenda · le point du soir', 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
}

export function download(filename, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
}

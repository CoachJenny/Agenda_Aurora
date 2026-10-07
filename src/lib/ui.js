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

// Champ d'heure : menu par tranches de 30 minutes, plus « Autre heure… » pour une heure précise.
export function timeField(id, val, from = H0 * 60, to = H1 * 60) {
  const v = Math.max(from, Math.min(to, Math.round(val / 5) * 5));
  const slots = [];
  for (let t = from; t <= to; t += 30) slots.push(t);
  const all = slots.includes(v) ? slots : [...slots, v].sort((a, b) => a - b);
  const opts = all.map(t => `<option value="${t}" ${t === v ? 'selected' : ''}>${hm(t)}</option>`).join('');
  return `<span class="tf"><select id="${id}" data-tf>${opts}<option value="autre">Autre heure…</option></select><input type="time" id="${id}-x" value="${toTime(v)}" hidden aria-label="Heure précise"></span>`;
}
export function readTime(root, id) {
  const x = root.querySelector('#' + id + '-x');
  if (x && !x.hidden) return fromTime(x.value);
  return +root.querySelector('#' + id).value;
}
// Appelle fn(minutes) quand l'heure change, que ce soit dans le menu ou en saisie libre.
export function onTime(root, id, fn) {
  const s = root.querySelector('#' + id), x = root.querySelector('#' + id + '-x');
  if (!s) return;
  s.addEventListener('change', () => { if (s.value !== 'autre') fn(readTime(root, id)); });
  x.addEventListener('change', () => fn(readTime(root, id)));
}
export function initTimeFields() {
  document.addEventListener('change', e => {
    const s = e.target;
    if (s.matches && s.matches('select[data-tf]') && s.value === 'autre') {
      const x = document.getElementById(s.id + '-x');
      s.hidden = true; x.hidden = false; x.focus();
      x.dispatchEvent(new Event('change', { bubbles: false }));
    }
  });
}

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

export function download(filename, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
}

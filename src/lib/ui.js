// Petits outils d'interface : échappement, toast, feuille du bas, menus d'heures, couleurs d'aurore.

import { H0, H1, hm, r15 } from './time.js';

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

// Menu déroulant d'heures par tranches de 15 minutes
export function slotSel(id, val, from = H0 * 60, to = H1 * 60) {
  val = Math.max(from, Math.min(to, r15(val)));
  let o = '';
  for (let t = from; t <= to; t += 15) o += `<option value="${t}" ${t === val ? 'selected' : ''}>${hm(t)}</option>`;
  return `<select id="${id}">${o}</select>`;
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

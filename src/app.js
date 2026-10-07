// État de navigation partagé par les écrans (onglet, jour et semaine affichés, brouillons).

import { today, mondayOf, nowMin } from './lib/time.js';

export const app = {
  tab: 'accueil',
  selDate: today(),             // jour affiché dans Planifier
  weekStart: mondayOf(today()), // semaine affichée (Planifier en mode semaine, Ma semaine)
  planMode: 'jour',
  ritMode: nowMin() < 14 * 60 ? 'matin' : 'soir',
  draft: null,                   // check-in en cours de saisie
  placing: null                  // tâche en train d'être placée dans l'agenda
};

let renderer = () => {};
export const setRenderer = fn => { renderer = fn; };
export const render = () => renderer();

export function go(tab, opts = {}) {
  Object.assign(app, opts, { tab });
  render();
  window.scrollTo(0, 0);
}

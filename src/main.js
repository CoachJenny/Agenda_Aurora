// Point d'entrée : styles, navigation entre les onglets, service worker.

import './styles/tokens.css';
import './styles/app.css';
import { registerSW } from 'virtual:pwa-register';

import { app, setRenderer, go } from './app.js';
import { $, initSheet, initTimeFields } from './lib/ui.js';
import { longDate, today } from './lib/time.js';
import { renderAccueil, bindAccueil } from './views/accueil.js';
import { renderPlan, bindPlan } from './views/plan.js';
import { renderJournee, bindJournee } from './views/journee.js';
import { scrollToNow } from './views/timeline.js';
import { renderCheckin, bindCheckin } from './views/checkin.js';
import { renderRituels, bindRituels } from './views/rituels.js';
import { renderSemaine, bindSemaine } from './views/semaine.js';
import { renderPulse, initPulses } from './views/pulses.js';
import { openSettings } from './views/reglages.js';
import { renderGuide, bindGuide } from './views/guide.js';
import { applyRecurring } from './data/store.js';
import { mondayOf, addDays } from './lib/time.js';

const VIEWS = {
  accueil: [renderAccueil, bindAccueil],
  plan: [renderPlan, bindPlan],
  journee: [renderJournee, bindJournee],
  checkin: [renderCheckin, bindCheckin],
  rituels: [renderRituels, bindRituels],
  semaine: [renderSemaine, bindSemaine],
  guide: [renderGuide, bindGuide]
};

let lastTab = null;
function render() {
  const v = $('view');
  // Moments fixes : posés dans la semaine en cours, la suivante, et celle qu'on regarde
  const mon = mondayOf(today());
  [mon, addDays(mon, 7), mondayOf(app.selDate), app.weekStart].forEach(applyRecurring);
  document.body.classList.toggle('in-guide', app.tab === 'guide');
  const [draw, bind] = VIEWS[app.tab] || VIEWS.accueil;
  v.innerHTML = draw();
  bind(v);
  document.querySelectorAll('nav.tabs [data-tab]').forEach(b => b.setAttribute('aria-current', b.dataset.tab === app.tab));
  $('today').textContent = longDate(today());
  renderPulse();
  if ((app.tab === 'plan' || app.tab === 'journee') && lastTab !== app.tab) scrollToNow();
  lastTab = app.tab;
}
setRenderer(render);

document.querySelectorAll('nav.tabs [data-tab]').forEach(b => b.onclick = () => go(b.dataset.tab));
$('home').onclick = e => { e.preventDefault(); go('accueil'); };
$('settings').onclick = openSettings;
initSheet();
initTimeFields();
initPulses();
render();

// Quand on revient sur l'appli un autre jour, on rafraîchit la date et l'accueil.
document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });

registerSW({ immediate: true });

// Point d'entrée : styles, navigation entre les onglets, service worker.

import './styles/tokens.css';
import './styles/app.css';
import { registerSW } from 'virtual:pwa-register';

import { app, setRenderer, go } from './app.js';
import { $, initSheet } from './lib/ui.js';
import { longDate, today } from './lib/time.js';
import { renderAccueil, bindAccueil } from './views/accueil.js';
import { renderPlan, bindPlan, scrollToNow } from './views/plan.js';
import { renderCheckin, bindCheckin } from './views/checkin.js';
import { renderRituels, bindRituels } from './views/rituels.js';
import { renderSemaine, bindSemaine } from './views/semaine.js';
import { renderPulse, initPulses } from './views/pulses.js';
import { openSettings } from './views/reglages.js';

const VIEWS = {
  accueil: [renderAccueil, bindAccueil],
  plan: [renderPlan, bindPlan],
  checkin: [renderCheckin, bindCheckin],
  rituels: [renderRituels, bindRituels],
  semaine: [renderSemaine, bindSemaine]
};

let lastTab = null;
function render() {
  const v = $('view');
  const [draw, bind] = VIEWS[app.tab] || VIEWS.accueil;
  v.innerHTML = draw();
  bind(v);
  document.querySelectorAll('nav.tabs [data-tab]').forEach(b => b.setAttribute('aria-current', b.dataset.tab === app.tab));
  $('today').textContent = longDate(today());
  renderPulse();
  if (app.tab === 'plan' && lastTab !== 'plan') scrollToNow();
  lastTab = app.tab;
}
setRenderer(render);

document.querySelectorAll('nav.tabs [data-tab]').forEach(b => b.onclick = () => go(b.dataset.tab));
$('home').onclick = e => { e.preventDefault(); go('accueil'); };
$('settings').onclick = openSettings;
initSheet();
initPulses();
render();

// Quand on revient sur l'appli un autre jour, on rafraîchit la date et l'accueil.
document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });

registerSW({ immediate: true });

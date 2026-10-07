// Accueil : guide vers l'étape qui correspond au moment.

import { go } from '../app.js';
import { S, onDate, ritual, weekPrios, hasAnyData, loadSample, effectiveBlocks } from '../data/store.js';
import { nowMin, today, mondayOf, weekday } from '../lib/time.js';
import { esc, toast } from '../lib/ui.js';
import { render } from '../app.js';

const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
let hideInstall = false;
try { hideInstall = localStorage.getItem('aurora-hide-install') === '1'; } catch (e) { /* rien */ }

function installCard() {
  if (isStandalone() || hideInstall) return '';
  const how = isIOS()
    ? 'Dans Safari, touche le bouton Partager, puis « Sur l\'écran d\'accueil ».'
    : 'Dans le menu du navigateur, choisis « Installer l\'application » ou « Ajouter à l\'écran d\'accueil ».';
  return `<div class="card stack" style="margin-top:16px;border-color:rgb(255 230 109 / .4)"><b style="font-weight:600">Installe Aurora sur ton téléphone</b><p class="lead" style="margin:0">${how} Elle s'ouvrira comme une appli, en plein écran.</p><div><button class="link" type="button" id="hideInstall">C'est fait, ne plus afficher</button></div></div>`;
}

export function renderAccueil() {
  if (!hasAnyData()) {
    return `<div class="emptyhero"><p class="home-hello">Bienvenue dans <em>Aurora</em></p>
    <p class="lead">Prévoir ta semaine, noter comment tu la vis, la relire en séance. Quelques minutes par jour, pas plus.</p>
    <div class="stack" style="max-width:320px;margin:0 auto"><button class="btn" type="button" id="start">Planifier ma première semaine</button><button class="btn ghost" type="button" id="sample">Découvrir avec une semaine d'exemple</button></div></div>${installCard()}`;
  }
  const d = today(), m = nowMin(), r = ritual(d), wd = weekday(d);
  const ciToday = onDate('checkins', d).filter(c => !c.estimated).length;
  const blocksToday = effectiveBlocks(d).length;
  const prios = weekPrios(mondayOf(d));
  const closed = !!(r.close || r.prio);
  let rec;
  if ((wd === 6 && m >= 15 * 60) || (wd === 0 && m < 10 * 60 && !r.open) || !prios.length) rec = 'semaine';
  else if (m < 11 * 60 && !r.open) rec = 'matin';
  else if (m >= 19 * 60 && !closed) rec = 'soir';
  else rec = 'checkin';
  const steps = [
    { k: 'semaine', grp: 'Ma semaine', ic: '◇', hue: 'var(--violet)', t: 'Planifier ma semaine', ss: 'Priorités, checklist, blocs · 10 min', st: prios.length ? `${prios.length} priorité${prios.length > 1 ? 's' : ''}` : 'à faire', ok: !!prios.length },
    { k: 'jour', grp: 'Ma journée', ic: '▤', hue: 'var(--t-client)', t: 'Revoir le plan de la journée', ss: 'Déplacer, enrichir, voir mon vécu', st: `${blocksToday} bloc${blocksToday > 1 ? 's' : ''}` },
    { k: 'matin', ic: '☀', hue: 'var(--gold)', t: 'Ouvrir la journée', ss: 'Un mot, la nuit, les priorités · 1 min', st: r.open ? `« ${esc(r.open)} »` : 'à faire', ok: !!r.open },
    { k: 'checkin', ic: '≈', hue: 'var(--turq)', t: 'Faire un check-in', ss: "Où j'en suis, là, maintenant · 30 s", st: ciToday ? `${ciToday} aujourd'hui` : 'aucun encore', ok: ciToday > 0 },
    { k: 'soir', ic: '☾', hue: 'var(--violet)', t: 'Clore la journée', ss: 'Ce qui a bougé, un mot pour sortir · 3 min', st: closed ? (r.close ? `« ${esc(r.close)} »` : 'fait') : 'ce soir', ok: closed },
    { k: 'recap', grp: 'Et ensuite', ic: '✦', hue: 'var(--coral)', t: 'Le récap de ma semaine', ss: "L'histoire en mots, l'aurore jour par jour", st: '' }
  ];
  const hello = m < 12 * 60 ? 'Bonjour' : m < 18 * 60 ? 'Bel après-midi' : 'Bonsoir';
  let h = `<p class="home-hello">${hello}, <em>par quoi on commence ?</em></p><p class="lead">L'étape mise en avant correspond au moment de la journée. Tu peux toujours choisir une autre porte.</p>`;
  if (S.isSample) h += `<div class="card" style="border-style:dashed"><p class="lead" style="margin:0">Tu regardes une semaine d'exemple. Quand tu es prête, efface-la depuis les réglages (roue en haut à droite).</p></div>`;
  h += `<div class="steps">`;
  steps.forEach(s => {
    if (s.grp) h += `<p class="grouplab">${s.grp}</p>`;
    h += `<button type="button" class="stepc ${s.k === rec ? 'now' : ''}" data-go="${s.k}" style="--hue:${s.hue}"><span class="ico" aria-hidden="true">${s.ic}</span><span>${s.k === rec ? '<span class="nowtag">Maintenant</span><br>' : ''}<span class="tt">${s.t}</span><div class="ss">${s.ss}</div></span><span class="st ${s.ok ? 'ok' : ''}">${s.st}</span></button>`;
  });
  return h + `</div>${installCard()}`;
}

export function bindAccueil(v) {
  const q = s => v.querySelector(s);
  q('#start')?.addEventListener('click', () => go('plan', { planMode: 'semaine', weekStart: mondayOf(today()) }));
  q('#sample')?.addEventListener('click', () => { loadSample(); render(); toast("Semaine d'exemple chargée"); });
  q('#hideInstall')?.addEventListener('click', () => { hideInstall = true; try { localStorage.setItem('aurora-hide-install', '1'); } catch (e) { /* rien */ } render(); });
  v.querySelectorAll('[data-go]').forEach(b => b.onclick = () => {
    const k = b.dataset.go, d = today();
    if (k === 'semaine') go('plan', { planMode: 'semaine', weekStart: mondayOf(d) });
    else if (k === 'jour') go('plan', { planMode: 'jour', selDate: d });
    else if (k === 'matin') go('rituels', { ritMode: 'matin' });
    else if (k === 'soir') go('rituels', { ritMode: 'soir' });
    else if (k === 'checkin') go('checkin');
    else go('semaine', { weekStart: mondayOf(d) });
  });
}

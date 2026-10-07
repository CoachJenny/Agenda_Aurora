// Réglages : sauvegarde, restauration, exemple, effacement.

import { render, go } from '../app.js';
import { S, exportJSON, importJSON, loadSample, resetAll } from '../data/store.js';
import { today } from '../lib/time.js';
import { startGuide } from './guide.js';
import { openSheet, closeSheet, toast, download } from '../lib/ui.js';

export function openSettings() {
  openSheet(`<h4>Réglages et paramétrage</h4>
  <p class="lead" style="margin:0">Pour l'instant, ton journal est enregistré sur ce téléphone uniquement. Fais une sauvegarde de temps en temps : c'est ton filet de sécurité.</p>
  <div class="card stack">
    <b style="font-weight:600">Mon Aurora</b>
    <p class="lead" style="margin:0">Tes catégories, tes moments fixes, tes enfants, ton sport, tes moments bien-être.</p>
    <div><button class="btn small" type="button" id="guide">Personnaliser mon expérience</button></div>
  </div>
  <div class="card stack">
    <button class="btn" type="button" id="exp">Télécharger une sauvegarde</button>
    <label class="btn ghost" style="text-align:center;cursor:pointer">Restaurer une sauvegarde<input type="file" id="imp" accept="application/json,.json" hidden></label>
  </div>
  <div class="card stack">
    <div id="sampleZone"><button class="link" type="button" id="sample">Charger la semaine d'exemple</button></div>
    <div id="wipeZone"><button class="link danger" type="button" id="wipe">Tout effacer</button></div>
  </div>
  <p class="lead" style="margin:0;font-size:12px">Aurora v0.8 · Nahara</p>
  <button class="btn ghost small" type="button" id="close">Fermer</button>`, sh => {
    const q = s => sh.querySelector(s);
    q('#close').onclick = closeSheet;
    q('#guide').onclick = () => { closeSheet(); startGuide(); };
    q('#exp').onclick = () => { download(`aurora-sauvegarde-${today()}.json`, exportJSON()); toast('Sauvegarde téléchargée'); };
    q('#imp').onchange = async e => {
      const f = e.target.files[0]; if (!f) return;
      try { importJSON(await f.text()); closeSheet(); go('accueil'); toast('Sauvegarde restaurée'); }
      catch (err) { toast(err.message || 'Ce fichier ne peut pas être lu'); }
    };
    const confirmIn = (zone, text, label, action) => {
      q(zone).innerHTML = `<p class="lead" style="margin:0 0 8px">${text}</p><div class="row"><button class="btn small" type="button" data-yes>${label}</button><button class="btn ghost small" type="button" data-no>Annuler</button></div>`;
      q(zone + ' [data-yes]').onclick = action;
      q(zone + ' [data-no]').onclick = () => { closeSheet(); openSettings(); };
    };
    q('#sample').onclick = () => confirmIn('#sampleZone', S.isSample || !S.blocks.length ? "La semaine d'exemple remplace le contenu actuel." : 'Attention : la semaine d\'exemple remplace ton journal actuel. Télécharge une sauvegarde avant si besoin.', 'Charger', () => { loadSample(); closeSheet(); go('accueil'); toast("Semaine d'exemple chargée"); });
    q('#wipe').onclick = () => confirmIn('#wipeZone', 'Tout ton journal sera effacé de ce téléphone. Cette action ne peut pas être annulée.', 'Tout effacer', () => { resetAll(); closeSheet(); go('accueil'); toast('Journal effacé'); });
  });
}

export { render };

// Réglages : compte, sauvegarde, restauration, effacement.

import { render, go } from '../app.js';
import { S, exportJSON, importJSON, resetAll } from '../data/store.js';
import { today } from '../lib/time.js';
import { startGuide } from './guide.js';
import { openSheet, closeSheet, toast, download, esc } from '../lib/ui.js';
import * as cloud from '../lib/cloud.js';

// Carte « Mon compte » : connexion par code à 6 chiffres, puis état de la synchronisation.
let acct = { step: 'email', email: '' };
const hhmm = iso => { const d = new Date(iso); if (isNaN(d)) return 'récemment'; return 'le ' + d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h'); };
const STATUS = {
  ok: () => cloud.lastSync() ? `Synchronisé ${hhmm(cloud.lastSync())}` : 'Synchronisé',
  envoi: () => 'Envoi en cours…',
  horsligne: () => 'Hors ligne : tes modifications partiront au retour du réseau',
  erreur: () => 'La dernière synchronisation n\'a pas abouti, on réessaie au prochain retour dans l\'appli'
};

function accountHTML() {
  if (cloud.user) {
    return `<b style="font-weight:600">Mon compte</b>
    <p class="lead" style="margin:0">Connectée avec <b>${esc(cloud.user.email)}</b>. Ton journal est enregistré dans ton compte à chaque modification.</p>
    <p class="lead" style="margin:0;font-size:13px" id="syncSt">${(STATUS[cloud.status] || STATUS.ok)()}</p>
    <div class="row"><button class="btn small" type="button" id="syncNow">Synchroniser maintenant</button><button class="btn ghost small" type="button" id="logout">Me déconnecter</button></div>`;
  }
  if (acct.step === 'choix' && cloud.pendingDate()) {
    return `<b style="font-weight:600">Deux journaux</b>
    <p class="lead" style="margin:0">Ton compte contient déjà un journal (modifié ${hhmm(cloud.pendingDate())}), et ce téléphone aussi. Lequel veux-tu garder ?</p>
    <button class="btn" type="button" id="pickCompte">Reprendre celui de mon compte</button>
    <button class="btn ghost" type="button" id="pickTel">Garder celui de ce téléphone</button>
    <p class="lead" style="margin:0;font-size:13px">L'autre version reste en copie de secours sur ce téléphone.</p>`;
  }
  if (acct.step === 'code') {
    return `<b style="font-weight:600">Ton code</b>
    <p class="lead" style="margin:0">Un code vient de partir à <b>${esc(acct.email)}</b>. S'il n'arrive pas, regarde dans tes indésirables.</p>
    <input class="field" id="otp" inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="123456" style="font-size:22px;letter-spacing:.3em;text-align:center">
    <button class="btn" type="button" id="verify">Valider</button>
    <div class="row"><button class="link" type="button" id="resend">Renvoyer un code</button><button class="link" type="button" id="changeMail">Changer d'adresse</button></div>`;
  }
  return `<b style="font-weight:600">Mon compte</b>
  <p class="lead" style="margin:0">Facultatif. Ton journal est alors enregistré dans ton compte : il ne se perd pas avec ton téléphone, et tu le retrouves sur un autre appareil. Pas de mot de passe : tu reçois un code par e-mail.</p>
  <input class="field" id="mail" type="email" inputmode="email" autocomplete="email" placeholder="ton@email.fr" value="${esc(acct.email)}">
  <button class="btn" type="button" id="sendCode">Recevoir mon code</button>`;
}

function bindAccount(sh) {
  const zone = sh.querySelector('#acct');
  const q = s => zone.querySelector(s);
  const redraw = () => { zone.innerHTML = accountHTML(); bindAccount(sh); };
  const wait = (btn, label) => { btn.disabled = true; btn.textContent = label; };
  q('#sendCode') && (q('#sendCode').onclick = async e => {
    const email = q('#mail').value.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast('Vérifie ton adresse e-mail'); return; }
    wait(e.target, 'Envoi…');
    try { await cloud.sendCode(email); acct = { step: 'code', email }; redraw(); q('#otp')?.focus(); }
    catch (err) { toast(err.message); e.target.disabled = false; e.target.textContent = 'Recevoir mon code'; }
  });
  q('#verify') && (q('#verify').onclick = async e => {
    const code = q('#otp').value.replace(/\D/g, '');
    if (code.length < 6) { toast('Le code fait 6 chiffres'); return; }
    wait(e.target, 'Vérification…');
    try {
      const r = await cloud.verifyCode(acct.email, code);
      if (r === 'choix') { acct.step = 'choix'; redraw(); return; }
      acct = { step: 'email', email: '' };
      render(); redraw();
      toast(r === 'recupere' ? 'Ton journal est de retour' : 'Ton journal est enregistré dans ton compte');
    } catch (err) { toast(err.message); e.target.disabled = false; e.target.textContent = 'Valider'; }
  });
  q('#resend') && (q('#resend').onclick = async () => { try { await cloud.sendCode(acct.email); toast('Nouveau code envoyé'); } catch (err) { toast(err.message); } });
  q('#changeMail') && (q('#changeMail').onclick = () => { acct.step = 'email'; redraw(); });
  const pick = which => async e => {
    wait(e.target, 'Un instant…');
    try { await cloud.choose(which); acct = { step: 'email', email: '' }; render(); redraw(); toast(which === 'compte' ? 'Journal repris depuis ton compte' : 'Ton journal est enregistré dans ton compte'); }
    catch (err) { toast('Ça n\'a pas marché, réessaie'); redraw(); }
  };
  q('#pickCompte') && (q('#pickCompte').onclick = pick('compte'));
  q('#pickTel') && (q('#pickTel').onclick = pick('tel'));
  q('#syncNow') && (q('#syncNow').onclick = async e => { wait(e.target, 'Synchronisation…'); await cloud.syncNow({ quiet: false }); redraw(); });
  q('#logout') && (q('#logout').onclick = () => {
    q('#logout').parentElement.outerHTML = `<p class="lead" style="margin:0">Ton journal reste sur ce téléphone et dans ton compte. Tu pourras te reconnecter avec un nouveau code.</p><div class="row"><button class="btn small" type="button" id="logoutYes">Me déconnecter</button><button class="btn ghost small" type="button" id="logoutNo">Annuler</button></div>`;
    q('#logoutNo').onclick = redraw;
    q('#logoutYes').onclick = async () => { await cloud.signOut(); redraw(); toast('Déconnectée'); };
  });
}

export function openSettings() {
  openSheet(`<h4>Réglages et paramétrage</h4>
  <div class="card stack" id="acct">${accountHTML()}</div>
  <div class="card stack">
    <b style="font-weight:600">Mon paramétrage</b>
    <p class="lead" style="margin:0">Tes catégories, tes moments fixes, tes enfants, ton sport, tes moments bien-être.</p>
    <div><button class="btn small" type="button" id="guide">Personnaliser mon expérience</button></div>
  </div>
  <div class="card stack">
    <p class="lead" style="margin:0">Une copie de ton journal dans un fichier, à garder où tu veux.</p>
    <button class="btn" type="button" id="exp">Télécharger une sauvegarde</button>
    <label class="btn ghost" style="text-align:center;cursor:pointer">Restaurer une sauvegarde<input type="file" id="imp" accept="application/json,.json" hidden></label>
  </div>
  <div class="card stack">
    <div id="wipeZone"><button class="link danger" type="button" id="wipe">Tout effacer</button></div>
  </div>
  <p class="lead" style="margin:0;font-size:12px">Auror-Agenda v0.12 · le planner qui ne te juge pas · Nahara</p>
  <button class="btn ghost small" type="button" id="close">Fermer</button>`, sh => {
    const q = s => sh.querySelector(s);
    q('#close').onclick = closeSheet;
    bindAccount(sh);
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
    q('#wipe').onclick = () => confirmIn('#wipeZone', cloud.user ? 'Tout ton journal sera effacé de ce téléphone et de ton compte. Cette action ne peut pas être annulée.' : 'Tout ton journal sera effacé de ce téléphone. Cette action ne peut pas être annulée.', 'Tout effacer', () => { resetAll(); closeSheet(); go('accueil'); toast('Journal effacé'); });
  });
}

export { render };

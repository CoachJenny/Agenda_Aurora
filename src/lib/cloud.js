// Compte et synchronisation (Supabase, région UE).
// Le journal entier est enregistré d'un bloc dans le compte de la cliente, à chaque modification.
// Le compte est facultatif : sans connexion, l'appli fonctionne comme avant, sur le téléphone seulement.

import { createClient } from '@supabase/supabase-js';
import { S, setSaveHook, replaceData, snapshot, hasAnyData } from '../data/store.js';
import { render } from '../app.js';
import { $, toast } from './ui.js';

const SUPABASE_URL = 'https://qrpzzbufiziiyekfqpvj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_z8HRb4q6qB0szTUn7SgiVQ_arUaxYAV'; // clé publique, faite pour être dans l'appli

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'aurora-auth' }
});

const META = 'aurora-sync';
// dirty : des modifications pas encore envoyées · localAt : heure de la dernière modification ici
// remoteAt : version du compte connue de ce téléphone · lastSync : dernière synchro réussie
let meta = { dirty: false, localAt: null, remoteAt: null, lastSync: null };
try { meta = { ...meta, ...JSON.parse(localStorage.getItem(META) || '{}') }; } catch (e) { /* rien */ }
const saveMeta = () => { try { localStorage.setItem(META, JSON.stringify(meta)); } catch (e) { /* rien */ } };

export let user = null;
export let status = 'off'; // off · ok · envoi · horsligne · erreur
let listeners = [];
export const onStatus = fn => { listeners.push(fn); };
const setStatus = s => { status = s; listeners.forEach(fn => fn(s)); };
export const lastSync = () => meta.lastSync;

// ---------- Connexion par code reçu par e-mail ----------
export async function sendCode(email) {
  const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) throw new Error(frError(error));
}

// Renvoie 'choix' si le compte et le téléphone ont chacun un journal : la cliente choisit lequel garder.
export async function verifyCode(email, token) {
  const { data, error } = await sb.auth.verifyOtp({ email, token, type: 'email' });
  if (error) throw new Error(frError(error));
  meta = { dirty: false, localAt: null, remoteAt: null, lastSync: null }; saveMeta();
  const row = await fetchRow(true, data.user.id);
  if (!row) { user = data.user; await push(); return 'envoye'; }
  if (!hasAnyData()) { user = data.user; adopt(row); return 'recupere'; }
  // Rien n'est envoyé tant que la cliente n'a pas choisi
  pending = { row, user: data.user };
  meta.choice = true; saveMeta();
  return 'choix';
}
let pending = null;
export const pendingDate = () => pending?.row.updated_at;
export async function choose(which) {
  const p = pending; pending = null;
  if (!p) return;
  const row = p.row; user = p.user;
  delete meta.choice; saveMeta();
  backup(which === 'compte' ? snapshot() : row.data);
  if (which === 'compte') adopt(row);
  else await push();
}

export async function signOut() {
  if (meta.dirty) await push().catch(() => {});
  await sb.auth.signOut();
  user = null;
  meta = { dirty: false, localAt: null, remoteAt: null, lastSync: null }; saveMeta();
  setStatus('off');
}

// ---------- Synchronisation ----------
async function fetchRow(withData, id = user.id) {
  const { data, error } = await sb.from('journals').select(withData ? 'data, updated_at' : 'updated_at').eq('user_id', id).maybeSingle();
  if (error) throw error;
  return data;
}

let pushing = null;
async function push() {
  if (!user) return;
  if (pushing) { await pushing; if (!meta.dirty) return; }
  pushing = (async () => {
    setStatus('envoi');
    const { data, error } = await sb.from('journals').upsert({ user_id: user.id, data: S }).select('updated_at').single();
    if (error) throw error;
    meta.dirty = false; meta.remoteAt = data.updated_at; meta.lastSync = new Date().toISOString(); saveMeta();
    setStatus('ok');
  })();
  try { await pushing; } catch (e) { setStatus(navigator.onLine ? 'erreur' : 'horsligne'); throw e; } finally { pushing = null; }
}

function adopt(row) {
  replaceData(row.data);
  meta.dirty = false; meta.remoteAt = row.updated_at; meta.lastSync = new Date().toISOString(); saveMeta();
  setStatus('ok');
}

// Copie de secours de la version écartée, au cas où.
function backup(data) {
  try { localStorage.setItem('aurora-journal-ecarte', JSON.stringify({ at: new Date().toISOString(), data })); } catch (e) { /* rien */ }
}

const busy = () => !$('sheetWrap').hidden || document.body.classList.contains('in-guide');

// Au retour dans l'appli : on envoie ce qui attend, et on reprend la version du compte si un autre appareil l'a modifiée.
export async function syncNow({ quiet = true } = {}) {
  if (!user) return;
  try {
    const head = await fetchRow(false);
    if (!head) { await push(); return; }
    const remoteChanged = head.updated_at !== meta.remoteAt;
    if (!remoteChanged) { if (meta.dirty) await push(); else setStatus('ok'); return; }
    if (busy()) return; // on ne remplace rien pendant une saisie ; on réessaiera au prochain retour
    const row = await fetchRow(true);
    if (meta.dirty && meta.localAt && meta.localAt > row.updated_at) {
      backup(row.data); await push(); // la modification la plus récente est ici
    } else {
      if (meta.dirty) backup(snapshot());
      adopt(row); render();
      if (!quiet) toast('Journal mis à jour depuis ton compte');
    }
    if (!quiet) toast('Journal synchronisé');
  } catch (e) {
    setStatus(navigator.onLine ? 'erreur' : 'horsligne');
    if (!quiet) toast(navigator.onLine ? 'La synchronisation n\'a pas abouti' : 'Pas de connexion internet');
  }
}

let timer;
function markDirty() {
  meta.dirty = true; meta.localAt = new Date().toISOString(); saveMeta();
  if (!user) return;
  clearTimeout(timer);
  timer = setTimeout(() => push().catch(() => {}), 1500);
}

export async function initCloud() {
  setSaveHook(markDirty);
  try {
    const { data } = await sb.auth.getSession();
    user = data.session?.user || null;
  } catch (e) { user = null; }
  // Choix entre deux journaux laissé en plan : on repart déconnectée, rien n'a été écrasé
  if (user && meta.choice) { await sb.auth.signOut({ scope: 'local' }).catch(() => {}); user = null; delete meta.choice; saveMeta(); }
  window.addEventListener('online', () => syncNow());
  document.addEventListener('visibilitychange', () => {
    if (!user) return;
    if (document.hidden) { if (meta.dirty) { clearTimeout(timer); push().catch(() => {}); } }
    else syncNow();
  });
  if (!user) return;
  setStatus(meta.dirty ? 'envoi' : 'ok');
  await syncNow();
}

function frError(e) {
  const m = (e.message || '').toLowerCase();
  if (m.includes('expired') || m.includes('invalid')) return 'Ce code ne fonctionne pas ou a expiré. Demande-en un nouveau.';
  if (m.includes('rate') || m.includes('security purposes') || e.status === 429) return 'Trop de demandes d\'affilée. Attends une minute avant de redemander un code.';
  if (m.includes('email') && m.includes('valid')) return 'Cette adresse e-mail ne semble pas valide.';
  if (m.includes('fetch') || m.includes('network')) return 'Pas de connexion internet.';
  return 'Ça n\'a pas marché : ' + (e.message || 'erreur inconnue');
}

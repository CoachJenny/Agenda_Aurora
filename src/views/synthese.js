// Synthèse : un premier regard, peu d'informations, et le détail à un toucher.

import { go } from '../app.js';
import { today, mondayOf, weekDates, dur } from '../lib/time.js';
import { prioThreeWeeks, statusCounts, wbMinutes, pulseBySlot, pulseMinutes, topSlot } from '../data/stats.js';

export function renderSynthese() {
  const week = weekDates(mondayOf(today())).filter(d => d <= today());
  const { cur, better } = prioThreeWeeks();
  const st = statusCounts(week);
  const wb = wbMinutes(week);
  const flowSlots = pulseBySlot(week, 'flow'), flow = pulseMinutes(week, 'flow'), top = topSlot(flowSlots);

  const prioCard = cur.answered
    ? `<div class="v">${cur.held}<span class="of"> jours sur ${cur.answered}</span></div>
       <p class="s">Tu as tenu tes priorités ${cur.held} jour${cur.held > 1 ? 's' : ''} sur ${cur.answered} ces trois dernières semaines${cur.partiel ? `, dont ${cur.partiel} en partie` : ''}.${better ? ' <b>C\'est plus que les trois semaines d\'avant.</b>' : ''}</p>`
    : `<p class="s">Tes priorités tenues apparaîtront ici dès ton premier bilan du soir.</p>`;
  const done = st.fait + st.partiel;
  const planCard = st.reviewed
    ? `<div class="v">${done}<span class="of"> bloc${done > 1 ? 's' : ''} fait${done > 1 ? 's' : ''} sur ${st.reviewed}</span></div><p class="s">Cette semaine, parmi les blocs dont tu as fait le bilan${st.partiel ? `, dont ${st.partiel} en partie` : ''}.</p>`
    : `<p class="s">Pas encore de bilan cette semaine. Le soir, touche tes blocs pour dire ce qui a été fait.</p>`;

  return `<h2>Ta <em>synthèse</em></h2>
  <p class="lead">Un coup d'œil. Touche une carte pour le détail.</p>
  <div class="syn">
    <button type="button" class="syncard hero" data-to="journal" data-anchor="prios"><span class="k">◆ Tes priorités</span>${prioCard}<span class="more">Voir le détail ›</span></button>
    <button type="button" class="syncard" data-to="semaine"><span class="k">↔ Prévu → réel</span>${planCard}<span class="more">Ma semaine jour par jour ›</span></button>
    <button type="button" class="syncard wbc" data-to="journal" data-anchor="wb"><span class="k">❀ Bien-être</span><div class="v">${dur(wb)}</div><p class="s">${wb ? 'de petits moments pour toi cette semaine.' : 'Aucun moment noté cette semaine pour l\'instant.'}</p><span class="more">Voir le détail ›</span></button>
    <button type="button" class="syncard flc" data-to="journal" data-anchor="flow"><span class="k">✦ Flow</span><div class="v">${dur(flow)}</div><p class="s">${flow ? `cette semaine${top ? `, surtout ${top.name}` : ''}.` : 'Pas de flow noté cette semaine pour l\'instant.'}</p><span class="more">Voir le détail ›</span></button>
  </div>
  <div class="stack" style="margin-top:18px">
    <button type="button" class="biglink" data-to="semaine"><span><b>Ma semaine, jour par jour</b><span class="lead" style="display:block;margin:2px 0 0">L'histoire en mots, l'aurore de chaque jour</span></span><span class="dgo">›</span></button>
    <button type="button" class="biglink" data-to="journal"><span><b>Mon journal de progression</b><span class="lead" style="display:block;margin:2px 0 0">Les tendances sur plusieurs semaines</span></span><span class="dgo">›</span></button>
  </div>`;
}

export function bindSynthese(v) {
  v.querySelectorAll('[data-to]').forEach(b => b.onclick = () => {
    go(b.dataset.to, b.dataset.to === 'semaine' ? { weekStart: mondayOf(today()) } : {});
    const a = b.dataset.anchor;
    if (a) setTimeout(() => document.getElementById('j-' + a)?.scrollIntoView({ behavior: 'instant', block: 'start' }), 0);
  });
}

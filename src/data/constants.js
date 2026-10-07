// Vocabulaire de l'appli : thématiques, curseurs, facteurs. Tout le texte visible se règle ici.

// Catégories proposées au départ ; chaque personne les renomme, recolore, retire ou complète dans le guide.
export const DEFAULT_THEMES = [
  { id: 'travail', name: 'Travail', c: '--t-travail' },
  { id: 'client', name: 'RDV client', c: '--t-client' },
  { id: 'prospect', name: 'RDV prospect', c: '--t-prospect' },
  { id: 'sport', name: 'Sport', c: '--t-sport' },
  { id: 'enfants', name: 'Enfants', c: '--t-enfants' },
  { id: 'libre', name: 'Temps libre', c: '--t-libre' },
  { id: 'repas', name: 'Déjeuners & dîners', c: '--t-repas' },
  { id: 'maison', name: 'Courses & maison', c: '--t-maison' },
  { id: 'sorties', name: 'Sorties', c: '--t-sorties' },
  { id: 'bienetre', name: 'Bien-être', c: '--turq' }
];
// Couleurs disponibles pour les catégories (jetons définis dans tokens.css)
export const PALETTE = Array.from({ length: 30 }, (_, i) => `--c${String(i + 1).padStart(2, '0')}`);
export const WEEKDAYS_SHORT = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];
export const SPORTS = ['course', 'marche', 'yoga', 'natation', 'vélo', 'salle de sport', 'danse', 'pilates', 'escalade', 'arts martiaux'];

// Des mots plutôt que des chiffres : 5 paliers par curseur, valeur stockée de 0 à 10.
export const SLIDERS = [
  { id: 'emotion', name: 'Émotion', l: 'très lourd', r: 'très positif', w: ['très lourd', 'lourd', 'neutre', 'plutôt léger', 'très positif'], from: '#3A3760', hue: '#FF6B6B' },
  { id: 'energie', name: 'Énergie', l: 'vidée', r: "pleine d'élan", w: ['vidée', 'basse', 'entre-deux', 'bonne', "pleine d'élan"], from: '#6B3FA0', hue: '#FFE66D' },
  { id: 'corps', name: 'Corps', l: 'très inconfortable', r: 'très confortable', w: ['très inconfortable', 'inconfortable', 'ça va', 'confortable', 'très confortable'], from: '#3A3760', hue: '#C7B5F5' },
  { id: 'anxiete', name: 'Anxiété', l: 'absente', r: 'très présente', w: ['absente', 'légère', 'présente', 'forte', 'très présente'], from: '#3A3760', hue: '#9B6FCF' },
  { id: 'ennui', name: 'Ennui', l: 'absent', r: 'très présent', w: ['absent', 'léger', 'présent', 'fort', 'très présent'], from: '#3A3760', hue: '#99A1C2' },
  { id: 'sens', name: 'Charge sensorielle', l: 'calme', r: 'surchargée', w: ['calme', 'un peu de bruit', 'chargée', 'très chargée', 'surchargée'], from: '#3A3760', hue: '#EE9DBE' }
];
const step = v => v <= 2 ? 0 : v <= 4 ? 1 : v <= 5 ? 2 : v <= 7 ? 3 : 4;
export const wordOf = (id, v) => SLIDERS.find(s => s.id === id).w[step(v)];
export const sliderName = id => SLIDERS.find(s => s.id === id).name;

export const FACTORS = ['imprévu', 'urgence', "sollicitation de quelqu'un", 'conflit', 'bonne nouvelle', 'mauvaise nuit', 'déjeuner dehors', 'sport', 'hyperfocus', 'évitement', 'choix délibéré'];
export const BODY = ['règles', 'malade', 'douleur', 'fatigue inhabituelle', 'traitement en cours', 'décalage / voyage', 'autre'];
export const SOCIAL = ['personne', 'en face', 'au téléphone', 'en visio', 'par messages'];
export const SLEEP = ['agitée', 'courte', 'moyenne', 'bonne', 'réparatrice'];
export const PRIO_HELD = ['oui', 'en partie', "pas aujourd'hui"];
export const WB_DURATIONS = [5, 10, 15, 20, 30];
export const DEFAULT_WB = [
  { name: 'Marche', dur: 15 }, { name: 'Méditation', dur: 10 }, { name: 'Snack healthy', dur: 5 },
  { name: 'Musique', dur: 10 }, { name: 'Respiration', dur: 5 }, { name: 'Sieste', dur: 20 }
];

export const socialText = so => so && so.modes && so.modes.length && !so.modes.includes('personne')
  ? `${so.modes.join(', ')}${so.note ? ' · ' + so.note : ''}` : '';

// Dates et heures. Les dates sont des chaînes locales 'AAAA-MM-JJ', les heures des minutes depuis minuit.

export const H0 = 7;   // début de la journée affichée
export const H1 = 23;  // fin de la journée affichée

export const DAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
export const DAYS_L = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
export const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

const pad = n => String(n).padStart(2, '0');

export const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const today = () => iso(new Date());
export const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
export const weekday = s => (parse(s).getDay() + 6) % 7; // 0 = lundi
export const mondayOf = s => addDays(s, -weekday(s));
export const weekDates = monday => Array.from({ length: 7 }, (_, i) => addDays(monday, i));
export const dayNum = s => parse(s).getDate();

export const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
export const r15 = m => Math.round(m / 15) * 15;
export const hm = m => { m = Math.max(0, Math.min(1439, Math.round(m))); const h = Math.floor(m / 60), mm = m % 60; return h + 'h' + (mm ? pad(mm) : ''); };
export const dur = m => { m = Math.round(m); const h = Math.floor(m / 60), r = m % 60; return h ? `${h} h${r ? ' ' + pad(r) : ''}` : `${r} min`; };
export const pct = m => ((m - H0 * 60) / ((H1 - H0) * 60)) * 100;
export const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;

export const longDate = s => { const d = parse(s); return `${cap(DAYS_L[weekday(s)])} ${d.getDate()} ${MONTHS[d.getMonth()]}`; };
export const weekLabel = monday => {
  const a = parse(monday), b = parse(addDays(monday, 6));
  const same = a.getMonth() === b.getMonth();
  return `${a.getDate()}${same ? '' : ' ' + MONTHS[a.getMonth()]} au ${b.getDate()} ${MONTHS[b.getMonth()]}`;
};

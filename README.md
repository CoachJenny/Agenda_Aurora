# Aurora · Nahara

Aurora est le journal de planification et de vécu des accompagnements Nahara, pour entrepreneures neuroatypiques.
On prévoit sa semaine, on note comment on la vit au fil des jours, et on la relit en séance.

C'est une appli web installable (PWA) : elle s'ouvre depuis l'écran d'accueil du téléphone, en plein écran, sans passer par un store.

## Ce que fait l'appli

- **Accueil** : guide vers l'étape qui correspond au moment (planifier la semaine, ouvrir la journée, check-in, ma journée vécue, clore la journée, récap).
- **Mon Aurora** (guide de personnalisation) : une question à la fois (prénom, enfants, sport, activités à horaires fixes, catégories, priorités, moments bien-être), puis une conclusion à vérifier. Garde partagée possible : semaines A et B, matins et soirs avec les enfants. Les moments fixes se posent automatiquement dans le plan chaque semaine, et ceux avec les enfants seulement les jours de garde. Raccourcis toujours visibles (accueil, Planifier, fenêtre d'un bloc) pour modifier directement ses catégories, ses moments fixes ou sa garde.
- **Planifier** : le plan seul. Blocs étiquetés par thématique, déplaçables et redimensionnables au doigt, fixes ou flexibles ; priorités de la semaine et du jour ; checklist avant de planifier. Une fois la journée commencée, son plan est figé pour comparer.
- **Ma journée** : le prévu et le réel côte à côte, séparés par le ruban d'énergie ; les écarts prévu → réel ; ce qui a compté, écrit en clair.
- **Check-in** : six curseurs exprimés en mots, moment fort, échanges avec quelqu'un, « mon corps en ce moment ».
- **Flow, procrastination, bien-être** : trois boutons toujours accessibles, sur le moment ou après coup.
- **Matin · Soir** : mot d'ouverture, nuit, priorités, puis le plan se fige ; le soir, la journée en image où chaque bloc se qualifie (fait, en partie, pas fait, remplacé, vrais horaires), relance depuis le dernier check-in, priorités tenues, mot de clôture, debrief libre.
- **Ma semaine** : l'histoire en mots, les chiffres clés, les rubans d'énergie et d'émotion jour par jour ; chaque jour s'ouvre dans Ma journée pour revoir le prévu et le réel. L'outil montre, il n'interprète pas.

Les données restent pour l'instant **sur le téléphone** (stockage du navigateur). Les réglages permettent de télécharger et de restaurer une sauvegarde.

## Feuille de route

1. **Socle** (cette version) : écrans, design Nahara, installation, données locales.
2. **Comptes et données** : Supabase (région UE), connexion par lien magique, règles d'accès par cliente, synchronisation entre appareils.
3. **Finitions** : écran de consentement et mentions RGPD, formulations définitives.
4. **Test réel** : une semaine en usage personnel, puis une cliente.

## Pour développer

```bash
npm install
npm run dev      # serveur local
npm run build    # version publiée, dans dist/
```

- `src/data/constants.js` : tout le vocabulaire (thématiques, curseurs et leurs mots, facteurs, activités bien-être).
- `src/data/store.js` : le modèle de données, pensé pour correspondre aux futures tables Supabase.
- `src/views/` : un fichier par écran.
- `src/styles/tokens.css` : la charte Nahara (couleurs, typographies, rayons).

## Publication

Chaque modification de la branche `main` est publiée automatiquement sur GitHub Pages par le workflow `.github/workflows/deploy.yml`.
À activer une seule fois : **Settings → Pages → Source : GitHub Actions**.

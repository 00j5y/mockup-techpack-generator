# Constitue Studio

Outil interne (mono-utilisateur : Jay) pour la marque **Constitue**. Trois missions :

1. Centraliser les données produit (fabrication, mesures, BOM, couleurs, packaging, artwork)
2. Générer un **techpack PDF** fidèle au template Seaggs, sans ressaisie
3. Générer un **visuel photoréaliste** à partir des flats Illustrator via l'API OpenAI

Repo : `git@github.com:00j5y/mockup-techpack-generator.git`

---

## Règles dures (non négociables)

1. **Positions en pourcentage, jamais en pixels.** Tous les points de mesure, callouts et annotations sont stockés en `x_percent` / `y_percent` (0-100). Un flat réexporté à une autre résolution ne doit rien casser.
2. **La géométrie du header est définie à un seul endroit** (`headerLayout.ts`), consommée par le rendu print et par le rendu édition. Toute coordonnée de header copiée-collée dans un second fichier est un bug d'architecture à corriger immédiatement, pas à contourner. Voir `.claude/docs/02-architecture.md`.
3. **Aucun appel IA payant sans review humaine du prompt.** Le prompt est toujours affiché et éditable avant envoi. Pas de génération automatique, jamais.
4. **Séparation prompt / appel API.** `lib/prompt/` construit le texte, `lib/openai/` fait l'appel. On doit pouvoir tester la construction du prompt sans dépenser un centime.
5. **Jamais de commit direct sur `main`.** Une branche par phase ou sous-phase. Voir `.claude/docs/11-git-workflow.md`.
6. **Jamais de `git push` ni d'ouverture de PR sans accord explicite de Jay.** À chaque fin de phase : lui remettre la **liste de ce qu'il doit tester lui-même**, attendre sa confirmation, et seulement ensuite push + PR. Voir `.claude/docs/11-git-workflow.md`.
7. **La fidélité visuelle du PDF est le critère de succès** du module techpack. Un PDF fonctionnel mais mal mis en page = module non livré. Comparaison page par page contre `.claude/docs/template-reference/exemple-p-NN.jpg`.
8. **Pas de sur-ingénierie pour le hors-scope.** Voir `.claude/docs/14-hors-scope.md` avant d'ajouter une abstraction "au cas où".
9. **Le techpack est en paysage `761.4 x 581.4 pt` et fait toujours 12 pages**, y compris vides. Ni A4, ni Letter, ni portrait, ni pagination dynamique. Géométrie mesurée dans `.claude/docs/15-template-seaggs.md`.
10. **Dans le techpack, tout ce que l'utilisateur renseigne est en rouge `#FF0000`**, toute la structure du template en `#231F20` / `#CCCCCC`. Seule exception : le texte des cellules BOM, en noir.
11. **Le canvas d'annotation est une primitive réutilisable, pas un module.** 6 pages sur 12 en dépendent. Un `AnnotatedCanvas` qui connaît la notion de "mesure" est un bug d'architecture.
12. **Aucun filigrane.** Le `SEAGGS` du template est la marque de son auteur : on ne le reproduit pas et on ne le remplace par rien. Zones de contenu en blanc pur.

## Conventions de code

- **TypeScript strict** partout. Pas de `any` non justifié par un commentaire.
- **Commentaires de code en français.** Noms de variables, fonctions, types en anglais.
- **Pas de caractère em dash** (`—`) dans les fichiers de doc, README et textes rédigés. Utiliser `:`, `,`, `-`, `→` ou des parenthèses.
- Types partagés dans `types/product.ts`, **dérivés du schéma Drizzle** (`lib/db/schema.ts`), jamais écrits à la main.
- Auto-save des formulaires (debounce 1s), pas de bouton "Enregistrer" explicite.

## Index de la documentation

Lire le fichier correspondant **avant** d'attaquer une phase. Ne pas travailler de mémoire.

| Fichier | Quand le lire |
|---|---|
| `.claude/docs/00-vision.md` | Toujours utile en cas de doute sur le périmètre |
| `.claude/docs/01-stack.md` | Phase 0, ou choix de librairie |
| `.claude/docs/02-architecture.md` | Toute création de fichier ou dossier |
| `.claude/docs/03-database.md` | Phase 0, ou toute requête / migration |
| `.claude/docs/04-module-produit.md` | Phase 1 |
| `.claude/docs/05-module-mesures.md` | Phase 2 (module le plus complexe) |
| `.claude/docs/06-module-formulaires.md` | Phase 3 |
| `.claude/docs/07-module-techpack-pdf.md` | Phase 4 |
| `.claude/docs/08-module-visuel-ia.md` | Phase 5 |
| `.claude/docs/09-api.md` | Création ou modification d'une route API |
| `.claude/docs/10-phasage.md` | Début et fin de chaque phase (definition of done) |
| `.claude/docs/11-git-workflow.md` | Toute opération git |
| `.claude/docs/12-pieges.md` | **À relire avant chaque phase.** Anti-patterns connus |
| `.claude/docs/13-env-setup.md` | Setup local, variables d'env, Docker |
| `.claude/docs/14-hors-scope.md` | Quand on est tenté d'ajouter une feature |
| `.claude/docs/15-template-seaggs.md` | **Géométrie mesurée du template.** Phases 2, 3 et 4. La référence de fidélité. |
| `.claude/docs/template-reference/` | Le template vierge (PDF) et l'exemple rempli (12 JPG) |
| `.claude/PROGRESS.md` | **À jour en permanence.** État réel d'avancement |

## Workflow attendu à chaque session

1. Lire `.claude/PROGRESS.md` pour savoir où on en est
2. Lire le doc de la phase en cours + `12-pieges.md`
3. Créer / vérifier la branche de feature
4. Développer, tester
5. Mettre à jour `PROGRESS.md` avant de rendre la main

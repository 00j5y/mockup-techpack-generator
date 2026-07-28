# Documentation projet Constitue Studio

Ce dossier contient la spécification complète du projet, découpée par domaine pour être lue à la demande plutôt que chargée en bloc.

## Comment l'utiliser

`CLAUDE.md` (à la racine du repo) est chargé automatiquement à chaque session : il contient les règles dures et l'index. Il ne contient volontairement pas le détail.

Les fichiers de `docs/` sont à lire **au moment où on en a besoin** :

```
docs/
├── 00-vision.md              Périmètre, objectifs, non-objectifs
├── 01-stack.md               Stack + contraintes techniques + points à vérifier
├── 02-architecture.md        Arborescence + frontières de responsabilité
├── 03-database.md            Schéma SQL complet + ajouts Phase 0
├── 04-module-produit.md      Phase 1
├── 05-module-mesures.md      Phase 2 (le plus complexe)
├── 06-module-formulaires.md  Phase 3
├── 07-module-techpack-pdf.md Phase 4
├── 08-module-visuel-ia.md    Phase 5
├── 09-api.md                 Endpoints
├── 10-phasage.md             Phases + definition of done
├── 11-git-workflow.md        Branches, commits, règles de push
├── 12-pieges.md              Anti-patterns (à relire à chaque phase)
├── 13-env-setup.md           Env, Docker, buckets Storage
├── 14-hors-scope.md          Ce qu'on ne construit pas
├── 15-template-seaggs.md     Géométrie mesurée du template (Phases 2, 3, 4)
└── template-reference/       Template vierge (PDF) + exemple rempli (12 JPG)
```

`15-template-seaggs.md` et `template-reference/` sont la **référence de fidélité** du projet. Toutes les valeurs de ce fichier sont mesurées sur les PDF sources, pas estimées. Les Phases 2, 3 et 4 se valident par comparaison visuelle contre `exemple-p-NN.jpg`.

`PROGRESS.md` est le seul fichier de ce dossier qui change constamment : il reflète l'état réel d'avancement. À lire en début de session, à mettre à jour en fin de session.

## Slash commands projet

- `/phase <numéro>` : démarre proprement une phase (lecture des docs, branche, checklist)
- `/dod` : vérifie la definition of done de la phase en cours avant merge

## Convention d'écriture de cette doc

- Français, tutoiement
- **Pas de caractère em dash** (`—`) : utiliser `:`, `,`, `-`, `→` ou des parenthèses
- Ce qui n'est pas vérifié est signalé comme tel ("à vérifier contre la doc officielle"), jamais présenté comme un fait

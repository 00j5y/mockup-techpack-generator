# 11 - Workflow Git

**Remote** : `git@github.com:00j5y/mockup-techpack-generator.git`

## Règles

1. `main` est la branche de référence, **toujours stable et déployable**
2. **Jamais de commit direct sur `main`**
3. Une branche par feature, créée depuis `main` à jour
4. Une branche = une phase ou une sous-partie de phase (voir `10-phasage.md`), pour garder des PR de taille raisonnable
5. Merge vers `main` uniquement quand la feature est fonctionnelle **et relue**
6. **Jamais de `git push` sans accord explicite de Jay**
7. **Jamais d'ouverture de Pull Request sans accord explicite de Jay**
8. **Ne jamais s'ajouter en co-auteur des commits** (pas de trailer `Co-Authored-By`)

## Nommage des branches

- `feature/nom-de-la-feature` : ex `feature/measurement-editor`, `feature/techpack-pdf-export`, `feature/bom-crud`
- `fix/nom-du-bug` : corrections
- `chore/nom` : outillage, config, dépendances

Branches par phase suggérées : voir le tableau de `10-phasage.md`.

## Séquence de démarrage d'une phase

```bash
git checkout main
git pull
git checkout -b feature/nom-de-la-feature
```

## Messages de commit

- En français ou en anglais, mais **cohérent** dans tout le repo. Choisir au premier commit et s'y tenir.
- Impératif, concis, une ligne de sujet + corps si nécessaire
- Un commit = une unité logique. Pas de commit fourre-tout "wip" en fin de journée sur du code cassé.
- Pas de trailer de co-auteur

## Avant de proposer un merge

- [ ] La checklist "definition of done" de la phase est cochée en entier
- [ ] `bun run build` passe sans erreur
- [ ] `tsc --noEmit` passe sans erreur
- [ ] Le lint passe
- [ ] Aucun secret ni `.env` committé
- [ ] Aucun `console.log` de debug oublié
- [ ] `.claude/PROGRESS.md` est à jour
- [ ] Relecture de code effectuée

Ensuite seulement : demander à Jay s'il veut push + PR, et attendre sa réponse.

## Ce qui ne va jamais dans le repo

- `.env`, `.env.local`, toute variante contenant des clés
- Chaîne de connexion Postgres, clé OpenAI
- PDFs générés, images générées, uploads (ils vivent dans `.storage/`, ignoré)
- `node_modules`, `.next`, artefacts de build

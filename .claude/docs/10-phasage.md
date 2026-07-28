# 10 - Phasage de développement

Une phase = une branche = un merge vers `main`. Voir `11-git-workflow.md`.

| Phase | Branche suggérée | Contenu | Livrable |
|---|---|---|---|
| **0** | `feature/bootstrap` | Setup Next.js + Supabase + Docker + schéma DB complet + auth | Repo bootable, DB créée |
| **1** | `feature/product-crud` | CRUD produit + upload flats | Créer/éditer un produit, uploader ses flats |
| **2** | `feature/measurement-canvas` | Éditeur de mesures | Poser des points, saisir les valeurs, exporter l'overlay |
| **3** | `feature/bom-and-specs` | BOM / Colors / Packaging / Artwork / Callouts / Extra | Formulaires CRUD complets |
| **4** | `feature/techpack-pdf-export` | Génération techpack PDF | PDF complet, fidèle au template |
| **5** | `feature/ai-visual-generation` | Génération visuel IA | Prompt dynamique + appel API + galerie |
| **6** (optionnel) | `feature/polish` | Indicateurs de complétion avancés, dashboard, export batch | Confort d'usage |

## Ordre non négociable

Les phases 1 → 4 sont séquentielles par dépendance de données :

- La Phase 2 a besoin de flats uploadés (Phase 1)
- La Phase 4 a besoin des données des Phases 1, 2 et 3

La **Phase 5 est indépendante** des Phases 2, 3 et 4 : elle ne dépend que des flats (Phase 1) et des données produit. Elle peut être avancée si l'envie de voir un résultat spectaculaire l'emporte, mais le techpack (Phase 4) est le livrable à plus forte valeur : c'est lui qui remplace le travail manuel le plus pénible.

## Phase 0 : détail du setup

- [ ] `bun create next-app` avec TypeScript strict, App Router, Tailwind
- [ ] `tsconfig.json` : `strict: true`, pas de `skipLibCheck` complaisant
- [ ] Projet Supabase créé, `.env.local` renseigné (voir `13-env-setup.md`)
- [ ] Migration initiale contenant **tout** le schéma de `03-database.md`, y compris index, trigger `updated_at`, RLS **et les 8 corrections issues du template**
- [ ] Police Source Sans 3 (ou substitut validé) ajoutée localement au projet, pas via CDN
- [ ] Buckets Storage créés, politique CORS vérifiée pour l'export canvas
- [ ] Auth email/password fonctionnelle, middleware de protection des routes `(dashboard)`
- [ ] `types/product.ts` généré depuis le schéma Supabase
- [ ] `Dockerfile` + `docker-compose.yml`, **avec Chromium pour Puppeteer** dès maintenant (ne pas découvrir le problème en Phase 4)
- [ ] Le build Docker passe et l'app répond
- [ ] `.gitignore` correct (`.env*`, `node_modules`, `.next`)

## Definition of done par phase

Chaque module a sa checklist en fin de fichier :

- Phase 1 → `04-module-produit.md`
- Phase 2 → `05-module-mesures.md`
- Phase 3 → `06-module-formulaires.md`
- Phase 4 → `07-module-techpack-pdf.md`
- Phase 5 → `08-module-visuel-ia.md`

Les phases 2, 3 et 4 exigent en plus une **comparaison visuelle** contre `template-reference/exemple-p-NN.jpg`. Ce n'est pas optionnel : c'est le seul test qui valide la fidélité, et la fidélité est le critère de succès du projet.

**Une phase n'est pas terminée tant que sa checklist n'est pas cochée en entier, vérification faite, pas supposée.** Pas de "ça devrait marcher" : on lance, on regarde, on coche.

## Mise à jour de PROGRESS.md

À la fin de chaque session de travail, `.claude/PROGRESS.md` doit refléter l'état réel : ce qui est fait, ce qui est en cours, ce qui bloque. C'est le fichier lu en premier à la session suivante.

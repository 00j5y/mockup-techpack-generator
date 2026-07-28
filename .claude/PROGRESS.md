# Avancement Constitue Studio

> Dernière mise à jour : 2026-07-27
> À lire en début de session, à mettre à jour en fin de session.

## État global

| Phase | Statut | Branche |
|---|---|---|
| 0 - Setup | 🟢 Terminé, non mergé | `feature/bootstrap` |
| 1 - CRUD Produit | ⬜ Pas commencé | `feature/product-crud` |
| 2 - Éditeur de mesures | ⬜ Pas commencé | `feature/measurement-canvas` |
| 3 - BOM / Colors / Packaging / Artwork | ⬜ Pas commencé | `feature/bom-and-specs` |
| 4 - Techpack PDF | ⬜ Pas commencé | `feature/techpack-pdf-export` |
| 5 - Visuel IA | ⬜ Pas commencé | `feature/ai-visual-generation` |
| 6 - Polish (optionnel) | ⬜ Pas commencé | `feature/polish` |

Légende : ⬜ pas commencé, 🟡 en cours, ✅ terminé et mergé

## Phase en cours

**Phase 0**, branche `feature/bootstrap`. Socle technique en place, vérifié de bout en bout, sans dépendance externe.

### Fait et vérifié

- [x] Dépôt git initialisé, remote `origin` configuré, branche `feature/bootstrap`
- [x] Next.js **15.5.22** (App Router, TypeScript `strict`, Tailwind 4, React 19.1), runtime Bun 1.3.13
- [x] **Postgres 17 en Docker** + **Drizzle** : `lib/db/schema.ts` est la source unique, il génère la migration SQL et les types
- [x] Les 13 tables créées et vérifiées en base : contraintes `check` et `on delete cascade` testées par insertions réelles
- [x] `types/product.ts` dérivé du schéma via `InferSelectModel`, plus les plafonds du template et les 10 colonnes de tailles fixes
- [x] **Stockage local** (`lib/storage` + `/api/files/[...path]`) : validation MIME, plafond 25 Mo, garde anti-traversée de chemin testée
- [x] `.env.example`, `.dockerignore`, `docker-compose.yml`
- [x] `Dockerfile` 4 étapes avec Chromium, utilisateur non-root avec home accessible
- [x] **Test de fumée PDF** (`bun run smoke:pdf`) : passe en local **et** dans le conteneur, dimensions identiques des deux côtés
- [x] Source Sans 3 auto-hébergée (woff2 dans le build, aucun appel CDN à l'exécution)
- [x] `bun run typecheck`, `bun run lint`, `bun run build` passent
- [x] Image Docker construite, app servie en HTTP 200 sans erreur au log

### Reste à faire

- [ ] Rejouer le test de fumée PDF depuis `docker compose` complet (app + db ensemble)
- [ ] `pg_dump` en cron, avant toute utilisation sérieuse

**La Phase 0 n'a plus de bloquant externe.** Plus de compte tiers à créer, tout tourne en local.

## Prochaine action

Phase 1, branche `feature/product-crud` : CRUD produit, upload des flats, header éditable en place.

## Bloquants / en attente d'une décision de Jay

- [ ] **Prompts IA de référence** : les prompts rédigés manuellement qui ont donné de bons résultats ne sont pas dans le repo. Nécessaires avant d'écrire `buildImagePrompt.ts` (Phase 5). À placer dans `.claude/docs/prompts-reference/`
- [ ] **Modèle OpenAI** : identifiant exact et tarification à confirmer contre la doc officielle avant la Phase 5
- [ ] **Auth : bloquant AVANT DÉPLOIEMENT, pas maintenant.** L'app n'a aucune authentification. Sans conséquence en local. Sur un VPS public, n'importe qui trouvant l'URL peut lire et modifier les données, et surtout déclencher `/api/generate-image`, qui coûte de l'argent réel.

## Bloquants résolus

| Date | Bloquant | Résolution |
|---|---|---|
| 2026-07-27 | Template Seaggs absent du repo | Reçu. Copié dans `.claude/docs/template-reference/`, analysé et mesuré dans `15-template-seaggs.md` |
| 2026-07-27 | Format de page inconnu (A4 ou Letter ?) | **Ni l'un ni l'autre** : paysage custom `761.4 x 581.4 pt` |
| 2026-07-27 | Buckets Storage : public ou privé ? | **Caduque** : sortie de Supabase le jour même. Remplacé par du stockage local, voir ci-dessous |
| 2026-07-27 | Quota de projets Supabase atteint | Sortie complète de Supabase : Postgres Docker + fichiers locaux + pas d'auth |
| 2026-07-27 | `git init` + remote | Fait, branche `feature/bootstrap` |

## Décisions prises

| Date | Décision | Raison |
|---|---|---|
| 2026-07-27 | Pas de Zustand en Phase 0, décision reportée à la Phase 2 | Ne pas installer une dépendance avant d'avoir constaté le besoin |
| 2026-07-27 | Callouts = réutilisation des composants canvas de la Phase 2 | Éviter un second éditeur en doublon |
| 2026-07-27 | Route d'upload générique côté serveur plutôt qu'upload direct client | Centralise la validation MIME/taille et la normalisation des chemins |
| 2026-07-27 | `AnnotatedCanvas` est une primitive générique, pas un composant de mesures | 6 pages du techpack sur 12 en dépendent |
| 2026-07-27 | Overlay stocké en colonne sur `product_flats`, pas en table dédiée | Un overlay par flat, écrasé à chaque export, pas besoin d'historique |
| 2026-07-27 | Techpack toujours 12 pages, jamais de pagination dynamique | C'est le comportement du template : l'exemple rempli garde 3 pages vides |
| 2026-07-27 | Pages de techpack en positions absolues en `pt`, pas en flexbox/grid | Le template est un document Illustrator, les coordonnées sont connues au point près |
| 2026-07-27 | Plusieurs Pantone par artwork via table `artwork_pantones` | L'exemple en montre 3 sur un seul élément |
| 2026-07-27 | **Aucun filigrane**, ni Seaggs ni Constitue. Zones de contenu en blanc pur | Décision de Jay |
| 2026-07-27 | **Canvas libre** pour les pages 7, 8-9 et 10-12, pas d'auto-layout | Décision de Jay. `AnnotatedCanvas` existe déjà après la Phase 2, et les pages 5-6 imposent déjà un canvas : un auto-layout aurait créé deux paradigmes de saisie |
| 2026-07-27 | **Source Sans 3** à la place de Myriad Pro | Myriad Pro n'existe sur la machine que dans le cache obfusqué Adobe Fonts, et sa licence ne couvre pas l'installation sur un serveur de génération. Métriques différentes : ajustement à prévoir sur la barre de titre et le header |
| 2026-07-27 | **Logo : champ par produit**, zone de drag-and-drop, préremplí depuis le produit le plus récent | Décision de Jay. Évite une table de réglages globaux tout en évitant de réuploader à chaque pièce |
| 2026-07-27 | **Le header se saisit en place**, à sa géométrie réelle, pas dans un formulaire séparé | Décision de Jay. Le bloc apparaît sur les 12 pages : le voir juste tout de suite évite de découvrir un débordement de texte à la génération |
| 2026-07-27 | **Postgres auto-hébergé en Docker**, pas MySQL ni Firestore | MySQL n'a ni `text[]` ni `check` sur tableau : réécriture complète pour zéro gain. Firestore ferait de `getFullProduct()` du N+1 et supprimerait toutes les contraintes, dont les 12 cascades |
| 2026-07-27 | **Drizzle** comme couche d'accès | `lib/db/schema.ts` génère les migrations ET les types : une seule source. Et `DATABASE_URL` reste la seule dépendance, donc passer à du managé plus tard ne coûte rien |
| 2026-07-27 | **Stockage fichiers en local**, servi par `/api/files/[...path]` | Même origine que l'app : élimine par construction le canvas *tainted* qui menaçait toute la Phase 2 |
| 2026-07-27 | **Pas d'auth pour l'instant** | Décision de Jay, outil personnel en local. Redevient bloquant avant tout déploiement public |
| 2026-07-27 | `tsconfig` cible ES2022 au lieu du ES2017 par défaut | Le flag regex `s` (dotAll) exige ES2018+. ES2017 est archaïque pour Node 26 |
| 2026-07-27 | Géométrie du header dans `headerLayout.ts`, consommée par `TechpackHeader` (print, pur) et `TechpackHeaderEditor` (édition, client) | Le rendu PDF ne doit pas traîner d'hydratation React ni de balises `input`. Un `mode: print \| edit` sur un composant unique aurait rendu tout le chemin PDF client |

## Modèle Claude par tâche

Décidé avec Jay le 2026-07-27. Principe retenu : **le relecteur n'est jamais le modèle qui a écrit le code** (un modèle qui relit sa propre production partage ses angles morts), et le modèle le plus capable va sur la review, pas sur l'implémentation répétitive.

| Tâche | Modèle | Pourquoi |
|---|---|---|
| Phases 0, 1, 3, 5 : gros de l'implémentation | **Sonnet 5** | Tout est spécifié au champ près dans la doc, il n'y a pas de décision à prendre |
| Phase 2 : conception d'`AnnotatedCanvas` | **Opus 5** | La primitive dont dépendent 6 pages sur 12. Le risque architectural du projet |
| Phase 4 : boucle de fidélité PDF | **Opus 5** | Comparaison visuelle contre `exemple-p-NN.jpg` + pipeline Puppeteer/Docker/polices |
| **Toutes les reviews** | **Opus 5**, effort `medium` | La tâche où une erreur coûte le plus cher. Opus reste précis à effort réduit, donc la review coûte peu |

**Pas de Fable 5 sur ce projet.** À $10/$50 par MTok il se justifie sur un problème non résolu, pas sur une spec déjà écrite à 2000 lignes avec la géométrie mesurée. Impose en plus 30 jours de rétention de données.

### Règles d'usage

- **Un modèle par session, pas par message.** Les caches de prompt sont liés au modèle : changer en cours de session refait payer toute la doc déjà lue (~15K tokens).
- **En review, ne jamais écrire « ne signale que les problèmes importants ».** Opus 5 et Sonnet 5 suivent ce filtre littéralement : ils trouvent le bug, le jugent sous la barre, et se taisent. Demander de tout remonter avec confiance + gravité, filtrer soi-même après.
- Effort : `xhigh` par défaut sur le code (défaut de Claude Code), `medium` sur les reviews et les phases répétitives.
- Pour une review profonde en fin de Phase 2 et de Phase 4 : `/code-review ultra`, déclenché par Jay, facturé à part.

## Idées / backlog

Ce qui surgit en cours de dev et ne doit pas polluer la branche en cours :

- Générer le visuel IA directement dans la zone image de la page 1 (Cover) : le template y réserve 370 pt de haut sur toute la largeur, c'est exactement l'usage
- Le paragraphe Pantone de la page 6 pourrait injecter le vrai `fabric_color_hex` du produit dans son exemple, comme l'a fait l'auteur de l'exemple Seaggs

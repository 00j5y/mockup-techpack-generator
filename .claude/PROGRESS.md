# Avancement Constitue Studio

> Dernière mise à jour : 2026-07-28
> À lire en début de session, à mettre à jour en fin de session.

## État global

| Phase | Statut | Branche |
|---|---|---|
| 0 - Setup | ✅ Terminé et mergé (PR #1, commit de merge `ab3d03c`) | `feature/bootstrap` |
| 1 - CRUD Produit | 🟡 En cours | `feature/product-crud` |
| 2 - Éditeur de mesures | ⬜ Pas commencé | `feature/measurement-canvas` |
| 3 - BOM / Colors / Packaging / Artwork | ⬜ Pas commencé | `feature/bom-and-specs` |
| 4 - Techpack PDF | ⬜ Pas commencé | `feature/techpack-pdf-export` |
| 5 - Visuel IA | ⬜ Pas commencé | `feature/ai-visual-generation` |
| 6 - Polish (optionnel) | ⬜ Pas commencé | `feature/polish` |

Légende : ⬜ pas commencé, 🟡 en cours, ✅ terminé et mergé

## Phase en cours

**Phase 1**, branche `feature/product-crud`. CRUD produit, header éditable en place, upload des flats.

### Livré

- [x] Liste des produits avec filtres par catégorie et par statut, badges de statut
- [x] Création de produit (`/products/new`) avec pré-remplissage du logo depuis le produit le plus récent
- [x] Vue produit (`/products/[id]`) : header éditable en place, formulaire général, flats, indicateurs de complétion, suppression
- [x] Header du techpack éditable **à sa géométrie réelle** : `headerLayout.ts` est la source unique, consommée par `TechpackHeader.tsx` (print, pur) et `TechpackHeaderEditor.tsx` (édition, client)
- [x] Zone de drag-and-drop du logo aux dimensions exactes du slot (72 x 70 pt), avertissement quand l'image n'a pas de canal alpha
- [x] Avertissement de débordement de colonne mesuré à la frappe avec la police réelle (`measureTextPt.ts`)
- [x] Auto-save par champ, debounce 1 s, flush au démontage et à `beforeunload`, retry sans perte de saisie (`useAutoSavePatch.ts`)
- [x] Upload et suppression des flats, avec confirmation chiffrée de l'impact (points de mesure et callouts supprimés en cascade, couleurs et artworks qui perdent leur ancrage)
- [x] Routes API : `/api/products`, `/api/products/[id]`, `/api/products/[id]/logo`, `/api/products/[id]/flats`, `/api/products/[id]/flats/[flatId]`, validées par Zod
- [x] `zod` ajouté en dépendance
- [x] Suite de tests (`bun test`) : 99 tests, 217 assertions, 5 fichiers, dans `tests/` à la racine plutôt qu'à côté du code testé. `@types/bun` ajouté en devDependency (sinon `tsc --noEmit` échoue sur `bun:test`)
- [x] Recette API rejouable `scripts/api-check.sh` (`bun run test:api`) : 19 points vérifiés contre un serveur local sur le port 3100, création puis suppression de vraies données, contrôle qu'il ne reste ni ligne ni fichier orphelin
- [x] `import 'server-only'` en tête de `lib/db/index.ts` et `lib/storage/index.ts`
- [x] Robustesse diverse : `apiError` ne sérialise `details` qu'en dehors de la production, `touchProduct()` dans `lib/db/queries.ts` (à appeler par tout module qui dépose ou supprime un flat, pour tenir `products.updated_at` à jour), avertissement à la saisie sur un second flat FRONT ou BACK, `fileUrl()` encode les segments d'URL

### Vérifié

- [x] `bun test` : 99 tests, 217 assertions, 5 fichiers : cohérence interne de `headerLayout.ts`, détection de géométrie de header recopiée hors de sa source unique, schémas de validation Zod, helpers de formatage (fuseau, locale), `oneOf` et `fileUrl`
- [x] L'invariant de la règle dure n°2 (géométrie du header à un seul endroit) est désormais vérifié par un test, pas seulement décrit en prose dans `headerLayout.ts`. Test vu échouer avant d'être validé : valeur de colonne modifiée temporairement, échec constaté, valeur restaurée
- [x] Recette API `scripts/api-check.sh` : 19 points au vert
- [x] `bun run typecheck`, `bun run lint`, `bun run build` passent
- [x] Stack Docker complet vérifié, l'app crée une ligne en base depuis le conteneur

### Revue de code du 2026-07-28

Section distincte des « Bloquants résolus » plus bas : ces défauts viennent d'une revue interne menée pendant une phase encore en cours, ils n'ont jamais bloqué le travail.

| # | Défaut | Correction |
|---|---|---|
| 1 | Dimensions du slot logo (`72pt`, `70pt`) et couleur `#CCCCCC` du header recopiées en dur dans `ProductCreateForm.tsx` (violation de la règle dure n°2) | Import de `LOGO_SLOT` et `TP_COLORS` depuis `headerLayout.ts` |
| 2 | `measureTextPt.ts` lisait la variable CSS `--font-techpack` sur `document.documentElement`, or `next/font` la pose sur `<body>` : la valeur lue était vide, repli silencieux sur `sans-serif`, avertissement de débordement déclenché trop tôt (Source Sans 3 plus étroite qu'Arial) | Lecture corrigée sur `<body>`, plus hook `useFontsReady` : avec `display: 'swap'`, le premier rendu utilise la police de repli tant que `document.fonts.ready` n'est pas résolu |
| 3 | `useAutoSavePatch.ts` : deux PATCH en vol sur le même champ pouvaient arriver dans le désordre (écran annonçant « Enregistré » avec l'ancienne valeur en base) ; le renvoi de dernière chance au démontage était conditionné à un timer de debounce encore armé, alors qu'il est consommé dès qu'il se déclenche | Sérialisation (une requête en vol au maximum, file d'un élément) ; renvoi de dernière chance appliqué sans condition sur les deux chemins |
| 4 | Le rendu print tronquait silencieusement le texte en débordement (`overflow: hidden`), alors que l'éditeur annonçait à l'utilisateur un débordement vers la colonne suivante : contradiction directe avec `12-pieges.md` | Débordement rendu réel et visible au print |
| 5 | Décalage de 1pt entre print et éditeur sur l'encadré rouge de la taille de référence : le print compensait le padding mais pas la largeur de bordure | Padding et bordure appliqués aux deux, bordure transparente sur les tailles non sélectionnées |
| 6 | Un produit pouvait rester créé en base malgré une réponse 500 : le POST insérait la ligne puis copiait le logo, une copie en échec laissait la ligne orpheline | Identifiant généré côté application (`crypto.randomUUID()`), copie du fichier avant l'insert, chemin final inséré directement, fichier copié supprimé si l'insert échoue |
| 7 | `logoStoragePath` acceptable en PATCH permettait de faire pointer un produit vers le fichier d'un autre, puis de faire supprimer ce fichier en déposant un nouveau logo | Champ retiré du schéma de PATCH (conservé en création pour le pré-remplissage), vérification `belongsToProduct()` avant toute suppression |
| 8 | Trois routes de suppression renvoyaient un 500 trompeur sur une erreur disque survenue après une suppression en base déjà effectuée | Erreurs disque avalées et journalisées, fichier restant traité comme orphelin connu |
| 9 | Chaîne vide et `null` cohabitaient pour représenter le même vide selon le point d'entrée (formulaire de création vs header éditable) | Normalisé dans le schéma Zod |
| 10 | L'intensité de dégradé affichée n'était pas celle stockée : la page repliait `null` sur `medium` sans émettre de PATCH | Select propose « non renseignée », incohérence « dégradé activé sans intensité » signalée visuellement |

## Prochaine action

Phase 2, branche `feature/measurement-canvas`, après recette manuelle de Jay et merge de la Phase 1.

## Reste à faire, hors phase

- [ ] `pg_dump` en cron, **avant toute utilisation sérieuse**. Ouvert depuis la Phase 0 : la base vit dans un volume Docker, un `docker compose down -v` malheureux efface tout sans filet.

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
| 2026-07-28 | Lecture de `DATABASE_URL` au chargement du module `lib/db/index.ts` cassait `next build` dans Docker (`Failed to collect page data for /api/products`) | Connexion paresseuse : `lib/db/index.ts` expose un `Proxy` qui crée le pool au premier accès réel |
| 2026-07-28 | Volume Docker `storage-data` créé avec le propriétaire root, upload impossible en `EACCES` sous l'utilisateur non-root `nextjs` | `RUN mkdir -p /app/storage && chown nextjs:nodejs /app/storage` avant `USER nextjs` dans le Dockerfile, plus suppression du volume existant pour que le correctif s'applique |

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
| 2026-07-28 | Pas de route `/api/upload` générique | L'upload écrit un fichier ET une ligne en base, les séparer exposerait à un fichier sans ligne ou l'inverse. La validation MIME et le plafond de taille sont déjà centralisés dans `lib/storage`, ce qui était la raison d'être de la route générique |
| 2026-07-28 | `size_range` restreint aux 10 colonnes du tableau page 3 à la saisie, bien que la base accepte un `text[]` libre | Une taille hors de ces colonnes n'aurait aucune colonne où s'afficher et disparaîtrait silencieusement à la génération |
| 2026-07-28 | Le logo pré-rempli est **dupliqué** côté serveur à la création, pas partagé | Sans ça, deux produits pointeraient sur le même fichier et supprimer le premier casserait le second |
| 2026-07-28 | La taille de référence se change dans le header (clic sur la taille, encadré rouge), et la case correspondante est verrouillée dans la gamme de tailles | Décocher produirait un 400 sans issue évidente, à cause du CHECK `products_sample_size_in_range` |
| 2026-07-28 | Connexion Postgres paresseuse via un `Proxy` dans `lib/db/index.ts` | Pour que `next build` n'exige pas `DATABASE_URL` |
| 2026-07-28 | Tests dans `tests/` à la racine, pas à côté du code testé | Un des tests scanne `components/` à la recherche de littéraux de géométrie du header : un fichier de test posé à côté du code contiendrait ces littéraux et se signalerait lui-même |
| 2026-07-28 | `import 'server-only'` en tête de `lib/db/index.ts` et `lib/storage/index.ts` | La frontière serveur ne doit pas dépendre du seul mot-clé `type` à l'import : un import oublié doit faire échouer le build, pas fuiter `DATABASE_URL` dans le bundle client |
| 2026-07-28 | Intensité de dégradé : affichage « non renseignée » plutôt qu'un repli sur `medium` suivi d'un PATCH automatique | Un écrit en base déclenché par un simple affichage contredirait l'auto-save par champ, et produirait en Phase 5 un prompt construit sur une intensité que Jay n'a jamais validée |

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

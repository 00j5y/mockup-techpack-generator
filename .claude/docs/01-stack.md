# 01 - Stack technique

| Couche | Choix | Justification |
|---|---|---|
| Framework | Next.js 15 (App Router) | Cohérent avec Konexx et jaylheronde.fr |
| Langage | TypeScript strict | Standard sur tous les projets existants |
| Runtime / package manager | Bun | Cohérent avec discord-deploy-bot, ai-mail-assistant |
| Base de données | **Postgres 17 auto-hébergé (Docker)** | Voir la décision ci-dessous |
| Accès base | **Drizzle ORM** | TypeScript strict de bout en bout, le schéma génère les types et les migrations |
| Storage fichiers | **Système de fichiers local** (volume Docker) | Voir la décision ci-dessous |
| Auth | **Aucune pour l'instant** | Outil personnel, en local. Bloquant avant tout déploiement public |
| Éditeur canvas | react-konva (Konva.js) | Bonne intégration React, léger, export image natif |
| Génération PDF | Puppeteer (HTML → PDF) | Contrôle pixel-perfect, réutilise le CSS/HTML des composants |
| Génération image IA | API OpenAI, modèle GPT Image | Multi-image input, qualité paramétrable |
| Styling | Tailwind CSS | Cohérent avec le reste du stack |
| Déploiement | Docker sur VPS Hetzner | Cohérent avec l'infra existante |
| État client | React state d'abord, Zustand si besoin | À trancher en Phase 2 selon la complexité réelle du canvas |

## Sortie de Supabase (décidé le 2026-07-27)

La spec initiale prévoyait Supabase pour la base, le storage et l'auth. Jay a atteint son quota de projets gratuits. On est sortis des trois d'un coup.

### Postgres et pas MySQL

MySQL avait été évoqué. Écarté : le schéma utilise `text[]` (`size_range`, `sample_sizes`, `input_flat_ids`), `check (sample_sizes <@ size_range)`, `uuid` + `gen_random_uuid()` et `timestamptz`. Aucun n'a d'équivalent direct en MySQL. La bascule aurait signifié réécrire toute la migration et perdre la contrainte qui rend l'incohérence Seaggs impossible, pour zéro gain.

### Postgres et pas Firestore

Firebase a été évoqué. Écarté pour trois raisons concrètes :

1. **`getFullProduct()` deviendrait du N+1.** En Postgres c'est une requête avec jointures. En Firestore, 8 requêtes de collections plus une requête imbriquée par point de mesure. Or cette fonction est la garantie que la preview et le PDF montrent la même chose.
2. **Firestore n'a aucune contrainte.** Les `unique`, les `check` et les 12 `on delete cascade` passeraient en code applicatif. Le cascade est le pire des trois : supprimer un produit laisserait des orphelins sans que personne le voie.
3. **On perdrait le gain CORS** décrit ci-dessous.

### Le stockage local est un gain, pas un pis-aller

Les fichiers sont servis par l'application elle-même via `/api/files/[...path]`, donc **à la même origine que le canvas**. Le piège du canvas *tainted*, qui faisait échouer `stage.toDataURL()` et menaçait toute la Phase 2, **disparaît par construction**. Aucun en-tête CORS à configurer, aucune URL signée à faire expirer au mauvais moment.

### La décision d'hébergement reste réversible

Drizzle ne connaît que `DATABASE_URL`. Passer du Postgres Docker à du managé (Neon, Railway) est un changement de variable d'environnement, zéro ligne de code. C'est le bénéfice discret de ne pas s'être lié à un SDK propriétaire.

Contrepartie assumée : les sauvegardes sont notre responsabilité. Un `pg_dump` en cron à mettre en place avant toute utilisation sérieuse.

## Points à vérifier au moment du dev (ne pas coder de mémoire)

### Modèle OpenAI de génération d'image

La spec cible **GPT Image 2** (`gpt-image-2`). L'identifiant exact, les valeurs acceptées pour `quality`, le format d'entrée multi-image et la tarification doivent être **vérifiés contre la doc OpenAI officielle** au début de la Phase 5. Ne pas hardcoder un identifiant de modèle sans l'avoir confirmé : c'est la cause d'erreur la plus probable sur ce module.

Conséquence architecturale : l'identifiant du modèle et la table de tarification vivent dans une **constante unique** (`lib/openai/config.ts`), pas éparpillés dans le code d'appel.

### Version de Next.js

La spec dit Next.js 15 pour rester cohérent avec les autres projets. Si une version majeure plus récente est disponible au moment du setup, en parler à Jay avant de dévier : la cohérence inter-projets est un objectif explicite, pas un détail.

### État client : décision différée

Ne pas installer Zustand en Phase 0. Commencer l'éditeur de mesures en React state local. Si la gestion de l'undo/redo + sélection + drag devient illisible, alors introduire Zustand, et seulement à ce moment.

## Contraintes techniques connues du stack

### Puppeteer

- **Ne fonctionne pas dans une Vercel Function classique**, et pas non plus dans le runtime edge. Le déploiement Docker sur Hetzner est justement ce qui rend ce choix viable.
- Le Dockerfile doit installer Chromium et ses dépendances système. C'est la source classique d'un build qui passe en local et casse en prod. Voir `13-env-setup.md`.
- Le rendu PDF est une opération lourde : route API en Node runtime, timeout généreux.

### react-konva

- Le composant Konva **doit être chargé côté client uniquement** (`dynamic(() => import(...), { ssr: false })`). Konva touche au DOM/canvas et casse au render serveur.
- L'export via `stage.toDataURL()` échoue si une image de fond vient d'une autre origine (canvas "tainted"). **Neutralisé par construction** : les flats sont servis par `/api/files/[...path]`, à la même origine que l'app. Ne pas réintroduire d'origine tierce.

### Postgres et Drizzle

- `lib/db/schema.ts` est **la source unique** : il génère les migrations SQL (`drizzle/`) et les types (`types/product.ts`). Ne jamais écrire un type d'entité à la main à côté.
- `lib/db/index.ts` et `lib/storage/` sont **serveur uniquement**. `DATABASE_URL` contient le mot de passe de la base.
- Les `numeric` sont déclarés en `mode: 'number'`. Sans ça, Drizzle renvoie des chaînes et tout le calcul de coordonnées casse silencieusement.
- `drizzle.config.ts` charge `.env.local` avec `dotenv` : drizzle-kit s'exécute dans un sous-processus Node qui ne voit pas les variables chargées par Bun.

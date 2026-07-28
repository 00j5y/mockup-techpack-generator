# 01 - Stack technique

| Couche | Choix | Justification |
|---|---|---|
| Framework | Next.js 15 (App Router) | Cohérent avec Konexx et jaylheronde.fr |
| Langage | TypeScript strict | Standard sur tous les projets existants |
| Runtime / package manager | Bun | Cohérent avec discord-deploy-bot, ai-mail-assistant |
| Base de données | Supabase (Postgres) | Déjà utilisé sur Konexx, gère aussi le storage |
| Storage fichiers | Supabase Storage | Flats, inspo, visuels générés, PDFs |
| Auth | Supabase Auth (email/password) | Mono-utilisateur, pas besoin de plus |
| Éditeur canvas | react-konva (Konva.js) | Bonne intégration React, léger, export image natif |
| Génération PDF | Puppeteer (HTML → PDF) | Contrôle pixel-perfect, réutilise le CSS/HTML des composants |
| Génération image IA | API OpenAI, modèle GPT Image | Multi-image input, qualité paramétrable |
| Styling | Tailwind CSS | Cohérent avec le reste du stack |
| Déploiement | Docker sur VPS Hetzner | Cohérent avec l'infra existante |
| État client | React state d'abord, Zustand si besoin | À trancher en Phase 2 selon la complexité réelle du canvas |

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
- L'export via `stage.toDataURL()` nécessite que les images de fond soient chargées **sans problème CORS**, sinon le canvas est "tainted" et l'export échoue silencieusement. Les flats servis depuis Supabase Storage doivent être chargés avec `crossOrigin = 'anonymous'`.

### Supabase

- Client navigateur (`lib/supabase/client.ts`) et client serveur (`lib/supabase/server.ts`) sont **deux fichiers distincts**. Ne jamais utiliser la `service_role` key côté client.
- Le storage doit être configuré en bucket privé + URLs signées, ou bucket public selon le besoin. À trancher en Phase 0 en tenant compte de la contrainte CORS de Konva ci-dessus.

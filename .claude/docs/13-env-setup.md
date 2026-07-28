# 13 - Setup local, variables d'environnement, Docker

## Variables d'environnement

`.env.local` (jamais committé). Un `.env.example` avec les mêmes clés mais des valeurs vides **est** committé.

```bash
# Base de donnees
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # serveur uniquement, JAMAIS de préfixe NEXT_PUBLIC_

# OpenAI
OPENAI_API_KEY=                   # serveur uniquement

# Puppeteer (prod / Docker)
PUPPETEER_EXECUTABLE_PATH=        # ex: /usr/bin/chromium, vide en local
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD= # "true" en Docker si Chromium vient de l'OS

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Règle : toute variable **sans** préfixe `NEXT_PUBLIC_` est inaccessible côté client. Si une clé secrète a besoin du préfixe pour "marcher", c'est que l'appel est au mauvais endroit.

## Setup local

```bash
bun install
cp .env.example .env.local   # les valeurs par defaut suffisent en local
bun run db:up                # lance Postgres dans Docker
bun run db:migrate           # applique les migrations
bun run dev
```

**Ne jamais modifier le schéma à la main.** Le cycle est : éditer `lib/db/schema.ts`, puis `bun run db:generate` (produit un fichier SQL dans `drizzle/`, à committer), puis `bun run db:migrate`.

## Stockage des fichiers

Système de fichiers local, via `lib/storage`. `.storage/` en dev, volume Docker `storage-data` en production. Arborescence :

| Chemin | Contenu |
|---|---|
| `products/{id}/flats/` | Flats techniques et photos d'inspo |
| `products/{id}/overlays/` | Exports canvas (flat + annotations de mesure) |
| `products/{id}/bom/` | Images des éléments de BOM |
| `products/{id}/packaging/` | Images de tags et packaging |
| `products/{id}/artwork/` | Fichiers d'artwork |
| `products/{id}/extra/` | Images de références libres |
| `products/{id}/logo/` | Logo du header |
| `products/{id}/visuals/` | Visuels générés par IA |
| `products/{id}/techpacks/` | PDFs générés |

Les fichiers sont servis par `/api/files/[...path]`, donc **à la même origine que l'application**. C'est ce qui élimine le problème de canvas *tainted* de la Phase 2 : plus aucune image ne vient d'une origine tierce.

`lib/storage` valide le type MIME, plafonne à 25 Mo, et **refuse tout chemin sortant de la racine de stockage**. Les chemins viennent de la base ou d'une requête : ils sont à traiter comme non fiables.

## Sauvegardes

La base est auto-hébergée, donc les sauvegardes sont notre responsabilité. À mettre en place avant toute utilisation sérieuse :

```bash
docker compose exec -T db pg_dump -U constitue constitue_studio | gzip > sauvegarde-$(date +%F).sql.gz
```

Le dossier de stockage se sauvegarde séparément : c'est un simple volume de fichiers.

## Docker

Le `Dockerfile` doit être écrit **en Phase 0**, avec Chromium, même si Puppeteer n'est utilisé qu'en Phase 4. Découvrir un problème de dépendances Chromium en fin de projet coûte une journée.

Structure attendue :

- Image de base avec Bun
- Installation de Chromium et de ses dépendances système via le gestionnaire de paquets de l'image
- `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true` et `PUPPETEER_EXECUTABLE_PATH` pointant vers le Chromium système
- Build Next.js en mode `standalone` pour réduire la taille de l'image
- Utilisateur non-root pour l'exécution

Vérification Phase 0 : `docker compose up` démarre l'app **et** un script de test lance Puppeteer, ouvre une page et génère un PDF vide. Si ce test passe, la Phase 4 ne rencontrera pas de surprise d'infra.

## Déploiement

VPS Hetzner, Docker, cohérent avec l'infra des autres projets. Le déploiement n'est pas un objectif de phase : à traiter quand l'app a une valeur d'usage réelle (après Phase 4).

## Scripts attendus dans `package.json`

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "typecheck": "tsc --noEmit",
  "test": "bun test"
}
```

`typecheck` et `lint` doivent passer avant tout merge (voir `11-git-workflow.md`).

# 13 - Setup local, variables d'environnement, Docker

## Variables d'environnement

`.env.local` (jamais committé). Un `.env.example` avec les mêmes clés mais des valeurs vides **est** committé.

```bash
# Supabase
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
bun run dev
```

Base de données : appliquer les migrations de `supabase/migrations/` sur le projet Supabase. Ne pas modifier le schéma à la main dans le dashboard : toute évolution passe par un fichier de migration versionné.

## Buckets Supabase Storage

À créer en Phase 0 :

| Bucket / préfixe | Contenu |
|---|---|
| `products/{id}/flats/` | Flats techniques et photos d'inspo |
| `products/{id}/overlays/` | Exports canvas (flat + annotations de mesure) |
| `products/{id}/bom/` | Images des éléments de BOM |
| `products/{id}/packaging/` | Images de tags et packaging |
| `products/{id}/artwork/` | Fichiers d'artwork |
| `products/{id}/extra/` | Images de références libres |
| `products/{id}/visuals/` | Visuels générés par IA |
| `products/{id}/techpacks/` | PDFs générés |

**Décision à prendre en Phase 0** : bucket public ou privé avec URLs signées.

Contrainte à intégrer dans la décision : l'export canvas de la Phase 2 exige que les images de flats soient chargeables **sans problème CORS** (`crossOrigin = 'anonymous'`), sinon `toDataURL` échoue. Tester ce cas concret avant de figer le choix. Le plus simple qui fonctionne : bucket public pour les flats, privé pour les PDFs et visuels générés.

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

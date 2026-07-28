# 09 - Endpoints API

## Tableau de référence

| Route | Méthodes | Rôle |
|---|---|---|
| `/api/products` | GET, POST | Liste / création produit |
| `/api/products/[id]` | GET, PATCH, DELETE | Détail / mise à jour / suppression |
| `/api/products/[id]/flats` | POST | Upload d'un flat |
| `/api/measurements` | GET, POST, PATCH, DELETE | CRUD points de mesure |
| `/api/measurements/export-overlay` | POST | Reçoit le canvas exporté, stocke l'image |
| `/api/bom` | GET, POST, PATCH, DELETE | CRUD BOM |
| `/api/colors` | GET, POST, PATCH, DELETE | CRUD couleurs |
| `/api/packaging` | GET, POST, PATCH, DELETE | CRUD packaging |
| `/api/artwork` | GET, POST, PATCH, DELETE | CRUD artwork |
| `/api/generate-image` | POST | Appelle OpenAI avec un prompt fourni, stocke le résultat |
| `/api/generate-techpack` | POST | Rend le PDF complet via Puppeteer |

Routes à ajouter, absentes du tableau initial mais nécessaires :

| Route | Méthodes | Rôle |
|---|---|---|
| `/api/measurement-values` | PATCH | Upsert d'une valeur (point + taille), appelé par l'auto-save du tableau |
| `/api/callouts` | GET, POST, PATCH, DELETE | CRUD callouts |
| `/api/extra` | GET, POST, PATCH, DELETE | CRUD références extra |

## Conventions communes

- **Validation systématique des entrées** avec Zod. Le schéma Zod est la source de vérité du contrat d'API et sert à dériver les types.
- Réponses d'erreur uniformes : `{ error: string, details?: unknown }` avec le bon code HTTP (400 validation, 401 non authentifié, 404 introuvable, 500 serveur).
- Pas d'auth pour l'instant (outil personnel en local). À rétablir avant tout déploiement public : voir `01-stack.md`.
- Les routes de CRUD prennent `product_id` en query ou dans le body selon la méthode, et vérifient que la ressource appartient bien à un produit existant.
- `runtime = 'nodejs'` explicite sur `/api/generate-techpack` (Puppeteer) et `/api/generate-image`.

## Notes spécifiques

### `/api/measurement-values` (PATCH)

Appelé très fréquemment (une frappe dans le tableau de mesures = un appel après debounce). Doit être un **upsert** sur la contrainte `unique(measurement_point_id, size)`, pas un select-puis-insert-ou-update.

### `/api/measurements/export-overlay` (POST)

Reçoit un dataURL base64 qui peut être volumineux (un PNG en `pixelRatio: 2` d'un flat détaillé). Points d'attention :

- Vérifier la limite de taille de body de la route (configurer si nécessaire)
- Décoder le base64 côté serveur, écrire le buffer via `lib/storage` (`putDataUrl`)
- Écraser l'overlay précédent du même flat plutôt qu'accumuler des fichiers orphelins

### `/api/generate-image` (POST)

Reçoit **un prompt déjà validé par l'utilisateur**, jamais des données produit brutes à transformer en prompt. Cette contrainte est structurelle : elle rend impossible une génération sans review côté client.

Body attendu : `{ productId, prompt, quality, flatIds }`.

### `/api/generate-techpack` (POST)

- Récupère les données via la fonction partagée `getFullProduct(productId)`
- Lance Puppeteer, rend, stocke, crée la révision
- Retourne le chemin du PDF et le numéro de version
- Opération lourde : prévoir un état de chargement explicite côté client, et un timeout serveur suffisant

### `/api/upload`

Le dossier `app/api/upload/` figure dans l'arborescence de la spec. Décision à prendre en Phase 1 : soit une route d'upload générique paramétrée par destination (`flats`, `bom`, `packaging`, `artwork`, `extra`), soit des écritures dispersées dans chaque route.

Recommandation : **route générique côté serveur**. Elle permet de valider le type MIME, la taille, et de normaliser le chemin de stockage en un seul endroit. Un upload direct depuis le client disperse ces règles.

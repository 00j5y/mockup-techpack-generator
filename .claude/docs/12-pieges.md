# 12 - Pièges et anti-patterns

**À relire avant chaque phase.** Ce fichier regroupe les erreurs qui coûtent le plus cher sur ce projet précis.

## Les 5 signaux d'alarme architecturaux

Si l'un de ces cas se produit, **s'arrêter et corriger**, pas contourner :

| Signal | Ce que ça révèle |
|---|---|
| Je copie-colle le markup du header dans une page de techpack | `TechpackHeader` n'est pas correctement paramétré |
| J'écris du code qui recopie des mesures dans une structure dédiée au PDF | La page 3 doit dériver directement de `measurement_points` + `measurement_values` |
| Je stocke une position en pixels | Le flat réexporté cassera tout |
| Je construis un second éditeur canvas pour les callouts | La Phase 2 a été mal découpée |
| `AnnotatedCanvas` contient le mot "measurement" | La primitive n'est pas générique, les 5 autres pages qui en dépendent vont dupliquer du code |
| `buildImagePrompt` a besoin d'un accès base | La fonction n'est plus pure, donc plus testable sans coût |
| Je code une page de techpack en flexbox ou grid fluide | Le template est un document Illustrator en positions absolues, les coordonnées sont connues au point près |

## Pièges spécifiques au template Seaggs

Découverts en analysant le template et l'exemple rempli. Détail dans `15-template-seaggs.md`.

### Format de page

Le techpack est en **paysage `761.4 x 581.4 pt`**, un format custom. Passer `format: 'A4'` ou `format: 'Letter'` à Puppeteer produit un PDF au mauvais ratio dont toute la mise en page est décalée.

Deux pièges vérifiés en Phase 0, tous deux invisibles à la lecture du code :

- **`page.pdf()` rejette l'unité `pt`.** `width: '761.4pt'` lève `Failed to parse parameter value`. Seuls `px`, `in`, `cm`, `mm` passent. Utiliser `'10.575in'` / `'8.075in'`. Le CSS `@page`, lui, accepte les points : l'interdiction est côté JavaScript uniquement.
- **Le PDF sort en `761.04 x 581.04`, pas en `761.4 x 581.4`.** Chromium tronque la taille de page au centième de pouce. Ne pas « corriger » les coordonnées de la doc pour compenser : l'écart est de 0,05 % et tombe dans le cadre extérieur de 5 pt. Détail dans `15-template-seaggs.md`.

### Nombre de pages

**Toujours 12 pages**, même vides. L'exemple rempli garde les pages 9, 11 et 12 vides avec leur header et leur cadre. Une génération qui saute les pages sans données produit un techpack non conforme.

Corollaire : les emplacements sont en **nombre fixe** (17 mesures, 12 callouts, 6 couleurs, 12 cellules BOM, 2 pages artwork, 3 extra). Tronquer silencieusement à la génération est le pire comportement possible : l'information disparaît sans que personne le voie. Avertir **à la saisie**.

### Code couleur

Tout ce que l'utilisateur renseigne est **rouge `#FF0000`**, toute la structure est en `#231F20` ou `#CCCCCC`. **Sauf le texte des cellules BOM, qui est noir.** Cette exception est facile à rater : elle se voit immédiatement en comparant à `exemple-p-04.jpg`.

### Style des cotes

Les cotes ont des **embouts perpendiculaires** (`⊢⊣`), **pas des flèches**. La spec initiale du projet disait "flèches aux deux bouts", c'était une erreur de lecture. Les cotes obliques existent (mesure de manche), donc les embouts doivent être perpendiculaires au trait, pas systématiquement horizontaux ou verticaux.

### Filigrane

Le filigrane `SEAGGS` tuilé en `#F7F7F7` est la marque de l'auteur du template, pas un élément de mise en page. **Ne pas le reproduire, ne pas le remplacer.** Zones de contenu en blanc pur.

Piège de lecture : ce gris représente 33 % des pixels du template vierge. En analysant les couleurs dominantes d'une page on peut croire à un fond de zone de contenu gris clair. C'est le filigrane, le fond est blanc.

### Polices

Le template utilise **Myriad Pro**, disponible sur la machine de Jay uniquement via le cache obfusqué Adobe Fonts, et dont la licence ne couvre pas l'installation sur un serveur. Substitut retenu : **Source Sans 3**.

Ne pas se contenter d'un fallback système : l'écart se verrait sur la barre de titre et le header, présents sur les 12 pages. Et Source Sans 3 n'étant pas métriquement compatible avec Myriad Pro, prévoir un ajustement de corps ou de `letter-spacing` sur ces zones. Détail dans `15-template-seaggs.md`.

### Artwork blanc sur fond blanc

Une impression blanche rendue sur le fond blanc de la page est **invisible**. L'exemple place systématiquement les impressions blanches sur un rectangle noir. D'où le champ `background_hex` sur `artwork_specs`. Sans lui, la page 8 paraît à moitié vide sans qu'on comprenne pourquoi.

### Taille de référence

`products.sample_size` pilote trois rendus : l'encadré rouge du `SIZE RANGE:` dans le header, la colonne remplie de la page 3, et les valeurs affichées sur les cotes de la page 2. Les faire dériver de trois sources différentes reproduirait l'incohérence de l'exemple Seaggs, où l'encadré est sur `XL` et les valeurs dans la colonne `L`.

## Coordonnées et canvas

### Le piège du référentiel

Trois espaces de coordonnées coexistent dans l'éditeur :

1. L'espace **naturel de l'image** (ex: 2000x2500 px, la résolution du fichier)
2. L'espace **du canvas à l'écran** (ex: 800x1000 px)
3. L'espace **après zoom/pan** (transformation du Stage)

Les pourcentages stockés en base se réfèrent **toujours à l'espace naturel de l'image**. Mélanger les référentiels produit un bug invisible en édition et catastrophique à l'export PDF. Centraliser la conversion dans un helper testé, ne jamais la faire inline.

### Le canvas "tainted" : neutralisé, mais à ne pas réintroduire

`stage.toDataURL()` lève une `SecurityError` si une image du canvas vient d'une origine sans en-tête CORS approprié. C'était le principal risque de la Phase 2, avec un symptôme trompeur : tout marche en dev avec des images locales, l'export casse avec les images distantes.

**Ce risque a disparu en Phase 0.** Les fichiers sont servis par `/api/files/[...path]`, donc à la même origine que l'application : il n'y a plus d'origine tierce à contaminer le canvas. C'est le bénéfice principal de la sortie de Supabase Storage.

Ce qui le ferait revenir, et qu'il faut donc refuser :

- servir les flats depuis un CDN, un bucket S3, ou n'importe quel autre domaine
- utiliser une URL absolue vers un autre hôte dans le `Konva.Image`
- passer par un service de transformation d'image tiers

Si un jour le stockage doit migrer vers un objet distant, ce piège redevient actif et il faudra le retester **avant** d'écrire quoi que ce soit d'autre.

### L'UI dans l'export

Les halos de sélection, poignées de drag, curseurs et grilles d'aide font partie du canvas : ils **apparaissent dans l'export** si on ne les masque pas. Prévoir un état `isExporting` qui les désactive avant le `toDataURL`.

## Konva et SSR

`react-konva` touche au DOM et casse au rendu serveur. Le composant doit être importé en `dynamic(() => import('...'), { ssr: false })`. Symptôme si oublié : erreur cryptique du type "Cannot read property of undefined" au build ou au premier render.

## Puppeteer

### Docker

Le piège classique : Puppeteer marche en local (il télécharge son Chromium), et casse dans le conteneur (dépendances système absentes). Installer Chromium et ses libs **dès la Phase 0** dans le Dockerfile, et vérifier que le build Docker passe, même si la génération PDF n'est codée qu'en Phase 4.

### Le nom de la variable de skip a changé

`PUPPETEER_SKIP_CHROMIUM_DOWNLOAD` est l'ancien nom, abandonné depuis la v20. Depuis, c'est **`PUPPETEER_SKIP_DOWNLOAD`**. L'ancien est ignoré **en silence** : le postinstall tente le téléchargement et le build Docker casse sur l'absence d'`unzip`. Déjà rencontré en Phase 0.

Piège aggravant : `bun` bloque les postinstall par défaut, donc l'erreur reste invisible jusqu'au jour où quelqu'un fait `bun pm trust`. N'autoriser que les paquets qui en ont besoin, jamais `--all`.

### La sortie standalone ne trace que ce que le code importe

`output: 'standalone'` n'embarque dans `node_modules` que les paquets réellement atteints depuis le code de l'app. En Phase 0, l'image ne contient ni `drizzle-orm`, ni `postgres`, ni `puppeteer`, simplement parce qu'aucune page ne les importe encore.

Ce n'est pas un bug, mais **deux vérifications en découlent** :

- **Phase 1** : dès qu'une page importe `lib/db`, vérifier que `drizzle-orm` et `postgres` arrivent bien dans l'image, et que l'app interroge la base depuis le conteneur.
- **Phase 4** : `puppeteer` est déclaré dans `serverExternalPackages`, donc non bundlé. Vérifier que le traçage le copie quand même dans l'image. Si ce n'est pas le cas, il faudra le copier explicitement dans le Dockerfile.

Ne pas supposer que ça marchera : le tester.

### Images non chargées

`page.pdf()` ne garantit pas que les images sont rendues. Un `waitUntil: 'networkidle0'` peut suffire, souvent pas. Ajouter :

- attente sur `document.fonts.ready`
- attente explicite que chaque `<img>` ait `complete === true` et `naturalWidth > 0`

Symptôme si oublié : PDF avec des cases vides à la place des flats, de façon intermittente selon la latence réseau.

### `printBackground`

Sans `printBackground: true`, tous les fonds gris du template disparaissent. Le PDF est alors "presque bon", ce qui est le pire cas : on peut ne pas le remarquer tout de suite.

### Polices

Une police chargée depuis une CDN externe qui ne répond pas dans le conteneur = fallback silencieux vers une police système = toute la mise en page décalée. Embarquer les polices localement (`next/font` avec des fichiers locaux, ou `@font-face` sur des fichiers du repo).

### Pages blanches

`page-break-after: always` sur le dernier élément génère une page blanche finale. Utiliser `:last-child { page-break-after: auto }`.

## Base de données et stockage

- **`lib/db` est serveur uniquement.** `DATABASE_URL` contient le mot de passe de la base. Un import depuis un fichier atteint par un Client Component la ferait fuiter dans le bundle. Même règle pour `lib/storage`.
- **Cascade de suppression.** Supprimer un flat cascade sur `measurement_points` et `callouts`, et met à `null` le `flat_id` de `color_specs` et `artwork_specs`. Avertir explicitement du nombre d'éléments perdus, pas juste "Êtes-vous sûr ?".
- **Fichiers orphelins.** Supprimer une ligne en base ne supprime pas le fichier sur disque. Appeler `deleteFile()` dans la même opération, sinon `.storage/` accumule des orphelins que rien ne référence.
- **Une variable d'environnement vide n'est pas absente.** `STORAGE_DIR=` dans un `.env` donne une chaîne vide, que `??` laisse passer : le stockage se retrouve alors à la racine du projet. Utiliser `process.env.X?.trim() || defaut`. Ce bug est déjà arrivé en Phase 0.
- **drizzle-kit ne voit pas les variables chargées par Bun.** Il évalue `drizzle.config.ts` dans un sous-processus Node. D'où le `dotenv` explicite dans le fichier de config. Sans lui : `url: undefined`.
- **Ne jamais modifier la base à la main.** Toute évolution passe par `lib/db/schema.ts`, puis `bun run db:generate`, puis `bun run db:migrate`. Le SQL de `drizzle/` est généré et committé, jamais édité.

## Auto-save

- Ne jamais perdre la saisie en cas d'échec réseau : garder la valeur locale, afficher l'erreur, permettre un retry.
- Attention au conflit entre auto-save et navigation : un `PATCH` en vol quand l'utilisateur change de page peut être annulé. Flush le debounce au `beforeunload` et au démontage du composant.
- Un debounce par champ, pas un debounce global qui écraserait des champs non modifiés.

## Génération IA

- **Coût réel.** Chaque test consomme de l'argent. Développer avec `quality: 'low'`, et tester la construction du prompt sans appel API grâce aux tests unitaires de `buildImagePrompt`.
- **Ne pas hardcoder l'identifiant du modèle ni les prix** de mémoire : vérifier la doc OpenAI. Centraliser dans `lib/openai/config.ts`.
- **Pas de double-clic générateur.** Désactiver le bouton pendant l'appel, sinon deux générations partent et sont facturées.

## Types

- `size_range` est un `text[]` : les colonnes du tableau de mesures et du techpack en dérivent. **Ne jamais hardcoder `['XS','S','M','L','XL','2XL']`** dans un composant. Un produit avec une gamme de tailles différente cassera silencieusement.
- Les mesures sont en **inches** (`value_inches`). Ne pas introduire de conversion cm sans le décider explicitement : une conversion implicite dans un techpack fournisseur est une erreur de production.

## Périmètre

Avant d'ajouter une abstraction "pour plus tard", relire `14-hors-scope.md`. Le projet est mono-utilisateur : pas de couche de permissions, pas de multi-tenant, pas de gestion de conflits d'édition concurrente.

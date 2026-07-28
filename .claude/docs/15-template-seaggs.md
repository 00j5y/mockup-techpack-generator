# 15 - Spécification du template Seaggs

Toutes les valeurs de ce fichier sont **mesurées** sur les PDF sources, pas estimées. Elles sont en **points PostScript** (1pt = 1/72 in), origine en haut à gauche.

## Fichiers de référence

| Fichier | Contenu |
|---|---|
| `template-reference/seaggs-template-vide.pdf` | Le template vierge, 12 pages |
| `template-reference/exemple-p-01.jpg` → `-12.jpg` | Le techpack d'exemple rempli, une image par page |

Source originale : `~/Documents/Constitue/UTILS/Pack/Seaggs 2100+ ULTIMATE Mockup Pack/Seaggs Techpack Template/`

Créé dans Adobe Illustrator 28.4.

## Format de page

**Paysage, format custom : `761.4 x 581.4 pt`** (soit 268.6 x 205.1 mm, ou 10.575 x 8.075 in).

Ce n'est ni A4 ni Letter. Ne pas utiliser `format: 'A4'` dans Puppeteer.

```css
@page { size: 761.4pt 581.4pt; margin: 0; }
.techpack-page { width: 761.4pt; height: 581.4pt; position: relative; overflow: hidden; }
```

```ts
await page.pdf({
  // `pt` est REJETE par page.pdf() : seuls px, in, cm, mm sont acceptes.
  // 761.4pt = 10.575in, 581.4pt = 8.075in.
  width: '10.575in',
  height: '8.075in',
  printBackground: true,
  preferCSSPageSize: true,   // c'est le @page CSS qui fait foi
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
});
```

### Deux pieges verifies en Phase 0

**1. `page.pdf()` refuse l'unite `pt`.** Passer `width: '761.4pt'` leve `Failed to parse parameter value: 761.4pt`. Seuls `px`, `in`, `cm` et `mm` sont acceptes. Le CSS `@page { size: ... }`, lui, accepte les points sans problème : l'unite n'est interdite que du cote JavaScript.

**2. Chromium ne sait produire ni 761.4 ni 581.4 exactement.** Mesure faite sur les deux chemins :

| Chemin | Sortie reelle | Ecart |
|---|---|---|
| `preferCSSPageSize: true` (le `@page` CSS fait foi) | `761.04 x 581.04` | -0.36 pt (-0.047 %) |
| `width` / `height` explicites, `preferCSSPageSize: false` | `762 x 582` | +0.6 pt (+0.079 %) |

Le chemin CSS tronque au centieme de pouce (10.575 in → 10.57 in), l'autre arrondit au pixel entier superieur. **On retient le chemin CSS** : l'ecart est plus faible, et les 0.36 pt perdus tombent dans la bande de cadre exterieure, large de 5 pt, ou ils sont invisibles.

Conséquence pratique : **toutes les coordonnées de ce fichier restent exprimées dans le référentiel 761.4 x 581.4**. Ne pas les recalculer sur 761.04, ce serait décaler toute la mise en page pour corriger une erreur de 0,05 %. Le PDF final mesurera 761.04 x 581.04, c'est normal et c'est la valeur que le test de fumée attend.

## Palette

| Token | Valeur | Usage |
|---|---|---|
| `--tp-frame` | `#231F20` | Cadre extérieur, séparateurs, bordures de tableau |
| `--tp-bar` | `#CCCCCC` | Fond de la barre de titre et du bloc header |
| `--tp-red` | `#FF0000` | **Tout ce que l'utilisateur renseigne** : cotes, valeurs, lettres POI, pins, lettres de cellule BOM, texte d'instruction Pantone |
| `--tp-white` | `#FFFFFF` | Fond des zones de contenu |

Le rouge mesuré est `#FC0000` sur les traits de cote et `#FF0000` sur les textes : c'est la même couleur source (CMJN 0/100/100/0) convertie différemment. Utiliser un seul token `#FF0000`.

**Pas de filigrane.** Le `SEAGGS` en `#F7F7F7` tuilé sur les zones de contenu est la marque de l'auteur du template. Tranché le 2026-07-27 : on ne le reproduit pas et on ne le remplace par rien. Les zones de contenu sont en blanc pur.

## Typographie

Le template utilise **Myriad Pro** (Robert Slimbach et Carol Twombly, Adobe, 1992). Bold pour les libellés, Regular pour les valeurs.

**Substitut retenu : Source Sans 3** (Paul D. Hunt, Adobe, 2012, licence OFL). Même éditeur, même classification humaniste, librement redistribuable.

Pourquoi ne pas utiliser Myriad Pro directement, alors que Jay y a accès via son abonnement Creative Cloud :

- Sur sa machine, la police n'existe **pas en fichier propre**. Elle est livrée par la synchronisation Adobe Fonts dans `~/Library/Application Support/Adobe/CoreSync/plugins/livetype/.r/`, sous forme de fichiers cachés à noms obfusqués (`.15496.otf`...). Aucun `MyriadPro-Bold.otf` dans `/Library/Fonts` ni `~/Library/Fonts`.
- Ce cache est géré par Creative Cloud, lié à l'abonnement actif, et son contenu peut être réorganisé par une mise à jour. En dépendre pour un build Docker est fragile.
- La licence Adobe Fonts couvre l'usage desktop et **l'embarquement dans un PDF**, mais pas l'installation du fichier de police sur un serveur qui génère des documents automatiquement. C'est exactement notre cas d'usage sur le VPS.

À noter : le PDF de sortie, lui, n'est pas le problème. Embarquer une police dans un PDF généré est un usage normal et permis. La contrainte porte uniquement sur le fichier de police présent dans l'image Docker.

**Métriques différentes** : Source Sans 3 n'est pas métriquement compatible avec Myriad Pro, les largeurs de texte vont différer légèrement. Comme le template est en positions absolues, l'ajustement se fait au cas par cas (corps, `letter-spacing`) sur les zones où l'écart se voit : barre de titre et libellés du header, présents sur les 12 pages. À valider visuellement en Phase 4 contre `exemple-p-01.jpg`.

Convention : libellé en **bold**, valeur en **regular**, sur la même ligne, même corps.

## Structure commune à toutes les pages

Bandes horizontales, identiques sur les 12 pages :

| Zone | y | Hauteur | Fond |
|---|---|---|---|
| Cadre haut | 0 → 4 | 5 | `--tp-frame` |
| Barre de titre | 5 → 24 | 20 | `--tp-bar` |
| Séparateur | 25 → 30 | 6 | `--tp-frame` |
| Bloc header | 31 → 100 | 70 | `--tp-bar` |
| Séparateur | 101 → 106 | 6 | `--tp-frame` |
| **Zone de contenu** | **107 → 576** | **470** | variable |
| Cadre bas | 577 → 581 | 5 | `--tp-frame` |

Cadre latéral : `x 0 → 4` et `x 756 → 760`. **Zone de contenu utile : `x 5 → 755` (750 pt de large).**

### Barre de titre

- Titre de page à gauche, `x = 9`, bold, ~14pt de corps
- `PAGE N` à droite, aligné à droite sur `x = 741`, bold, même corps
- Texte noir sur `--tp-bar`

Titres exacts, dans l'ordre :

| Page | Titre |
|---|---|
| 1 | `COVER` |
| 2 | `MEASUREMENTS (MOCKUP)` |
| 3 | `MEASUREMENTS (SPECIFICATIONS)` |
| 4 | `BILL OF MATERIALS, ADORNMENTS, AND EMBELLISHMENTS` |
| 5 | `CALLOUTS` |
| 6 | `COLORS` |
| 7 | `LABEL, TAGS, AND PACKAGING` |
| 8, 9 | `ARTWORK` |
| 10, 11, 12 | `EXTRA` |

### Bloc header (`TechpackHeader`)

Structure : un **slot logo** à gauche, puis **3 colonnes de libellés**.

| Élément | x | Détail |
|---|---|---|
| Slot logo | 5 → 76 (72 x 70) | Séparé du reste par un trait `--tp-frame` à `x 77 → 81`. Logo en `object-fit: contain`, centré. Fond `--tp-bar`, donc **logo transparent (PNG alpha ou SVG) obligatoire** sous peine d'un rectangle blanc visible sur les 12 pages. |
| Colonne 1 | 86 | `COMPANY:` (y 34), `DESIGNER:` (y 58), `DATE:` (y 82) |
| Colonne 2 | 290 | `MAIN FABRIC:` (y 34), `STYLE NUMBER:` (y 58), `SIZE RANGE:` (y 82) |
| Colonne 3 | 528 | `DESCRIPTION:` (y 34), `STYLE NAME:` (y 58) |

Les `y` ci-dessus sont les `yMin` du texte, corps ~10pt, interligne ~24pt.

**`SIZE RANGE:`** affiche la liste statique `XS  S  M  L  XL  2XL  ______` à partir de `x = 359`, et **la taille de référence est encadrée d'un rectangle rouge**. Dans l'exemple c'est `XL`.

Note : dans l'exemple Seaggs, le rectangle rouge est sur `XL` alors que la colonne remplie page 3 est `L`. C'est une incohérence de l'auteur. Dans notre app les deux dérivent du même champ `products.sample_size`, donc le cas ne peut pas se produire.

---

## Page 1 : COVER

| Zone | Coordonnées | Contenu |
|---|---|---|
| Visuel principal | y 107 → 477, x 5 → 755 | Image du produit, libre. C'est ici que va le visuel généré par IA. |
| Bandeau titre | y 478 → 496 | `REVISION HISTORY`, centré, bold |
| Ligne d'en-tête | y 498 → 517 | Libellés de colonnes, bold |
| 4 lignes de données | y 517 → 532 → 547 → 561 → 576 | ~14.5 pt chacune |

Colonnes du tableau de révisions :

| Colonne | x | Largeur |
|---|---|---|
| `HISTORY:` | 5 → 112 | 107 |
| `PAGES:` | 113 → 162 | 49 |
| `DATE SUBMITTED:` | 163 → 272 | 109 |
| `SUMMARY:` | 273 → 755 | 482 |

**Le tableau est vide dans l'exemple rempli** : Seaggs ne s'en sert pas. Chez nous il est alimenté par `techpack_revisions`, plafonné à 4 lignes (les 4 dernières révisions).

## Page 2 : MEASUREMENTS (MOCKUP)

Zone de contenu **coupée en deux panneaux** par un séparateur vertical `--tp-frame` à `x 377 → 381` :

| Panneau | x | Libellé |
|---|---|---|
| Gauche | 5 → 376 (371) | `FRONT`, centré, y 111 → 131, bold ~14pt |
| Droite | 382 → 755 (373) | `BACK`, centré, mêmes réglages |

**Les deux flats sont sur la même page.** Chaque panneau est un cadre blanc à filet fin contenant le flat annoté.

Des **encarts de détail flottants** peuvent être placés librement par-dessus, y compris à cheval sur les deux panneaux (dans l'exemple, un détail de capuche est centré en haut, portant les cotes J et K).

### Style des cotes (à reproduire exactement en Phase 2)

- Traits **rouges épais** (~4 pt), avec des **embouts perpendiculaires** à chaque extrémité (forme `⊢⊣`), **pas de flèches**. C'est une cote de type architectural.
- Valeur en rouge, format `"26 inches"`, placée au-dessus du trait pour une cote horizontale, à côté pour une verticale.
- **Lettre POI en rouge, dans un corps nettement plus grand** que la valeur, placée près d'une extrémité du trait.
- Les valeurs affichées sont celles de la **taille de référence** (`products.sample_size`) uniquement, pas de toutes les tailles.

## Page 3 : MEASUREMENTS (SPECIFICATIONS)

Tableau à bordures noires occupant toute la zone de contenu.

Colonnes :

| Colonne | x | Largeur |
|---|---|---|
| `POI` | 5 → 50 | 45 |
| `Measurements (inches)` | 51 → 279 | 228 |
| 10 colonnes de tailles | 280 → 755 | 47.6 chacune |

Les 10 colonnes de tailles sont **fixes et toujours toutes affichées** : `XS S M L XL 2XL 3XL 4XL 5XL 6XL`. Elles ne dérivent pas de `size_range` : ce dernier détermine seulement lesquelles peuvent recevoir une valeur.

Lignes :

- En-tête : y 107 → 132, bold, noir
- **17 lignes de données** de ~25.4 pt, de y 132 à y 576

Contenu utilisateur : lettre POI, nom de mesure et valeurs **tous en rouge**. Les lignes non utilisées restent vides.

## Page 4 : BILL OF MATERIALS

Grille **4 colonnes x 3 lignes**, cellules blanches séparées par des gouttières `--tp-frame`.

| Colonnes (x) | Lignes (y) |
|---|---|
| 5 → 192, 193 → 381, 382 → 569, 570 → 755 | 107 → 263, 264 → 419, 420 → 576 |

Soit des cellules de ~187 x ~156 pt.

Composition d'une cellule :

- **Lettre en rouge**, bold, petit corps, en haut à gauche, à ~4 pt du bord
- Image centrée dans la moitié haute
- Texte **en noir** (pas en rouge), centré, petit corps, sous l'image : titre puis Pantone sur deux lignes, ou description sur plusieurs lignes
- `measurement_note` rendu comme une **cote rouge** (crochet + libellé `"1 inch"`) à côté de l'image
- Une cellule vide n'affiche que sa lettre rouge

## Page 5 : CALLOUTS

| Zone | y | Contenu |
|---|---|---|
| Zone libre | 107 → 452 | Flats avec les pins de callout posés dessus |
| Séparateur | 452 → 454 | Trait **pointillé** noir horizontal |
| Bande de légende | 454 → 576 | 3 colonnes x 4 lignes |

Colonnes de la bande, séparées par des **traits pointillés verticaux** à `x 254 → 256` et `x 504 → 506` :

| Colonne | x | Numéros |
|---|---|---|
| 1 | 5 → 254 | 1 à 4 |
| 2 | 256 → 504 | 5 à 8 |
| 3 | 506 → 755 | 9 à 12 |

4 lignes de ~30.5 pt par colonne. **12 emplacements, toujours tous affichés.** Un emplacement non utilisé montre son pin sans texte.

### Style du pin de callout

Goutte / épingle **rouge** à contour noir, numéro en **blanc** au centre, pointe dirigée vers l'élément désigné. L'orientation (pointe à gauche ou à droite) varie selon le placement sur le flat. Dans la légende, tous les pins pointent à gauche.

## Page 6 : COLORS

| Zone | Contenu |
|---|---|
| Gauche | Flat avec les pins numérotés posés dessus (même style que page 5) |
| Droite | Légende : **6 emplacements** fixes |

Composition d'une ligne de légende : pin numéroté, puis **carré de couleur** (aplat du `hex`, contour noir), puis texte (`pantone_id` s'il existe, sinon `name`).

Dans l'exemple : `1 Pantone 7545 C`, `2 White`, `3 Pantone 7527 C`, `4 Black`, `5` et `6` vides.

Bas de page : **paragraphe d'instruction Pantone en rouge bold**, texte statique du template. À conserver tel quel (c'est un rappel utile au fournisseur), en adaptant éventuellement l'exemple de code hex.

## Page 7 : LABEL, TAGS, AND PACKAGING

**Zone de contenu entièrement libre**, aucune grille. Dans l'exemple, trois blocs placés à la main :

- Titre en **noir, grand corps** (~20 pt) au-dessus de chaque bloc : `Neck tag`, `Cardboard Hang Tag`, `Packaging Bag`
- Image du bloc
- **Cote rouge** avec libellé (`3 inches` horizontal, `7 inches` vertical)
- Optionnel : carré de couleur + `Pantone: 394 C`

Les trois blocs ne sont ni alignés ni de taille égale. Voir `06-module-formulaires.md` pour la décision auto-layout contre canvas libre.

## Pages 8 et 9 : ARTWORK

**Zone de contenu entièrement libre.** Dans l'exemple, la page 8 porte 6 éléments et la page 9 est **vide**.

Composition d'un élément :

- Image de l'artwork, éventuellement **sur un fond noir** quand l'impression est blanche (sinon invisible sur fond blanc). C'est une propriété par élément.
- Libellé de technique en **noir bold, petit corps** : `White print`, `Black print`, `Screenprinted`, `Applique. Made of same material has main fabric.`
- **Cote rouge** avec dimension en inches
- Optionnel : **liste de plusieurs Pantone**, chacun précédé d'un petit carré de couleur. L'exemple en montre 3 sur un seul élément.

## Pages 10, 11, 12 : EXTRA

**Zone de contenu entièrement libre.** Dans l'exemple, la page 10 porte un texte d'instruction en **noir, grand corps** (~28 pt) en haut à gauche, plus une image de référence à droite. Les pages 11 et 12 sont **vides**.

---

## Conséquences structurantes

1. **Le techpack fait toujours 12 pages**, y compris quand des pages sont vides. L'exemple rempli conserve les pages 9, 11 et 12 vides avec leur header. Ne pas générer un nombre de pages dynamique.

2. **Six pages sur douze sont des canvas d'annotation libre** (2, 5, 6, 7, 8, 10-12). L'éditeur de mesures de la Phase 2 n'est donc pas un module isolé : c'est **la primitive centrale de l'application**. Voir `05-module-mesures.md`.

3. **Tout ce que l'utilisateur renseigne est en rouge**, tout ce qui est structure de template est en noir ou gris. Une seule règle à respecter partout.

4. **Le slot logo du header exige une image de marque** au niveau du produit ou de la config globale.

5. **La taille de référence** (`sample_size`) pilote à la fois l'encadré rouge du header et la colonne remplie page 3 et les valeurs affichées page 2.

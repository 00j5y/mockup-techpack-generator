# 05 - Module 2 : Éditeur de mesures (Phase 2)

**Module le plus complexe du projet, et sa primitive centrale.** Ne pas commencer sans avoir lu ce fichier en entier, ni `12-pieges.md`, ni la section "Style des cotes" de `15-template-seaggs.md`.

Route : `/products/[id]/measurements`

## Pourquoi ce module conditionne tout le reste

L'analyse du template Seaggs montre que **6 des 12 pages du techpack sont des canvas d'annotation libre** :

| Page | Ce qui est annoté |
|---|---|
| 2 Measurements (mockup) | Cotes rouges + lettres POI sur les flats front et back |
| 5 Callouts | Pins numérotés sur les flats |
| 6 Colors | Pins numérotés sur un flat |
| 7 Packaging | Blocs image placés librement + cotes rouges |
| 8 Artwork | Éléments d'artwork placés librement + cotes rouges |
| 10-12 Extra | Texte et image placés librement |

Ce ne sont pas six éditeurs à construire, c'est **une primitive à construire une fois**, correctement découplée, puis à réutiliser. Concrètement :

- un `AnnotatedCanvas` générique : image de fond, éléments positionnés en `%`, sélection, drag, zoom/pan, undo/redo, export
- des types d'annotation interchangeables : `DimensionLine` (cote rouge), `Pin` (pastille numérotée), `ImageBlock` (bloc image libre), `TextBlock`

**Si la Phase 2 produit un composant spécifique aux mesures et non réutilisable, la Phase 3 coûtera trois fois plus cher.** C'est le principal risque architectural du projet. Le découpage imposé ci-dessous existe pour ça.

## Découpage des composants (imposé)

| Composant | Responsabilité | Ne fait PAS |
|---|---|---|
| `AnnotatedCanvas.tsx` | Primitive réutilisable : image de fond, zoom/pan, sélection, drag, undo/redo, export. **Agnostique du type d'annotation.** | Connaître la notion de "mesure" |
| `MeasurementEditor.tsx` | Spécialisation mesures : état des points, valeurs par taille, appels API | Le rendu individuel d'un point, la mécanique de zoom |
| `MeasurementPoint.tsx` | Rendu d'un point simple + sa lettre, drag | Écrire en base |
| `MeasurementLine.tsx` | Rendu d'une cote rouge à embouts perpendiculaires, drag des deux bouts | Écrire en base |
| `CanvasToolbar.tsx` | Outils (mode point / mode ligne), zoom, undo/redo, export overlay | Contenir de la logique métier |

`AnnotatedCanvas` est ce que réutiliseront les pages callouts, colors, packaging, artwork et extra en Phase 3. Il ne doit contenir aucune référence à une mesure, une taille ou un POI.

Les composants enfants sont "muets" : ils reçoivent des props et remontent des callbacks (`onDragEnd`, `onSelect`). Toute la logique d'état vit dans `MeasurementEditor`.

## Fonctionnalités

### 1. Sélection du flat de référence

Sélecteur en haut de page listant les flats du produit (front, back, details). Changer de flat change les points affichés : les points sont liés à un `flat_id`, pas au produit global.

### 2. Affichage du flat en fond

- `Konva.Image` en couche de fond, non interactive (`listening={false}`)
- L'image doit être chargée avec `crossOrigin = 'anonymous'` (indispensable pour l'export, voir section export)
- Le canvas s'adapte au ratio de l'image, pas l'inverse

### 3. Création d'un point

Clic sur le canvas en mode "point" :
1. Ouverture d'un popover à l'endroit du clic
2. Champ `measurement_name` (ex: "SHOULDER"), avec autocomplétion sur les noms déjà utilisés dans le projet (confort réel : on retape "CHEST" sur chaque pièce)
3. Champ `point_label` : prérempli avec la prochaine lettre disponible (A, B, C...), **éditable**
4. Validation → création en base + ajout au state

### 4. Création d'une ligne de cote

Mode "ligne" dans la toolbar. Clic-glisser du point de départ au point d'arrivée.

**Rendu exact attendu** (mesuré sur l'exemple Seaggs, page 2) :

- Trait **rouge `#FF0000`, épais, ~4 pt**
- **Embouts perpendiculaires** à chaque extrémité, formant un `⊢⊣`. **Pas de flèches** : c'est une cote de type architectural. La spec initiale disait "flèches aux deux bouts", c'était une erreur de lecture du template.
- Valeur en rouge au format `"26 inches"`, placée au-dessus du trait pour une cote horizontale, à côté pour une verticale
- **Lettre POI en rouge, dans un corps nettement plus grand que la valeur**, près d'une extrémité du trait
- La valeur affichée est celle de la **taille de référence** (`products.sample_size`), pas de toutes les tailles

Stockage : `x_percent`/`y_percent` pour le départ, `end_x_percent`/`end_y_percent` pour l'arrivée.

Les cotes obliques existent dans l'exemple (la mesure de manche C suit l'inclinaison du bras) : le rendu doit gérer un angle quelconque, avec des embouts perpendiculaires au trait, pas systématiquement verticaux ou horizontaux.

### 5. Panneau latéral : tableau des mesures

Tableau avec une ligne par point de mesure :

| Lettre | Nom | XS | S | M | L | XL | 2XL |
|---|---|---|---|---|---|---|---|
| A | SHOULDER | 17.5 | 18 | ... | | | |

- Les colonnes de tailles sont **générées dynamiquement depuis `products.size_range`**. Ne pas hardcoder XS→2XL.
- Saisie directe dans les cellules, auto-save (debounce 1s), écrit dans `measurement_values`
- Cliquer une ligne du tableau met en surbrillance le point correspondant sur le canvas, et inversement
- Suppression d'une ligne = suppression du point sur le canvas (avec confirmation)
- Réordonnancement possible (`sort_order`), car l'ordre détermine l'affichage page 3 du techpack

### 6. Export de l'overlay

Bouton "Exporter l'overlay" dans la toolbar :

1. `stage.toDataURL({ pixelRatio: 2 })` pour une résolution correcte en PDF
2. POST vers `/api/measurements/export-overlay` avec le dataURL et le `flat_id`
3. Stockage dans `products/{product_id}/overlays/{flat_id}.png`
4. Enregistrement du chemin (voir `03-database.md`, section overlay)

**Avant l'export :** masquer les éléments d'UI qui ne doivent pas apparaître dans le PDF (halos de sélection, poignées de drag, grille éventuelle). Sinon on retrouve la poignée bleue de sélection en plein milieu du techpack. Prévoir un état `isExporting` qui désactive ces décorations le temps du `toDataURL`.

**Piège CORS :** si l'image de fond vient d'un domaine sans en-tête CORS approprié, le canvas est "tainted" et `toDataURL` lève une `SecurityError`. Vérifier ce point **dès le premier jour de la Phase 2**, pas à la fin : ça imposerait de revoir la façon dont les flats sont servis.

### 7. Zoom et pan

- Molette = zoom centré sur le curseur
- Drag sur le fond (hors point) = pan
- Bouton "Réinitialiser la vue"
- **Le zoom/pan ne doit jamais modifier les coordonnées stockées.** On transforme le `Stage` (scale + position), pas les données.

### 8. Undo / Redo

- Pile d'actions en mémoire uniquement, pas de persistance
- Actions couvertes : création, suppression, déplacement d'un point
- Pas besoin de couvrir la saisie de valeurs dans le tableau (le navigateur gère le undo texte natif)
- Raccourcis clavier Cmd+Z / Cmd+Shift+Z

## Conversion des coordonnées

Le seul endroit du code qui fait la conversion px ↔ pourcentage. À factoriser dans un helper, testé unitairement :

```ts
// Conversion pourcentage → pixels dans l'espace de l'image (pas de l'écran)
const toPx = (percent: number, dimension: number) => (percent / 100) * dimension;
const toPercent = (px: number, dimension: number) => (px / dimension) * 100;
```

`dimension` = largeur/hauteur **naturelle de l'image**, pas la taille du canvas à l'écran, pas la taille après zoom. Se tromper ici est l'erreur la plus coûteuse du module : elle ne se voit qu'à l'export PDF.

## Génération automatique de la page 3 du techpack

Le tableau "Specifications" (page 3) se construit à partir **exactement** des mêmes `measurement_points` + `measurement_values`. Aucune ressaisie, aucune table intermédiaire, aucun champ dupliqué. Une ligne par point trié par `sort_order`.

Deux précisions issues du template :

- Le tableau a **10 colonnes de tailles fixes** (`XS` à `6XL`), toujours toutes affichées. `size_range` ne détermine pas les colonnes rendues, seulement lesquelles peuvent recevoir une valeur.
- Le tableau a **17 lignes**. Au-delà de 17 points de mesure, le techpack ne peut pas tout afficher : l'UI de l'éditeur doit le signaler à la saisie, pas laisser la génération tronquer silencieusement.

Si on se retrouve à écrire du code qui recopie des mesures dans une autre structure pour le PDF, c'est un signal d'erreur d'architecture.

## Contrainte de capacité à faire remonter dans l'UI

Le template a des emplacements en nombre fixe. L'éditeur doit avertir dès la saisie, jamais à la génération :

| Élément | Plafond |
|---|---|
| Points de mesure | 17 (lignes du tableau page 3) |
| Callouts | 12 (3 colonnes x 4 lignes, page 5) |
| Couleurs | 6 (légende page 6) |
| Cellules BOM | 12 (grille 4x3, page 4) |
| Pages d'artwork | 2 |
| Références extra | 3 |

## Decision différée : Zustand

Commencer en React state local (`useState` + `useReducer` pour l'undo/redo). Si `MeasurementEditor` dépasse ~400 lignes ou si le passage de props devient illisible, alors introduire Zustand. Pas avant.

## Definition of done Phase 2

- [ ] Je place un point sur le flat front, je le nomme, il persiste après refresh
- [ ] Je crée une ligne de cote avec flèches aux deux bouts, visuellement proche du template
- [ ] Je déplace un point existant par drag, la nouvelle position persiste
- [ ] Je saisis les valeurs XS→2XL dans le tableau, elles persistent
- [ ] Le tableau s'adapte si je change `size_range` du produit
- [ ] Undo/redo fonctionne sur création, suppression, déplacement
- [ ] Zoom/pan fonctionne et ne modifie pas les données stockées
- [ ] L'export overlay produit un PNG propre, **sans aucun élément d'UI parasite**
- [ ] Je change la résolution du flat source, je réuploade : les points sont toujours au bon endroit
- [ ] Les cotes rendues ont des **embouts perpendiculaires**, pas des flèches, y compris sur une cote oblique
- [ ] Le rouge est `#FF0000`, la lettre POI est nettement plus grande que la valeur
- [ ] Comparaison visuelle faite contre `template-reference/exemple-p-02.jpg`
- [ ] `AnnotatedCanvas` ne contient aucune référence à "mesure", "taille" ou "POI" (vérifié par recherche dans le fichier)
- [ ] L'UI avertit quand on dépasse 17 points de mesure

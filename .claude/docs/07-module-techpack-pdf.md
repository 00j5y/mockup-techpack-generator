# 07 - Module 4 : Génération du techpack PDF (Phase 4)

**Critère de succès : la fidélité visuelle au template Seaggs.** Un PDF qui contient les bonnes données mais dont la mise en page diverge du template = module non livré. Ce module se valide à l'œil, page par page, contre les images de `template-reference/`.

**Lire `15-template-seaggs.md` avant toute chose.** Il contient la géométrie mesurée de chaque page. Ce fichier-ci décrit le flux, pas les coordonnées.

## Rappel des trois faits qui structurent le module

1. **Format paysage custom `761.4 x 581.4 pt`.** Ni A4, ni Letter, ni portrait.
2. **Toujours 12 pages**, y compris vides. Pas de pagination dynamique.
3. **Tout ce que l'utilisateur renseigne s'affiche en rouge `#FF0000`**, la structure du template en noir `#231F20` et gris `#CCCCCC`.

## Flux

1. L'utilisateur clique "Générer le techpack" depuis `/products/[id]/techpack`
2. Le backend récupère **toutes** les données du produit en une passe, via `getFullProduct(productId)`
3. Chaque page est un composant React de `components/techpack/templates/` qui reçoit les données en props
4. Le HTML complet est rendu, puis transformé en PDF par Puppeteer
5. Le PDF est stocké sur le système de fichiers local, une ligne `techpack_revisions` est créée avec `version = max(version) + 1`
6. Téléchargement direct depuis l'interface

## Les 12 pages

| # | Titre de la barre | Composant | Source de données |
|---|---|---|---|
| 1 | `COVER` | `CoverPage` | `products` + visuel principal + `techpack_revisions` (4 dernières) |
| 2 | `MEASUREMENTS (MOCKUP)` | `MeasurementsMockupPage` | overlays front **et** back sur la même page + encarts de détail |
| 3 | `MEASUREMENTS (SPECIFICATIONS)` | `MeasurementsSpecPage` | `measurement_points` + `measurement_values` |
| 4 | `BILL OF MATERIALS, ADORNMENTS, AND EMBELLISHMENTS` | `BOMPage` | `bom_items` (grille 4x3, cellules A à L) |
| 5 | `CALLOUTS` | `CalloutsPage` | `callouts` (12 emplacements fixes) + flats |
| 6 | `COLORS` | `ColorsPage` | `color_specs` (6 emplacements fixes) + flat |
| 7 | `LABEL, TAGS, AND PACKAGING` | `PackagingPage` | `packaging_specs` |
| 8 | `ARTWORK` | `ArtworkPage` | `artwork_specs` (page 1) |
| 9 | `ARTWORK` | `ArtworkPage` | `artwork_specs` (page 2, souvent vide) |
| 10 | `EXTRA` | `ExtraPage` | `extra_references[0]` |
| 11 | `EXTRA` | `ExtraPage` | `extra_references[1]` |
| 12 | `EXTRA` | `ExtraPage` | `extra_references[2]` |

Une page sans données rend quand même sa barre de titre, son header et son cadre. C'est le comportement du template : dans l'exemple fourni, les pages 9, 11 et 12 sont vides.

Corollaire de capacité : **maximum 2 pages d'artwork et 3 références extra**. Si `artwork_specs` ou `extra_references` dépassent, l'UI doit le signaler à la saisie plutôt que de tronquer silencieusement à la génération.

## Le header

Le bloc header est identique sur les 12 pages : slot logo + 3 colonnes de libellés. Géométrie exacte dans `15-template-seaggs.md`.

Règle absolue : **un seul composant `TechpackHeader.tsx`**, alimenté par l'objet produit, importé par chaque page. Zéro duplication de markup, zéro duplication de données. Les seules props qui varient d'une page à l'autre sont le titre et le numéro de page, donc ils appartiennent au composant.

`SIZE RANGE:` affiche la liste statique des tailles avec **la taille de référence encadrée en rouge**, dérivée de `products.sample_size`.

## Mise en page pour Puppeteer

```css
@page { size: 761.4pt 581.4pt; margin: 0; }

.techpack-page {
  width: 761.4pt;
  height: 581.4pt;
  position: relative;
  overflow: hidden;          /* rien ne doit deborder sur la page suivante */
  page-break-after: always;
}

.techpack-page:last-child { page-break-after: auto; }  /* evite une page blanche finale */
```

```ts
// lib/pdf/renderTechpack.ts
await page.pdf({
  // `pt` est REJETE ici (seuls px, in, cm, mm). Le @page CSS fait foi.
  width: '10.575in',   // 761.4pt
  height: '8.075in',   // 581.4pt
  printBackground: true,
  preferCSSPageSize: true,
  margin: { top: 0, right: 0, bottom: 0, left: 0 },
});
```

Le PDF produit mesurera **761.04 x 581.04 pt**, pas 761.4 x 581.4 : Chromium tronque au centième de pouce. C'est attendu, l'écart de 0,36 pt tombe dans le cadre extérieur. Détail et mesures dans `15-template-seaggs.md`. Le test `bun run smoke:pdf` valide ce comportement.

### Positionnement

Le template est un document Illustrator : tout est en positions absolues. La mise en page doit suivre le même modèle, avec un conteneur `position: relative` par page et des enfants en `position: absolute` exprimés en `pt`.

**Ne pas essayer de reproduire ces pages en flexbox ou grid CSS fluide.** Les coordonnées sont connues au point près, les utiliser directement est plus court, plus lisible et plus fidèle. Les seules zones où un layout fluide a du sens sont l'intérieur d'une cellule BOM et les lignes de légende des pages 5 et 6.

### Pièges Puppeteer

- `printBackground: true` obligatoire, sinon les bandes grises `#CCCCCC` et le cadre disparaissent. Le PDF est alors "presque bon", ce qui est le pire cas de figure.
- Attendre `document.fonts.ready` **et** que chaque `<img>` ait `complete === true` et `naturalWidth > 0`. Un `networkidle0` ne suffit pas toujours et produit des cases vides intermittentes.
- Polices embarquées localement, jamais depuis une CDN. Voir la section typographie de `15-template-seaggs.md`.

## Preview navigateur

`/products/[id]/techpack` affiche les mêmes composants dans le navigateur, à l'échelle. C'est l'outil de travail principal : itérer sur la preview HTML est instantané, itérer sur le PDF prend une dizaine de secondes.

Pour l'affichage écran, appliquer un `transform: scale()` sur le conteneur de page plutôt que de changer les dimensions internes. Ainsi la géométrie en `pt` reste la seule vérité et la preview ne peut pas diverger du PDF.

## Récupération des données

Une seule fonction `getFullProduct(productId)` retournant un objet typé complet avec toutes les relations, utilisée par la preview **et** par la route de génération. Pas deux chemins de récupération différents : c'est la garantie que la preview et le PDF montrent la même chose.

## Versionnage

- `version` = `max(version) + 1` pour ce produit, calculé côté serveur
- `summary` : saisi par l'utilisateur avant génération ("Ajout du zip custom", "Correction mesure épaule")
- `pages_affected` : les pages concernées par la révision, pour la colonne `PAGES:` du tableau page 1
- Les anciennes versions restent téléchargeables depuis la page techpack
- Le tableau de la page 1 affiche les **4 dernières révisions** (4 lignes disponibles)

## Definition of done Phase 4

- [ ] Le PDF mesure exactement `761.4 x 581.4 pt` en paysage (vérifié avec `pdfinfo`)
- [ ] Le PDF fait exactement 12 pages, avec les bons titres de barre et les bons numéros
- [ ] **Chaque page a été comparée visuellement à `template-reference/exemple-p-NN.jpg`**
- [ ] Le header est identique sur les 12 pages et vient d'un seul composant
- [ ] Le slot logo du header est rempli
- [ ] La taille de référence est encadrée en rouge dans le header, et c'est la même que la colonne remplie page 3
- [ ] Les bandes grises et le cadre apparaissent (pas de `printBackground` oublié)
- [ ] Tout le contenu utilisateur est en rouge, toute la structure en noir ou gris
- [ ] Page 2 : front et back sur la même page, séparateur vertical au bon endroit
- [ ] Page 3 : les 10 colonnes de tailles sont présentes, 17 lignes, valeurs dans la colonne de la taille de référence
- [ ] Page 4 : grille 4x3, lettres rouges en haut à gauche, cellules vides propres
- [ ] Page 5 : 12 emplacements de légende, séparateurs en pointillés
- [ ] Page 6 : 6 emplacements de légende avec carré de couleur, paragraphe Pantone en bas
- [ ] Les pages sans données rendent leur header et leur cadre, sans contenu parasite
- [ ] Aucun débordement de contenu d'une page sur l'autre, aucune page blanche parasite
- [ ] Le filigrane SEAGGS n'est **pas** reproduit
- [ ] Toutes les images sont chargées, aucune case vide sur 3 générations consécutives
- [ ] Une entrée `techpack_revisions` est créée avec le bon numéro de version
- [ ] Le PDF se réouvre correctement dans Preview macOS et Acrobat
- [ ] Le rendu fonctionne **dans le conteneur Docker**, pas seulement en local

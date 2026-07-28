# 06 - Module 3 : BOM, Couleurs, Packaging, Artwork, Extra (Phase 3)

Lire `15-template-seaggs.md` (pages 4 à 12) avant de commencer : la mise en page cible détermine la structure de saisie.

Tous ces écrans utilisent le **même hook d'auto-save** que la Phase 1. Ne pas réimplémenter.

## Deux natures de page, un seul paradigme de saisie

Le template distingue deux natures de page :

| Nature | Pages | Saisie |
|---|---|---|
| **Structurée** (grille ou tableau fixe) | 3 specs, 4 BOM, 5 légende callouts, 6 légende colors | Formulaire CRUD classique, mise en page déterministe |
| **Libre** (canvas Illustrator, aucun repère) | 5 zone haute, 6 zone gauche, 7 packaging, 8-9 artwork, 10-12 extra | **Canvas libre** |

**Décision prise le 2026-07-27 : canvas libre** pour toutes les pages libres. On réutilise `AnnotatedCanvas` de la Phase 2 avec des annotations de type `ImageBlock` et `TextBlock`, et Jay place les éléments comme il le ferait dans Illustrator.

Raisons du choix contre un auto-layout : `AnnotatedCanvas` existe déjà après la Phase 2, donc le coût marginal est celui de nouveaux types d'annotation et non d'un nouvel éditeur. Et les pages 5 et 6 imposent de toute façon un canvas (pins sur flat) : un auto-layout sur 7, 8 et 10 aurait créé deux paradigmes de saisie dans la même application.

Conséquences :

- Les colonnes de position de `03-database.md` (corrections 5 et 6) ne sont **pas optionnelles**, elles sont requises.
- Les pages 7, 8-9 et 10-12 ont chacune un écran d'édition canvas, pas un formulaire.
- Chaque écran canvas a besoin d'un fond de repère aux **dimensions exactes de la zone de contenu** (750 x 470 pt), pour que le placement visible à l'écran soit celui du PDF. Sinon on place à l'aveugle.

---

## BOM : `/products/[id]/bom` (page 4, structurée)

Grille **4 colonnes x 3 lignes**, cellules `A` à `L`, ~187 x ~156 pt chacune.

Composition d'une cellule, telle que rendue dans le techpack :

- **Lettre en rouge**, bold, petit corps, en haut à gauche
- Image centrée dans la moitié haute
- Texte **en noir** (attention : c'est la seule zone où le contenu utilisateur n'est pas rouge), centré, petit corps, sous l'image
  - cas swatch de tissu : titre puis Pantone sur deux lignes centrées
  - cas description : texte sur plusieurs lignes
- `measurement_note` rendu comme une **cote rouge** (crochet + libellé, ex `1 inch`) à côté de l'image
- Une cellule vide n'affiche que sa lettre rouge

L'UI de saisie reproduit la grille 4x3 pour que Jay voie directement ce qu'il obtiendra. `cell_label` est la position, il ne se réordonne pas : `A` est en haut à gauche.

## Couleurs : `/products/[id]/colors` (page 6, mixte)

Deux parties sur la même page :

- **Zone gauche, canvas** : pins numérotés posés sur un flat. Même primitive et même style de pin que les callouts.
- **Zone droite, légende structurée** : **6 emplacements fixes**. Chaque ligne = pin numéroté + **carré de couleur** (aplat du `hex`, contour noir) + texte.

Le texte de la ligne est le `pantone_id` s'il existe, sinon le `name`. Dans l'exemple : `1 Pantone 7545 C`, `2 White`, `3 Pantone 7527 C`, `4 Black`, puis 5 et 6 vides.

**Plafond : 6 couleurs.** Avertir à la saisie au-delà.

**Bonus V1, si le temps le permet uniquement :** bouton "hex → Pantone approché". Le template lui-même recommande `codebeautify.org/hex-to-pantone-converter`, donc le besoin est réel.

Approche recommandée : table de correspondance **statique embarquée** (JSON des Pantone Solid Coated courants avec leur hex) + distance de couleur la plus proche en espace **Lab, pas RGB** (la distance RGB est perceptuellement fausse). Pas d'appel à une API tierce. Toujours présenter le résultat comme une **approximation à valider** : un mauvais Pantone envoyé au fournisseur coûte cher.

## Callouts (page 5, mixte)

Deux parties :

- **Zone haute, canvas** : pins numérotés posés sur les flats
- **Bande basse, structurée** : 3 colonnes x 4 lignes, séparées par des **traits pointillés**, soit **12 emplacements fixes**

Style du pin : goutte rouge à contour noir, numéro en blanc, pointe dirigée vers l'élément. L'orientation (`pin_direction`) varie selon le placement sur le flat ; dans la légende tous les pins pointent à gauche.

Un emplacement non utilisé affiche son pin sans texte. **Plafond : 12 callouts.**

Décision confirmée : **réutiliser `AnnotatedCanvas` de la Phase 2** avec un type d'annotation `Pin`. Si cette réutilisation s'avère impossible, c'est que la Phase 2 a été mal découpée : corriger la Phase 2 plutôt que dupliquer.

## Packaging : `/products/[id]/packaging` (page 7, libre)

Trois blocs typiques (`neck_tag`, `hang_tag`, `packaging_bag`), mais **aucune grille dans le template** : dans l'exemple ils ne sont ni alignés ni de même taille.

Composition d'un bloc :

- Titre en **noir, grand corps** (~20 pt) au-dessus
- Image
- **Cote rouge** avec libellé, horizontale ou verticale selon le bloc (`dimension_orientation`)
- Optionnel : carré de couleur + texte `Pantone: 394 C`

Le type `other` existe en base pour les cas non prévus. L'UI V1 expose les trois blocs typiques plus un bouton "Ajouter un élément".

## Artwork : `/products/[id]/artwork` (pages 8-9, libres)

Éléments graphiques placés librement, rattachés à un flat. **Maximum 2 pages**, donc avertir à la saisie si le nombre d'éléments ne tient plus.

Composition d'un élément :

- Image de l'artwork, éventuellement sur un **fond de couleur** (`background_hex`). Indispensable : une impression blanche est invisible sur le fond blanc de la page, l'exemple place systématiquement les impressions blanches sur un rectangle noir.
- Libellé de technique en **noir bold, petit corps** : `White print`, `Black print`, `Screenprinted`, `Applique. Made of same material has main fabric.`
- **Cote rouge** avec la dimension en inches
- Optionnel : **liste de plusieurs Pantone**, chacun précédé d'un petit carré de couleur. L'exemple en montre 3 sur un seul élément, d'où la table `artwork_pantones`.

## Extra : `/products/[id]/extra` (pages 10-12, libres)

Références libres, **maximum 3** (une par page).

Composition : texte d'instruction en **noir, grand corps** (~28 pt) en haut à gauche, plus une image de référence placée librement.

Cas d'usage typique de l'exemple : `Acid wash garment fabric. Make it look like this:` + une photo de référence.

## Definition of done Phase 3

- [ ] Les 12 cellules du BOM sont éditables avec image, et persistent
- [ ] Une cellule BOM vide ne rend que sa lettre rouge dans la preview techpack
- [ ] Le texte des cellules BOM est en noir, la lettre en rouge, la `measurement_note` en cote rouge
- [ ] Je peux ajouter, éditer, réordonner et supprimer des couleurs, plafonnées à 6
- [ ] Les pins de couleur se posent sur un flat et apparaissent au bon endroit dans la preview
- [ ] La légende couleurs affiche le carré de couleur du `hex` et le bon texte
- [ ] Les callouts sont posés via `AnnotatedCanvas` réutilisé, pas un doublon de code
- [ ] La bande de légende callouts affiche 12 emplacements, séparateurs en pointillés
- [ ] Les trois blocs packaging acceptent image, cote orientable et Pantone
- [ ] Un artwork avec impression blanche est visible grâce à `background_hex`
- [ ] Un artwork peut porter 3 Pantone, chacun avec son carré de couleur
- [ ] Je peux créer 3 références extra et elles apparaissent sur les pages 10, 11 et 12
- [ ] Chaque plafond (17 mesures, 12 callouts, 6 couleurs, 12 BOM, 2 pages artwork, 3 extra) est signalé **à la saisie**
- [ ] Comparaison visuelle faite contre `exemple-p-04.jpg` à `exemple-p-10.jpg`

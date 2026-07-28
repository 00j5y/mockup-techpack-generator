# 04 - Module 1 : CRUD Produit (Phase 1)

## Écrans

### `/products` : liste

- Tableau ou grille des produits avec `drop_number`, `style_name`, `style_number`, catégorie, statut
- Badge de statut visuellement distinct : `draft` / `sample` / `production` / `archived`
- Filtre par catégorie et par statut
- Bouton "Nouveau produit"

### `/products/new` : création

Formulaire limité aux champs de la table `products`. Rien d'autre : les flats, mesures et BOM se remplissent après création, depuis la vue produit.

Champs :

| Champ | Type UI | Obligatoire |
|---|---|---|
| `drop_number` | number | oui |
| `style_name` | text | oui |
| `style_number` | text | oui |
| `category` | select (shirt/pants/jacket/other) | oui |
| `main_fabric` | text | oui |
| `description` | textarea | non |
| `fabric_pantone_id` | sélecteur dans la bibliothèque Pantone maison, avec création à la volée | non |
| `fabric_gradient_enabled` | toggle | non |
| `fabric_gradient_intensity` | select (subtle/medium/strong), visible seulement si toggle actif | non |
| `size_range` | multi-select, préremplí XS→2XL | non |
| `sample_sizes` | multi-select parmi `size_range` | non (mais **requis pour générer le techpack**) |
| `designer` | text, préremplí "Constitue" | non |
| `company` | text, préremplí "Constitue" | non |
| `logo_storage_path` | upload image | non (mais nécessaire au techpack) |
| `status` | select, préremplí "draft" | non |

`sample_sizes` accepte plusieurs valeurs : on peut vouloir produire un sample en M et un en L. Trié dans l'ordre canonique de `TECHPACK_SIZE_COLUMNS` et dédoublonné **à l'écriture**, jamais à l'affichage, pour que deux produits portant les mêmes tailles produisent le même techpack. Tableau vide autorisé à l'état brouillon : c'est la génération du techpack qui exige au moins une taille, pas la fiche produit. Il pilote trois rendus : les encadrés rouges du header (un par taille), les colonnes remplies de la page 3 (une par taille), et les valeurs affichées sur les cotes de la page 2, portées uniquement par la première taille dans l'ordre canonique (`primarySampleSize()`). Voir `15-template-seaggs.md`.

`logo_storage_path` alimente le slot logo présent dans le header des 12 pages. **Tranché : champ par produit**, avec une zone de drag-and-drop. Pour éviter de le réuploader à chaque pièce, la création d'un produit **préremplit le logo du produit le plus récent**. Pas de table de réglages globaux, pas de page de settings : une requête sur le dernier produit suffit et le champ reste modifiable pièce par pièce (utile pour une collab ou une sous-marque).

## Le header se saisit directement, en place

Le bloc header du techpack (company, designer, date, main fabric, style number, size range, description, style name, logo) n'est pas saisi dans un formulaire séparé : **il est éditable directement, à sa géométrie réelle**, sur `/products/[id]`.

Concrètement, Jay voit le bloc gris tel qu'il sortira sur les 12 pages, et chaque valeur est une zone de saisie à sa place. Le libellé (`COMPANY:`) reste du texte statique, la valeur est un champ. Le slot logo est une **zone de drag-and-drop**.

Intérêt : ce bloc apparaît sur les 12 pages du techpack. Le voir juste, tout de suite, à la bonne taille, évite de découvrir un débordement de texte au moment de la génération du PDF.

### Zone de drop du logo

- Cible de drop **aux dimensions exactes du slot** : 72 x 70 pt
- Formats acceptés : **PNG avec transparence ou SVG de préférence**, JPG accepté
- Chemin : `products/{product_id}/logo/{uuid}.{ext}`
- Rendu : `object-fit: contain`, centré. Le logo n'aura jamais exactement le ratio 72x70, il ne doit pas être déformé.
- Actions : remplacer, supprimer
- **Avertir si l'image n'a pas de canal alpha** : le fond du slot est le gris `#CCCCCC` du header, donc un JPG sur fond blanc produira un rectangle blanc visible sur les 12 pages. C'est le genre de détail qu'on ne voit qu'une fois le PDF envoyé au fournisseur.

### Contrainte de largeur des champs

Les colonnes du header ont des largeurs fixes (colonne 1 de x=86 à 290, colonne 2 de 290 à 528, colonne 3 de 528 à 755). Une valeur trop longue déborde sur la colonne suivante dans le PDF.

Le champ de saisie doit donc être **à la largeur réelle disponible**, et signaler le débordement au moment de la frappe plutôt qu'à la génération. `MAIN FABRIC: 270 GSM yarn-dyed cotton interlock` est déjà proche de la limite de la colonne 2.

À la création : redirection vers `/products/[id]`.

### `/products/[id]` : vue d'ensemble

Le hub du produit. Contient :

- Les infos générales (éditables inline, auto-save)
- Une carte par sous-module avec **indicateur de complétion**, par exemple :
  - `Flats : 2 uploadés (front, back)`
  - `Mesures : 8 points, 6/8 avec valeurs complètes`
  - `BOM : 3/12 cellules remplies`
  - `Couleurs : 2 définies`
  - `Packaging : 1/3 blocs remplis`
  - `Artwork : 0 élément`
- Un bouton "Générer le techpack" désactivé (avec explication) tant que les sections minimales ne sont pas remplies

L'indicateur de complétion est une **vraie feature de confort**, pas du décoratif : c'est ce qui évite d'envoyer un techpack incomplet au fournisseur.

## Auto-save

- Debounce de **1 seconde** après la dernière frappe
- Pas de bouton "Enregistrer"
- Indicateur d'état visible : `Enregistrement...` → `Enregistré` (ou l'erreur)
- En cas d'échec réseau : garder la valeur locale, réafficher l'erreur, permettre un retry. **Ne jamais faire perdre la saisie.**

Implémentation : un hook `useAutoSave(productId, field, value)` ou un `useDebouncedPatch`, factorisé dans `components/forms/`. Ne pas réécrire la logique de debounce dans chaque page.

## Upload des flats

- Drag-and-drop, plus fallback sur input file classique
- Formats acceptés : PNG, JPG, SVG (les flats Illustrator sont généralement exportés en PNG transparent)
- Chemin de stockage : `products/{product_id}/flats/{uuid}.{ext}`
- Le `type` (`flat_front`, `flat_back`, `flat_detail`, `inspo_reference`) est choisi par l'utilisateur à l'upload
- `label` obligatoire seulement pour les `flat_detail`
- Preview immédiate après upload
- Suppression possible, avec confirmation (elle cascade sur les `measurement_points` et `callouts` liés : **prévenir explicitement l'utilisateur** dans la confirmation si des points existent sur ce flat)

## Definition of done Phase 1

- [ ] Je peux créer un produit et le retrouver dans la liste
- [ ] Je peux éditer chaque champ, quitter la page, revenir : la valeur est là
- [ ] Je peux uploader un flat front et un flat back, les voir en preview
- [ ] Je peux supprimer un flat, avec avertissement s'il porte des points
- [ ] Les indicateurs de complétion affichent des chiffres corrects
- [ ] L'auto-save affiche son état et ne perd rien en cas de coupure réseau
- [ ] Le bloc header est éditable en place, à sa géométrie réelle (72x70 pour le logo, 3 colonnes aux bonnes largeurs)
- [ ] Je dépose un PNG transparent par drag-and-drop dans le slot logo, il s'affiche en `contain` sans déformation
- [ ] Un JPG sur fond blanc déclenche un avertissement sur l'absence de transparence
- [ ] La création d'un nouveau produit préremplit le logo du produit le plus récent
- [ ] Une valeur trop longue dans un champ du header est signalée à la frappe, pas à la génération
- [ ] Changer une largeur de colonne dans `headerLayout.ts` déplace le texte print **et** redimensionne le champ de saisie

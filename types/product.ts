/**
 * Types du domaine produit.
 *
 * Les types d'entites sont DERIVES du schema Drizzle (`lib/db/schema.ts`),
 * jamais ecrits a la main : c'est ce qui garantit qu'ils ne peuvent pas
 * diverger de la base. Ce fichier n'ajoute que ce que le schema ne peut pas
 * exprimer : les unions litterales, les plafonds du template et les helpers.
 */

import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import type {
  artworkPantones,
  artworkSpecs,
  bomItems,
  callouts,
  colorSpecs,
  extraReferences,
  generatedVisuals,
  measurementPoints,
  measurementValues,
  packagingSpecs,
  pantoneColors,
  productFlats,
  products,
  techpackRevisions,
} from '@/lib/db/schema';

// ---------------------------------------------------------------------------
// Entites : lecture et insertion
// ---------------------------------------------------------------------------

export type Product = InferSelectModel<typeof products>;
export type NewProduct = InferInsertModel<typeof products>;

export type PantoneColor = InferSelectModel<typeof pantoneColors>;
export type NewPantoneColor = InferInsertModel<typeof pantoneColors>;

export type ProductFlat = InferSelectModel<typeof productFlats>;
export type NewProductFlat = InferInsertModel<typeof productFlats>;

export type MeasurementPoint = InferSelectModel<typeof measurementPoints>;
export type NewMeasurementPoint = InferInsertModel<typeof measurementPoints>;

export type MeasurementValue = InferSelectModel<typeof measurementValues>;
export type NewMeasurementValue = InferInsertModel<typeof measurementValues>;

export type BomItem = InferSelectModel<typeof bomItems>;
export type NewBomItem = InferInsertModel<typeof bomItems>;

export type Callout = InferSelectModel<typeof callouts>;
export type NewCallout = InferInsertModel<typeof callouts>;

export type ColorSpec = InferSelectModel<typeof colorSpecs>;
export type NewColorSpec = InferInsertModel<typeof colorSpecs>;

export type PackagingSpec = InferSelectModel<typeof packagingSpecs>;
export type NewPackagingSpec = InferInsertModel<typeof packagingSpecs>;

export type ArtworkSpec = InferSelectModel<typeof artworkSpecs>;
export type NewArtworkSpec = InferInsertModel<typeof artworkSpecs>;

export type ArtworkPantone = InferSelectModel<typeof artworkPantones>;
export type NewArtworkPantone = InferInsertModel<typeof artworkPantones>;

export type ExtraReference = InferSelectModel<typeof extraReferences>;
export type NewExtraReference = InferInsertModel<typeof extraReferences>;

export type GeneratedVisual = InferSelectModel<typeof generatedVisuals>;
export type NewGeneratedVisual = InferInsertModel<typeof generatedVisuals>;

export type TechpackRevision = InferSelectModel<typeof techpackRevisions>;
export type NewTechpackRevision = InferInsertModel<typeof techpackRevisions>;

// ---------------------------------------------------------------------------
// Unions litterales
// ---------------------------------------------------------------------------

// Postgres ne stocke que du `text` avec une contrainte CHECK : ces listes sont
// la contrepartie TypeScript, et doivent rester alignees sur les CHECK du schema.

export const PRODUCT_CATEGORIES = ['shirt', 'pants', 'jacket', 'other'] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const PRODUCT_STATUSES = ['draft', 'sample', 'production', 'archived'] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const GRADIENT_INTENSITIES = ['subtle', 'medium', 'strong'] as const;
export type GradientIntensity = (typeof GRADIENT_INTENSITIES)[number];

export const FLAT_TYPES = ['flat_front', 'flat_back', 'flat_detail', 'inspo_reference'] as const;
export type FlatType = (typeof FLAT_TYPES)[number];

export const BOM_ITEM_TYPES = ['fabric_swatch', 'hardware', 'trim', 'other'] as const;
export type BomItemType = (typeof BOM_ITEM_TYPES)[number];

export const PACKAGING_TYPES = ['neck_tag', 'hang_tag', 'packaging_bag', 'other'] as const;
export type PackagingType = (typeof PACKAGING_TYPES)[number];

export const VISUAL_QUALITIES = ['low', 'medium', 'high'] as const;
export type VisualQuality = (typeof VISUAL_QUALITIES)[number];

/**
 * Bibliotheques Pantone retenues, alignees sur le CHECK `pantone_colors_library`.
 *
 * `TCX` : FHI coton, LA bibliotheque du vetement (ex `19-4052 TCX`).
 * `TPG` : le meme nuancier sur papier, pour les maquettes.
 * `C` / `U` : PMS graphique, encre sur papier couche ou non couche. Utile pour un
 * hangtag imprime, jamais pour teindre un tissu.
 */
export const PANTONE_LIBRARIES = ['TCX', 'TPG', 'C', 'U'] as const;
export type PantoneLibrary = (typeof PANTONE_LIBRARIES)[number];

export const BOM_CELL_LABELS = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L',
] as const;
export type BomCellLabel = (typeof BOM_CELL_LABELS)[number];

/** Orientation de la pointe du pin rouge (pages 5 et 6). */
export type PinDirection = 'left' | 'right';

/** Orientation de la cote rouge a cote d'un bloc packaging (page 7). */
export type DimensionOrientation = 'horizontal' | 'vertical';

// ---------------------------------------------------------------------------
// Plafonds imposes par le template
// ---------------------------------------------------------------------------

/**
 * Le template a des emplacements en nombre fixe. Ces plafonds doivent etre
 * signales A LA SAISIE, jamais appliques silencieusement a la generation :
 * tronquer sans le dire fait disparaitre de l'information sans que personne
 * le voie. Voir .claude/docs/15-template-seaggs.md.
 */
export const TEMPLATE_LIMITS = {
  /** Lignes du tableau de specifications, page 3. */
  measurementPoints: 17,
  /** 3 colonnes x 4 lignes dans la bande de legende, page 5. */
  callouts: 12,
  /** Emplacements de la legende couleurs, page 6. */
  colors: 6,
  /** Grille 4x3, page 4. */
  bomCells: 12,
  /** Pages 8 et 9. */
  artworkPages: 2,
  /** Pages 10, 11 et 12, une reference par page. */
  extraReferences: 3,
} as const;

/**
 * Les 10 colonnes de tailles de la page 3 sont FIXES et toujours toutes
 * affichees. `sizeRange` ne determine pas les colonnes rendues, seulement
 * lesquelles peuvent recevoir une valeur.
 */
export const TECHPACK_SIZE_COLUMNS = [
  'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL',
] as const;
export type TechpackSizeColumn = (typeof TECHPACK_SIZE_COLUMNS)[number];

/**
 * Gamme de tailles d'un produit qui n'en precise pas.
 *
 * Doit rester alignee sur le `default` SQL de `products.size_range`
 * (`lib/db/schema.ts`). Sa raison d'etre est d'etre le SEUL endroit ou le
 * formulaire de creation lit cette liste : `12-pieges.md` met explicitement en
 * garde contre son hardcodage dans un composant, un produit dont la gamme
 * differe casserait alors silencieusement.
 */
export const DEFAULT_SIZE_RANGE = ['XS', 'S', 'M', 'L', 'XL', '2XL'] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Trie des tailles dans l'ordre canonique du template et retire les doublons.
 *
 * L'ordre de reference est celui de `TECHPACK_SIZE_COLUMNS` (XS -> 6XL), pas
 * l'ordre de saisie : deux produits portant les memes tailles doivent produire
 * exactement le meme techpack. Une taille inconnue des 10 colonnes est repoussee
 * en fin de liste plutot que supprimee, pour qu'une donnee anormale reste
 * visible au lieu de disparaitre en silence.
 */
export function sortSizes<T extends string>(sizes: readonly T[]): T[] {
  const rank = (size: string) => {
    const index = (TECHPACK_SIZE_COLUMNS as readonly string[]).indexOf(size);
    return index === -1 ? TECHPACK_SIZE_COLUMNS.length : index;
  };
  return [...new Set(sizes)].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

/**
 * LA TAILLE DONT LES COTES DE LA PAGE 2 PORTENT LES VALEURS.
 *
 * Les encadres rouges du header et les colonnes remplies de la page 3 acceptent
 * plusieurs tailles d'echantillon sans difficulte. La page 2, elle, n'affiche
 * qu'une valeur de cote par mesure (`"26 inches"`) : elle ne peut pas en montrer
 * trois sans devenir illisible. La convention retenue est donc que la PREMIERE
 * taille du tableau, dans l'ordre canonique, est celle qui s'y affiche.
 *
 * Passer par ce helper plutot que par `sampleSizes[0]` en dur : la Phase 2 et la
 * Phase 4 n'ont ainsi pas a redecouvrir la convention, et le tri defensif
 * ci-dessous tient meme si une ligne a ete ecrite hors des routes API.
 *
 * Rend `null` sur un brouillon sans taille d'echantillon.
 */
export function primarySampleSize(product: Pick<Product, 'sampleSizes'>): string | null {
  return sortSizes(product.sampleSizes)[0] ?? null;
}

/**
 * Libelle complet d'une couleur, tel qu'il doit apparaitre dans le techpack et
 * partir chez le fournisseur.
 *
 * Exemples : `Pantone 19-4052 TCX Classic Blue`, `Pantone 7545 C`.
 *
 * L'ordre reference puis bibliotheque n'est pas negociable : c'est la forme sous
 * laquelle un teinturier lit une reference, et la bibliotheque en fait partie
 * integrante (`7545 C` et `7545 U` ne donnent pas la meme couleur). Le nom
 * commercial vient en dernier, et disparait quand il n'y en a pas : c'est un
 * confort de lecture, jamais la specification. Le hex n'apparait volontairement
 * PAS ici : il est indicatif et n'a rien a faire dans une commande fournisseur.
 *
 * Un seul endroit ou ce libelle se construit : l'ecran d'edition, le techpack
 * PDF et le prompt de la Phase 5 doivent nommer une couleur a l'identique.
 */
export function pantoneLabel(
  color: Pick<PantoneColor, 'reference' | 'library' | 'name'>,
): string {
  const parts = ['Pantone', color.reference, color.library];
  // `name` est nullable en base, et une chaine d'espaces pourrait subsister sur
  // une ligne ecrite hors des routes API : ne rien ajouter dans les deux cas
  // plutot que de laisser une espace en fin de libelle.
  const name = color.name?.trim();
  if (name) parts.push(name);
  return parts.join(' ');
}

/** Un point est une ligne de cote si et seulement si ses deux extremites sont definies. */
export function isDimensionLine(
  point: MeasurementPoint,
): point is MeasurementPoint & { endXPercent: number; endYPercent: number } {
  return point.endXPercent !== null && point.endYPercent !== null;
}

/**
 * Ramene une colonne `text` dans son union litterale, avec valeur de repli.
 *
 * Les CHECK Postgres rendent ces valeurs sures en pratique, mais un
 * `flat.type as FlatType` masque le cas ou la valeur sort de l'union : la
 * recherche dans un objet de libelles rendrait alors `undefined`, et l'ecran
 * afficherait un blanc sans que rien ne signale l'anomalie. Le repli rend
 * l'affichage toujours defini, et le cast ci-dessous est justifie par le test
 * d'appartenance qui le precede.
 */
export function oneOf<T extends string>(allowed: readonly T[], value: string, fallback: T): T {
  return (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/** URL publique d'un fichier du stockage local, servie a la meme origine que l'app. */
export function fileUrl(storagePath: string): string {
  // Chaque segment est encode separement : encoder le chemin entier
  // transformerait les `/` en `%2F` et la route catch-all ne retrouverait plus
  // le fichier. Sans encodage, un espace ou un `#` dans un chemin casserait
  // l'URL en silence.
  const encoded = storagePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `/api/files/${encoded}`;
}

// ---------------------------------------------------------------------------
// Agregat
// ---------------------------------------------------------------------------

/**
 * Objet complet retourne par `getFullProduct()`, consomme a l'identique par la
 * preview navigateur et par la route de generation PDF. Un seul chemin de
 * recuperation : c'est la garantie que la preview et le PDF montrent la meme chose.
 */
export interface FullProduct extends Product {
  flats: ProductFlat[];
  measurementPoints: (MeasurementPoint & { values: MeasurementValue[] })[];
  bomItems: BomItem[];
  callouts: Callout[];
  colorSpecs: ColorSpec[];
  packagingSpecs: PackagingSpec[];
  artworkSpecs: (ArtworkSpec & { pantones: ArtworkPantone[] })[];
  extraReferences: ExtraReference[];
  techpackRevisions: TechpackRevision[];
}

/**
 * Types partages du domaine produit.
 * Aligne sur supabase/migrations/20260727120000_initial_schema.sql.
 * Toute evolution du schema doit etre repercutee ici dans la meme PR.
 */

// ---------------------------------------------------------------------------
// Enumerations
// ---------------------------------------------------------------------------

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

/** Orientation de la pointe du pin rouge (pages 5 et 6). */
export type PinDirection = 'left' | 'right';

/** Orientation de la cote rouge a cote d'un bloc packaging (page 7). */
export type DimensionOrientation = 'horizontal' | 'vertical';

// ---------------------------------------------------------------------------
// Plafonds imposes par le template
// ---------------------------------------------------------------------------

/**
 * Le template a des emplacements en nombre fixe. Ces plafonds doivent etre
 * signales A LA SAISIE, jamais appliques silencieusement a la generation.
 * Voir .claude/docs/15-template-seaggs.md.
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
 * affichees. `size_range` ne determine pas les colonnes rendues, seulement
 * lesquelles peuvent recevoir une valeur.
 */
export const TECHPACK_SIZE_COLUMNS = [
  'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL',
] as const;
export type TechpackSizeColumn = (typeof TECHPACK_SIZE_COLUMNS)[number];

// ---------------------------------------------------------------------------
// Positionnement
// ---------------------------------------------------------------------------

/**
 * Toute position est stockee en pourcentage de la dimension NATURELLE de
 * l'image de fond (0-100), jamais en pixels. Un flat reexporte a une autre
 * resolution ne doit rien casser.
 */
export interface PercentPoint {
  x_percent: number;
  y_percent: number;
}

/** Bloc place librement sur un canvas (pages 7, 8-9, 10-12). */
export interface PercentPlacement extends Partial<PercentPoint> {
  width_percent: number | null;
}

// ---------------------------------------------------------------------------
// Entites
// ---------------------------------------------------------------------------

export interface Product {
  id: string;
  drop_number: number;
  style_name: string;
  style_number: string;
  category: ProductCategory;
  description: string | null;
  main_fabric: string;
  fabric_color_hex: string | null;
  fabric_gradient_enabled: boolean;
  fabric_gradient_intensity: GradientIntensity | null;
  size_range: string[];
  /**
   * Taille de reference. Pilote trois rendus a la fois : l'encadre rouge du
   * `SIZE RANGE:` dans le header, la colonne remplie page 3, et les valeurs
   * affichees sur les cotes page 2. Nullable en base pour les brouillons,
   * obligatoire dans le formulaire, bloquant pour la generation du techpack.
   */
  sample_size: string | null;
  designer: string;
  company: string;
  /** Slot logo du header, present sur les 12 pages. PNG transparent ou SVG. */
  logo_storage_path: string | null;
  status: ProductStatus;
  created_at: string;
  updated_at: string;
}

export interface ProductFlat {
  id: string;
  product_id: string;
  type: FlatType;
  storage_path: string;
  /** Export du canvas (flat + annotations), ecrase a chaque export. */
  overlay_storage_path: string | null;
  label: string | null;
  /** Placement de l'encart flottant sur la page 2. Uniquement pour `flat_detail`. */
  x_percent: number | null;
  y_percent: number | null;
  width_percent: number | null;
  created_at: string;
}

export interface MeasurementPoint {
  id: string;
  product_id: string;
  flat_id: string;
  /** "A", "B", "C"... auto-incremente a la creation, editable. */
  point_label: string;
  measurement_name: string;
  x_percent: number;
  y_percent: number;
  /** Null sur un point simple, renseigne sur une ligne de cote. */
  end_x_percent: number | null;
  end_y_percent: number | null;
  sort_order: number;
  created_at: string;
}

/** Un point est une ligne de cote si et seulement si ses deux extremites sont definies. */
export function isDimensionLine(
  point: MeasurementPoint,
): point is MeasurementPoint & { end_x_percent: number; end_y_percent: number } {
  return point.end_x_percent !== null && point.end_y_percent !== null;
}

export interface MeasurementValue {
  id: string;
  measurement_point_id: string;
  size: string;
  /** Toujours en pouces. Aucune conversion implicite vers le systeme metrique. */
  value_inches: number;
}

export interface BomItem {
  id: string;
  product_id: string;
  /** Position dans la grille 4x3 : "A" en haut a gauche, "L" en bas a droite. */
  cell_label: string;
  item_type: BomItemType | null;
  title: string;
  description: string | null;
  pantone_id: string | null;
  image_storage_path: string | null;
  /** Rendu en cote rouge a cote de l'image, ex "1 inch". */
  measurement_note: string | null;
  created_at: string;
}

export interface Callout {
  id: string;
  product_id: string;
  flat_id: string | null;
  /** 1 a 12. */
  number: number;
  x_percent: number;
  y_percent: number;
  pin_direction: PinDirection;
  description: string;
  created_at: string;
}

export interface ColorSpec {
  id: string;
  product_id: string;
  flat_id: string | null;
  /** 1 a 6. */
  number: number;
  name: string;
  /** Alimente le carre de couleur de la legende. */
  hex: string | null;
  /** Affiche en priorite sur `name` s'il existe. */
  pantone_id: string | null;
  x_percent: number | null;
  y_percent: number | null;
  pin_direction: PinDirection;
  created_at: string;
}

export interface PackagingSpec {
  id: string;
  product_id: string;
  type: PackagingType | null;
  title: string;
  image_storage_path: string | null;
  width_inches: number | null;
  height_inches: number | null;
  pantone_id: string | null;
  pantone_hex: string | null;
  notes: string | null;
  x_percent: number | null;
  y_percent: number | null;
  width_percent: number | null;
  dimension_orientation: DimensionOrientation;
  created_at: string;
}

export interface ArtworkPantone {
  id: string;
  artwork_spec_id: string;
  pantone_id: string;
  hex: string | null;
  sort_order: number;
}

export interface ArtworkSpec {
  id: string;
  product_id: string;
  flat_id: string | null;
  /** 8 ou 9. */
  page: number;
  title: string;
  technique: string | null;
  width_inches: number | null;
  height_inches: number | null;
  position_note: string | null;
  /**
   * Fond de la vignette. Indispensable pour une impression blanche, invisible
   * sinon sur le fond blanc de la page.
   */
  background_hex: string | null;
  x_percent: number | null;
  y_percent: number | null;
  width_percent: number | null;
  created_at: string;
}

export interface ExtraReference {
  id: string;
  product_id: string;
  /** 10, 11 ou 12. */
  page: number;
  title: string | null;
  instruction_text: string | null;
  image_storage_path: string | null;
  x_percent: number | null;
  y_percent: number | null;
  width_percent: number | null;
  created_at: string;
}

export interface GeneratedVisual {
  id: string;
  product_id: string;
  prompt_used: string;
  quality: VisualQuality | null;
  storage_path: string;
  /** Sans contrainte de cle etrangere : l'historique survit a la suppression d'un flat. */
  input_flat_ids: string[] | null;
  cost_usd: number | null;
  created_at: string;
}

export interface TechpackRevision {
  id: string;
  product_id: string;
  version: number;
  /** Colonne HISTORY: du tableau page 1, ex "REV 2". */
  history_label: string | null;
  /** Colonne PAGES:, ex "2, 3, 6". */
  pages_affected: string | null;
  summary: string | null;
  pdf_storage_path: string | null;
  created_at: string;
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
  measurement_points: (MeasurementPoint & { values: MeasurementValue[] })[];
  bom_items: BomItem[];
  callouts: Callout[];
  color_specs: ColorSpec[];
  packaging_specs: PackagingSpec[];
  artwork_specs: (ArtworkSpec & { pantones: ArtworkPantone[] })[];
  extra_references: ExtraReference[];
  techpack_revisions: TechpackRevision[];
}

/**
 * Schema de la base, source unique de verite.
 *
 * Ce fichier genere a la fois la migration SQL (drizzle-kit generate) et les
 * types TypeScript (types/product.ts les re-exporte). Ne jamais ecrire un type
 * d'entite a la main a cote : c'est ce couplage qui evite la derive.
 *
 * Reference metier : .claude/docs/03-database.md
 */

import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

// ---------------------------------------------------------------------------
// Colonnes communes
// ---------------------------------------------------------------------------

const id = () => uuid('id').primaryKey().defaultRandom();
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

/** Position relative 0-100 sur l'image de fond. JAMAIS de pixels. */
const percent = (name: string) => numeric(name, { mode: 'number' });

// ---------------------------------------------------------------------------
// products
// ---------------------------------------------------------------------------

export const products = pgTable(
  'products',
  {
    id: id(),
    dropNumber: integer('drop_number').notNull(),
    styleName: text('style_name').notNull(),
    styleNumber: text('style_number').notNull(),
    category: text('category').notNull(),
    description: text('description'),
    /** ex: "270 GSM yarn-dyed cotton interlock" */
    mainFabric: text('main_fabric').notNull(),
    fabricColorHex: text('fabric_color_hex'),
    fabricGradientEnabled: boolean('fabric_gradient_enabled').notNull().default(false),
    fabricGradientIntensity: text('fabric_gradient_intensity'),
    /**
     * Le defaut SQL ci-dessous doit rester aligne sur `DEFAULT_SIZE_RANGE`
     * (`types/product.ts`), que le formulaire de creation utilise pour
     * pre-remplir la gamme. Ne pas editer ce SQL a la main : la migration est
     * generee et committee, toute evolution passe par `db:generate`.
     */
    sizeRange: text('size_range')
      .array()
      .notNull()
      .default(sql`ARRAY['XS','S','M','L','XL','2XL']::text[]`),
    /**
     * Taille de reference. Pilote trois rendus a la fois : l'encadre rouge du
     * header, la colonne remplie page 3, et les valeurs des cotes page 2.
     * Nullable pour permettre les brouillons, obligatoire dans le formulaire,
     * bloquant pour la generation du techpack.
     */
    sampleSize: text('sample_size'),
    designer: text('designer').notNull().default('Constitue'),
    company: text('company').notNull().default('Constitue'),
    /** Slot logo du header, present sur les 12 pages. PNG transparent ou SVG. */
    logoStoragePath: text('logo_storage_path'),
    status: text('status').notNull().default('draft'),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('products_category', sql`${t.category} in ('shirt','pants','jacket','other')`),
    check('products_status', sql`${t.status} in ('draft','sample','production','archived')`),
    check(
      'products_gradient_intensity',
      sql`${t.fabricGradientIntensity} is null or ${t.fabricGradientIntensity} in ('subtle','medium','strong')`,
    ),
    // Rend structurellement impossible l'incoherence de l'exemple Seaggs
    // (encadre rouge sur XL, colonne remplie sur L).
    check(
      'products_sample_size_in_range',
      sql`${t.sampleSize} is null or ${t.sampleSize} = any(${t.sizeRange})`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// product_flats
// ---------------------------------------------------------------------------

export const productFlats = pgTable(
  'product_flats',
  {
    id: id(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    storagePath: text('storage_path').notNull(),
    /** Export du canvas (flat + annotations), ecrase a chaque export. */
    overlayStoragePath: text('overlay_storage_path'),
    label: text('label'),
    /** Placement de l'encart flottant sur la page 2. Uniquement pour `flat_detail`. */
    xPercent: percent('x_percent'),
    yPercent: percent('y_percent'),
    widthPercent: percent('width_percent'),
    createdAt: createdAt(),
  },
  (t) => [
    index('product_flats_product_idx').on(t.productId),
    check(
      'product_flats_type',
      sql`${t.type} in ('flat_front','flat_back','flat_detail','inspo_reference')`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// measurement_points
// ---------------------------------------------------------------------------

/**
 * Un point est SIMPLE si endXPercent / endYPercent sont null, LIGNE DE COTE
 * sinon. Pas de colonne `type` redondante.
 */
export const measurementPoints = pgTable(
  'measurement_points',
  {
    id: id(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    flatId: uuid('flat_id')
      .notNull()
      .references(() => productFlats.id, { onDelete: 'cascade' }),
    /** "A", "B", "C"... auto-incremente a la creation, editable. */
    pointLabel: text('point_label').notNull(),
    measurementName: text('measurement_name').notNull(),
    xPercent: percent('x_percent').notNull(),
    yPercent: percent('y_percent').notNull(),
    endXPercent: percent('end_x_percent'),
    endYPercent: percent('end_y_percent'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    index('measurement_points_product_idx').on(t.productId),
    index('measurement_points_flat_idx').on(t.flatId),
  ],
);

export const measurementValues = pgTable(
  'measurement_values',
  {
    id: id(),
    measurementPointId: uuid('measurement_point_id')
      .notNull()
      .references(() => measurementPoints.id, { onDelete: 'cascade' }),
    size: text('size').notNull(),
    /** Toujours en pouces. Aucune conversion implicite vers le metrique. */
    valueInches: numeric('value_inches', { mode: 'number' }).notNull(),
  },
  (t) => [
    unique('measurement_values_point_size').on(t.measurementPointId, t.size),
    index('measurement_values_point_idx').on(t.measurementPointId),
  ],
);

// ---------------------------------------------------------------------------
// bom_items : grille 4x3, cellules A a L (page 4)
// ---------------------------------------------------------------------------

export const bomItems = pgTable(
  'bom_items',
  {
    id: id(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    /** Position dans la grille : "A" en haut a gauche, "L" en bas a droite. */
    cellLabel: text('cell_label').notNull(),
    itemType: text('item_type'),
    title: text('title').notNull(),
    description: text('description'),
    pantoneId: text('pantone_id'),
    imageStoragePath: text('image_storage_path'),
    /** Rendu en cote rouge a cote de l'image, ex "1 inch". */
    measurementNote: text('measurement_note'),
    createdAt: createdAt(),
  },
  (t) => [
    unique('bom_items_product_cell').on(t.productId, t.cellLabel),
    index('bom_items_product_idx').on(t.productId),
    check('bom_items_cell_label', sql`${t.cellLabel} in ('A','B','C','D','E','F','G','H','I','J','K','L')`),
    check(
      'bom_items_type',
      sql`${t.itemType} is null or ${t.itemType} in ('fabric_swatch','hardware','trim','other')`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// callouts : pins numerotes (page 5, 12 emplacements)
// ---------------------------------------------------------------------------

export const callouts = pgTable(
  'callouts',
  {
    id: id(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    flatId: uuid('flat_id').references(() => productFlats.id, { onDelete: 'cascade' }),
    number: integer('number').notNull(),
    xPercent: percent('x_percent').notNull(),
    yPercent: percent('y_percent').notNull(),
    pinDirection: text('pin_direction').notNull().default('left'),
    description: text('description').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    unique('callouts_product_number').on(t.productId, t.number),
    index('callouts_product_idx').on(t.productId),
    index('callouts_flat_idx').on(t.flatId),
    check('callouts_number_range', sql`${t.number} between 1 and 12`),
    check('callouts_pin_direction', sql`${t.pinDirection} in ('left','right')`),
  ],
);

// ---------------------------------------------------------------------------
// color_specs : pins + legende (page 6, 6 emplacements)
// ---------------------------------------------------------------------------

/**
 * `flatId` en `set null` et non `cascade` : supprimer un flat ne doit pas
 * effacer une couleur, seulement son ancrage visuel.
 */
export const colorSpecs = pgTable(
  'color_specs',
  {
    id: id(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    flatId: uuid('flat_id').references(() => productFlats.id, { onDelete: 'set null' }),
    number: integer('number').notNull(),
    name: text('name').notNull(),
    /** Alimente le carre de couleur de la legende. */
    hex: text('hex'),
    /** Affiche en priorite sur `name` s'il existe. */
    pantoneId: text('pantone_id'),
    xPercent: percent('x_percent'),
    yPercent: percent('y_percent'),
    pinDirection: text('pin_direction').notNull().default('left'),
    createdAt: createdAt(),
  },
  (t) => [
    unique('color_specs_product_number').on(t.productId, t.number),
    index('color_specs_product_idx').on(t.productId),
    index('color_specs_flat_idx').on(t.flatId),
    check('color_specs_number_range', sql`${t.number} between 1 and 6`),
    check('color_specs_pin_direction', sql`${t.pinDirection} in ('left','right')`),
  ],
);

// ---------------------------------------------------------------------------
// packaging_specs : canvas libre (page 7)
// ---------------------------------------------------------------------------

export const packagingSpecs = pgTable(
  'packaging_specs',
  {
    id: id(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    type: text('type'),
    title: text('title').notNull(),
    imageStoragePath: text('image_storage_path'),
    widthInches: numeric('width_inches', { mode: 'number' }),
    heightInches: numeric('height_inches', { mode: 'number' }),
    pantoneId: text('pantone_id'),
    pantoneHex: text('pantone_hex'),
    notes: text('notes'),
    xPercent: percent('x_percent'),
    yPercent: percent('y_percent'),
    widthPercent: percent('width_percent'),
    dimensionOrientation: text('dimension_orientation').notNull().default('horizontal'),
    createdAt: createdAt(),
  },
  (t) => [
    index('packaging_specs_product_idx').on(t.productId),
    check(
      'packaging_specs_type',
      sql`${t.type} is null or ${t.type} in ('neck_tag','hang_tag','packaging_bag','other')`,
    ),
    check(
      'packaging_specs_orientation',
      sql`${t.dimensionOrientation} in ('horizontal','vertical')`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// artwork_specs : canvas libre (pages 8-9)
// ---------------------------------------------------------------------------

/**
 * Pas de colonne `pantoneId` ici : les Pantone vivent dans `artworkPantones`,
 * y compris quand il n'y en a qu'un. Une seule source, pas d'arbitrage a
 * l'affichage. L'exemple Seaggs en montre 3 sur un seul element.
 */
export const artworkSpecs = pgTable(
  'artwork_specs',
  {
    id: id(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    flatId: uuid('flat_id').references(() => productFlats.id, { onDelete: 'set null' }),
    page: integer('page').notNull().default(8),
    title: text('title').notNull(),
    technique: text('technique'),
    widthInches: numeric('width_inches', { mode: 'number' }),
    heightInches: numeric('height_inches', { mode: 'number' }),
    positionNote: text('position_note'),
    /**
     * Fond de la vignette. Indispensable pour une impression blanche,
     * invisible sinon sur le fond blanc de la page.
     */
    backgroundHex: text('background_hex'),
    xPercent: percent('x_percent'),
    yPercent: percent('y_percent'),
    widthPercent: percent('width_percent'),
    createdAt: createdAt(),
  },
  (t) => [
    index('artwork_specs_product_idx').on(t.productId),
    index('artwork_specs_flat_idx').on(t.flatId),
    check('artwork_specs_page', sql`${t.page} in (8, 9)`),
  ],
);

export const artworkPantones = pgTable(
  'artwork_pantones',
  {
    id: id(),
    artworkSpecId: uuid('artwork_spec_id')
      .notNull()
      .references(() => artworkSpecs.id, { onDelete: 'cascade' }),
    pantoneId: text('pantone_id').notNull(),
    /** Alimente le petit carre de couleur en legende. */
    hex: text('hex'),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [index('artwork_pantones_spec_idx').on(t.artworkSpecId)],
);

// ---------------------------------------------------------------------------
// extra_references : canvas libre (pages 10-12, une par page)
// ---------------------------------------------------------------------------

export const extraReferences = pgTable(
  'extra_references',
  {
    id: id(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    page: integer('page').notNull().default(10),
    title: text('title'),
    /** ex: "Acid wash garment fabric. Make it look like this:" */
    instructionText: text('instruction_text'),
    imageStoragePath: text('image_storage_path'),
    xPercent: percent('x_percent'),
    yPercent: percent('y_percent'),
    widthPercent: percent('width_percent'),
    createdAt: createdAt(),
  },
  (t) => [
    unique('extra_references_product_page').on(t.productId, t.page),
    index('extra_references_product_idx').on(t.productId),
    check('extra_references_page', sql`${t.page} in (10, 11, 12)`),
  ],
);

// ---------------------------------------------------------------------------
// generated_visuals
// ---------------------------------------------------------------------------

/**
 * `inputFlatIds` est un tableau d'uuid SANS contrainte de cle etrangere :
 * l'historique doit survivre a la suppression d'un flat.
 */
export const generatedVisuals = pgTable(
  'generated_visuals',
  {
    id: id(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    promptUsed: text('prompt_used').notNull(),
    quality: text('quality'),
    storagePath: text('storage_path').notNull(),
    inputFlatIds: uuid('input_flat_ids').array(),
    costUsd: numeric('cost_usd', { mode: 'number' }),
    createdAt: createdAt(),
  },
  (t) => [
    index('generated_visuals_product_idx').on(t.productId),
    check(
      'generated_visuals_quality',
      sql`${t.quality} is null or ${t.quality} in ('low','medium','high')`,
    ),
  ],
);

// ---------------------------------------------------------------------------
// techpack_revisions : tableau REVISION HISTORY (page 1, 4 lignes affichees)
// ---------------------------------------------------------------------------

export const techpackRevisions = pgTable(
  'techpack_revisions',
  {
    id: id(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    /** Colonne HISTORY: du tableau page 1, ex "REV 2". */
    historyLabel: text('history_label'),
    /** Colonne PAGES:, ex "2, 3, 6". */
    pagesAffected: text('pages_affected'),
    summary: text('summary'),
    pdfStoragePath: text('pdf_storage_path'),
    /** Alimente la colonne DATE SUBMITTED:. */
    createdAt: createdAt(),
  },
  (t) => [
    unique('techpack_revisions_product_version').on(t.productId, t.version),
    index('techpack_revisions_product_idx').on(t.productId),
  ],
);

/**
 * Requetes du module produit, essentiellement en lecture.
 *
 * Cote serveur uniquement (importe `lib/db`). Ces fonctions sont appelees par
 * les Server Components des pages : pas de route API intermediaire pour de la
 * simple lecture.
 */

import { and, asc, desc, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  artworkSpecs,
  bomItems,
  callouts,
  colorSpecs,
  extraReferences,
  measurementPoints,
  measurementValues,
  packagingSpecs,
  productFlats,
  products,
} from '@/lib/db/schema';
import type { Product, ProductCategory, ProductFlat, ProductStatus } from '@/types/product';

// ---------------------------------------------------------------------------
// Liste
// ---------------------------------------------------------------------------

export interface ProductListFilters {
  category?: ProductCategory;
  status?: ProductStatus;
}

export async function listProducts(filters: ProductListFilters = {}): Promise<Product[]> {
  const conditions = [
    filters.category ? eq(products.category, filters.category) : undefined,
    filters.status ? eq(products.status, filters.status) : undefined,
  ].filter((c) => c !== undefined);

  return db
    .select()
    .from(products)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(products.dropNumber), asc(products.styleNumber));
}

export async function getProduct(id: string): Promise<Product | null> {
  const [row] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  return row ?? null;
}

/**
 * Logo du produit le plus recent qui en porte un.
 *
 * Sert a pre-remplir le slot logo a la creation, pour eviter de redeposer le
 * meme fichier a chaque piece. Decision de Jay : pas de table de reglages
 * globaux, une requete sur le dernier produit suffit et le champ reste
 * modifiable piece par piece (collab, sous-marque).
 */
export async function getMostRecentLogoPath(): Promise<string | null> {
  const [row] = await db
    .select({ logoStoragePath: products.logoStoragePath })
    .from(products)
    .where(isNotNull(products.logoStoragePath))
    .orderBy(desc(products.createdAt))
    .limit(1);
  return row?.logoStoragePath ?? null;
}

/**
 * Marque le produit comme modifie.
 *
 * A appeler depuis les routes qui font evoluer un sous-module sans ecrire dans
 * `products` (flats aujourd'hui, mesures, BOM et le reste ensuite). Sans ca,
 * `updated_at` ne refleterait que les PATCH du formulaire produit et ne dirait
 * plus rien de la derniere modification reelle.
 */
export async function touchProduct(productId: string): Promise<void> {
  await db.update(products).set({ updatedAt: new Date() }).where(eq(products.id, productId));
}

// ---------------------------------------------------------------------------
// Flats et impact de leur suppression
// ---------------------------------------------------------------------------

/**
 * Nombre d'elements perdus ou orphelins si le flat est supprime.
 *
 * Affiche dans la confirmation de suppression. « Etes-vous sur ? » ne dit pas
 * qu'on s'apprete a perdre 8 points de mesure : il faut le chiffre.
 */
export interface FlatDeletionImpact {
  /** Supprimes en cascade. */
  measurementPoints: number;
  /** Supprimes en cascade. */
  callouts: number;
  /** Conserves, mais leur ancrage visuel passe a null. */
  colorSpecs: number;
  /** Conserves, mais leur ancrage visuel passe a null. */
  artworkSpecs: number;
}

export type FlatWithImpact = ProductFlat & { impact: FlatDeletionImpact };

export async function listFlatsWithImpact(productId: string): Promise<FlatWithImpact[]> {
  const flats = await db
    .select()
    .from(productFlats)
    .where(eq(productFlats.productId, productId))
    .orderBy(asc(productFlats.createdAt));

  if (flats.length === 0) return [];

  const flatIds = flats.map((f) => f.id);
  const impacts = new Map<string, FlatDeletionImpact>(
    flatIds.map((id) => [id, { measurementPoints: 0, callouts: 0, colorSpecs: 0, artworkSpecs: 0 }]),
  );

  // L'assertion `sql<number>` (ici et dans `getProductCompletion`) est le seul
  // typage non derive du module : elle est garantie par le `::int`, sans lequel
  // `count(*)` sortirait en `bigint` que postgres.js remonte en chaine.
  const [pointRows, calloutRows, colorRows, artworkRows] = await Promise.all([
    db
      .select({ flatId: measurementPoints.flatId, total: sql<number>`count(*)::int` })
      .from(measurementPoints)
      .where(inArray(measurementPoints.flatId, flatIds))
      .groupBy(measurementPoints.flatId),
    db
      .select({ flatId: callouts.flatId, total: sql<number>`count(*)::int` })
      .from(callouts)
      .where(inArray(callouts.flatId, flatIds))
      .groupBy(callouts.flatId),
    db
      .select({ flatId: colorSpecs.flatId, total: sql<number>`count(*)::int` })
      .from(colorSpecs)
      .where(inArray(colorSpecs.flatId, flatIds))
      .groupBy(colorSpecs.flatId),
    db
      .select({ flatId: artworkSpecs.flatId, total: sql<number>`count(*)::int` })
      .from(artworkSpecs)
      .where(inArray(artworkSpecs.flatId, flatIds))
      .groupBy(artworkSpecs.flatId),
  ]);

  for (const row of pointRows) {
    const impact = impacts.get(row.flatId);
    if (impact) impact.measurementPoints = row.total;
  }
  for (const row of calloutRows) {
    const impact = row.flatId ? impacts.get(row.flatId) : undefined;
    if (impact) impact.callouts = row.total;
  }
  for (const row of colorRows) {
    const impact = row.flatId ? impacts.get(row.flatId) : undefined;
    if (impact) impact.colorSpecs = row.total;
  }
  for (const row of artworkRows) {
    const impact = row.flatId ? impacts.get(row.flatId) : undefined;
    if (impact) impact.artworkSpecs = row.total;
  }

  return flats.map((flat) => ({
    ...flat,
    impact: impacts.get(flat.id) ?? {
      measurementPoints: 0,
      callouts: 0,
      colorSpecs: 0,
      artworkSpecs: 0,
    },
  }));
}

// ---------------------------------------------------------------------------
// Completion
// ---------------------------------------------------------------------------

/**
 * Etat de remplissage par sous-module.
 *
 * Vraie fonctionnalite, pas du decoratif : c'est ce qui evite d'envoyer un
 * techpack incomplet au fournisseur. Voir .claude/docs/04-module-produit.md.
 */
export interface ProductCompletion {
  flats: { total: number; hasFront: boolean; hasBack: boolean };
  /** Un point est complet quand il porte une valeur pour chaque taille de la gamme. */
  measurements: { points: number; complete: number };
  bom: number;
  colors: number;
  packaging: number;
  artwork: number;
  extra: number;
}

export async function getProductCompletion(product: Product): Promise<ProductCompletion> {
  const [flats, points, bom, colors, packaging, artwork, extra] = await Promise.all([
    db
      .select({ type: productFlats.type })
      .from(productFlats)
      .where(eq(productFlats.productId, product.id)),
    db
      .select({ id: measurementPoints.id })
      .from(measurementPoints)
      .where(eq(measurementPoints.productId, product.id)),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(bomItems)
      .where(eq(bomItems.productId, product.id)),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(colorSpecs)
      .where(eq(colorSpecs.productId, product.id)),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(packagingSpecs)
      .where(eq(packagingSpecs.productId, product.id)),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(artworkSpecs)
      .where(eq(artworkSpecs.productId, product.id)),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(extraReferences)
      .where(eq(extraReferences.productId, product.id)),
  ]);

  // Un point est complet s'il a une valeur pour CHAQUE taille de la gamme du
  // produit. Compter en memoire : le template plafonne a 17 points et 10
  // tailles, une requete d'agregation serait plus lourde a lire qu'a executer.
  let complete = 0;
  if (points.length > 0) {
    const rows = await db
      .select({ pointId: measurementValues.measurementPointId, size: measurementValues.size })
      .from(measurementValues)
      .where(
        inArray(
          measurementValues.measurementPointId,
          points.map((p) => p.id),
        ),
      );
    const sizesByPoint = new Map<string, Set<string>>();
    for (const row of rows) {
      const set = sizesByPoint.get(row.pointId) ?? new Set<string>();
      set.add(row.size);
      sizesByPoint.set(row.pointId, set);
    }
    complete = points.filter((point) => {
      const sizes = sizesByPoint.get(point.id);
      return sizes !== undefined && product.sizeRange.every((s) => sizes.has(s));
    }).length;
  }

  return {
    flats: {
      total: flats.length,
      hasFront: flats.some((f) => f.type === 'flat_front'),
      hasBack: flats.some((f) => f.type === 'flat_back'),
    },
    measurements: { points: points.length, complete },
    bom: bom[0]?.total ?? 0,
    colors: colors[0]?.total ?? 0,
    packaging: packaging[0]?.total ?? 0,
    artwork: artwork[0]?.total ?? 0,
    extra: extra[0]?.total ?? 0,
  };
}

/**
 * Ce qui manque avant de pouvoir generer le techpack.
 *
 * Retourne la liste des raisons de blocage, vide quand tout est pret. Le bouton
 * de generation affiche ces raisons plutot que d'etre grise sans explication.
 */
export function techpackBlockers(
  product: Product,
  completion: ProductCompletion,
): string[] {
  const blockers: string[] = [];
  if (!product.logoStoragePath) blockers.push('aucun logo depose');
  if (!product.sampleSize) blockers.push('taille de reference non definie');
  if (!completion.flats.hasFront) blockers.push('aucun flat FRONT');
  if (!completion.flats.hasBack) blockers.push('aucun flat BACK');
  if (completion.measurements.points === 0) blockers.push('aucun point de mesure');
  return blockers;
}

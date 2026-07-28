/**
 * Requetes du module produit, essentiellement en lecture.
 *
 * Cote serveur uniquement (importe `lib/db`). Ces fonctions sont appelees par
 * les Server Components des pages : pas de route API intermediaire pour de la
 * simple lecture.
 */

import { and, asc, desc, eq, ilike, inArray, isNotNull, or, sql } from 'drizzle-orm';
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
  pantoneColors,
  productFlats,
  products,
} from '@/lib/db/schema';
import { pantoneLabel } from '@/types/product';
import type {
  PantoneColor,
  PantoneLibrary,
  Product,
  ProductCategory,
  ProductFlat,
  ProductStatus,
} from '@/types/product';

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
// Bibliotheque Pantone
// ---------------------------------------------------------------------------

/**
 * Bibliotheque complete, ou filtree par un terme de recherche.
 *
 * La recherche est insensible a la casse et porte sur `reference` ET `name` :
 * Jay cherche indifferemment « 19-4052 » ou « classic blue ». Elle ne porte PAS
 * sur `hex` ni sur `notes`, qui produiraient des correspondances fortuites
 * (« 19 » dans un hex) sans jamais correspondre a une intention de recherche.
 *
 * Tri par `library` puis `reference` : les TCX du vetement se lisent d'un bloc,
 * separes des `C` et `U` du print, qui ne se commandent pas de la meme facon.
 * Le tri est lexicographique sur `reference`, ce qui convient au format FHI a
 * chiffres constants (`19-4052`), et n'est qu'approximatif sur le PMS a nombre
 * variable (`110` se classe avant `7545`, mais aussi avant `21`). Assume : le
 * PMS n'a pas d'ordre numerique qui ait un sens metier ici.
 */
export async function listPantoneColors(search?: string): Promise<PantoneColor[]> {
  const term = search?.trim();
  // `ilike` avec des `%` de part et d'autre : recherche « contient », pas
  // « commence par ». Chercher « 4052 » doit trouver « 19-4052 ».
  const filter = term ? `%${term}%` : undefined;

  return db
    .select()
    .from(pantoneColors)
    .where(
      filter
        ? or(ilike(pantoneColors.reference, filter), ilike(pantoneColors.name, filter))
        : undefined,
    )
    .orderBy(asc(pantoneColors.library), asc(pantoneColors.reference));
}

export async function getPantoneColor(id: string): Promise<PantoneColor | null> {
  const [row] = await db
    .select()
    .from(pantoneColors)
    .where(eq(pantoneColors.id, id))
    .limit(1);
  return row ?? null;
}

/**
 * Message d'erreur si la couleur de tissu soumise n'existe pas en bibliotheque.
 *
 * Rend `null` quand il n'y a rien a signaler : champ absent d'un PATCH partiel,
 * `null` explicite (detacher la couleur), ou uuid existant.
 *
 * Cette verification ne PEUT PAS vivre dans le schema Zod, qui ne voit que le
 * corps de la requete (le commentaire de `fabricPantoneId` dans
 * `lib/validation/product.ts` le dit deja). Sans elle, un uuid inconnu passe la
 * validation et remonte en violation de cle etrangere, donc en 500 illisible la
 * ou il faut un 400 nommant le champ. Le format est le message d'`apiValidationError`
 * (`champ : probleme`), pour que le client affiche les deux cas pareil.
 */
export async function fabricPantoneError(
  fabricPantoneId: string | null | undefined,
): Promise<string | null> {
  if (!fabricPantoneId) return null;
  const color = await getPantoneColor(fabricPantoneId);
  return color ? null : 'fabricPantoneId : couleur absente de la bibliotheque Pantone';
}

/**
 * Ligne portant deja ce couple `(reference, library)`, s'il y en a une.
 *
 * Sert au message d'erreur 409 : nommer la couleur en conflit, avec son nom
 * commercial, est la seule information qui permet de comprendre pourquoi la
 * creation est refusee. Ne remplace PAS la contrainte d'unicite, qui reste
 * l'autorite : les routes attrapent la violation, et n'appellent ceci que pour
 * rediger la reponse.
 */
export async function findPantoneByReference(
  reference: string,
  library: PantoneLibrary | string,
): Promise<PantoneColor | null> {
  const [row] = await db
    .select()
    .from(pantoneColors)
    .where(and(eq(pantoneColors.reference, reference), eq(pantoneColors.library, library)))
    .limit(1);
  return row ?? null;
}

/**
 * Nombre de produits qui referencent cette couleur.
 *
 * Affiche dans la confirmation de suppression. La suppression n'est pas
 * bloquante (`on delete set null` detache les produits sans les supprimer),
 * mais « Etes-vous sur ? » ne dit pas qu'on s'apprete a vider la couleur de
 * tissu de 4 produits : il faut le chiffre.
 */
export async function getPantoneUsage(id: string): Promise<number> {
  // `::int` obligatoire : sans lui `count(*)` sort en `bigint`, que postgres.js
  // remonte en chaine de caracteres.
  const [row] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(products)
    .where(eq(products.fabricPantoneId, id));
  return row?.total ?? 0;
}

/**
 * Nombre de produits par couleur, pour toute la bibliotheque.
 *
 * Meme information que `getPantoneUsage()`, mais en une seule requete : l'ecran
 * de gestion a besoin du chiffre sur CHAQUE ligne, et il en a besoin AVANT la
 * suppression, pour l'annoncer. L'appeler couleur par couleur ferait un N+1 la
 * ou un `group by` suffit.
 *
 * Les couleurs qu'aucun produit ne reference sont absentes du resultat : c'est
 * a l'appelant de lire un manque comme un zero.
 */
export async function listPantoneUsage(): Promise<Record<string, number>> {
  // `::int` obligatoire : sans lui `count(*)` sort en `bigint`, que postgres.js
  // remonte en chaine de caracteres.
  const rows = await db
    .select({ colorId: products.fabricPantoneId, total: sql<number>`count(*)::int` })
    .from(products)
    .where(isNotNull(products.fabricPantoneId))
    .groupBy(products.fabricPantoneId);

  const usage: Record<string, number> = {};
  for (const row of rows) {
    // `isNotNull` a deja ecarte le cas, mais la colonne reste nullable pour
    // TypeScript : le garder explicite evite un cast non justifie.
    if (row.colorId !== null) usage[row.colorId] = row.total;
  }
  return usage;
}

/**
 * Message du 409 sur violation de l'unicite `(reference, library)`.
 *
 * Relit la ligne en conflit pour pouvoir la NOMMER : « Pantone 19-4052 TCX
 * Classic Blue » dit tout de suite de quelle couleur il s'agit, la seule
 * information qui permette de choisir entre corriger la saisie et reutiliser la
 * couleur existante. Le repli sans nom couvre le cas de course ou la ligne aurait
 * disparu entre l'echec de l'ecriture et cette relecture.
 */
export async function pantoneConflictMessage(
  reference: string,
  library: PantoneLibrary | string,
): Promise<string> {
  const existing = await findPantoneByReference(reference, library);
  const label = existing
    ? pantoneLabel(existing)
    : `Pantone ${reference} ${library}`;
  return `${label} est deja dans la bibliotheque`;
}

/**
 * Violation d'une contrainte d'unicite Postgres (SQLSTATE 23505).
 *
 * Permet de repondre 409 avec un message lisible la ou l'erreur brute
 * produirait un 500 et un pave SQL. Le nom de contrainte est verifie par
 * l'appelant quand plusieurs contraintes coexistent sur la table.
 *
 * LA CHAINE DE `cause` EST OBLIGATOIRE. Drizzle n'expose pas l'erreur du
 * pilote : il l'emballe dans une `DrizzleQueryError` qui porte la requete et
 * les parametres, et range la `PostgresError` d'origine dans `cause`. Le
 * `code` et le `constraint_name` ne sont donc JAMAIS sur l'objet de premier
 * niveau. Une premiere version testait l'objet recu directement : elle rendait
 * toujours `false`, et le 409 de la bibliotheque Pantone sortait en 500 avec le
 * SQL complet. Verifie par la recette API (points 24 et 28 de
 * `scripts/api-check.sh`), invisible autrement.
 */
export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  let candidate: unknown = error;
  // Profondeur bornee : une chaine de `cause` cyclique ne doit pas boucler.
  for (let depth = 0; depth < 5; depth += 1) {
    if (typeof candidate !== 'object' || candidate === null) return false;
    const row = candidate as { code?: unknown; constraint_name?: unknown; cause?: unknown };
    if (row.code === '23505') {
      return constraint === undefined || row.constraint_name === constraint;
    }
    candidate = row.cause;
  }
  return false;
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
  // Le tableau vide est valide en base (brouillon) : c'est ici, et seulement
  // ici, qu'au moins une taille d echantillon devient obligatoire.
  if (product.sampleSizes.length === 0) blockers.push('aucune taille d echantillon definie');
  if (!completion.flats.hasFront) blockers.push('aucun flat FRONT');
  if (!completion.flats.hasBack) blockers.push('aucun flat BACK');
  if (completion.measurements.points === 0) blockers.push('aucun point de mesure');
  return blockers;
}

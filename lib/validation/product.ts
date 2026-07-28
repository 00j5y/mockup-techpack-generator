/**
 * Contrats d'entree des routes produit.
 *
 * Le schema Zod est la source de verite du contrat d'API. Il double
 * volontairement les contraintes CHECK de Postgres : la base est le dernier
 * rempart, mais une violation de CHECK remonte en erreur 500 illisible. Ici on
 * repond 400 avec le nom du champ fautif.
 */

import { z } from 'zod';
import {
  FLAT_TYPES,
  GRADIENT_INTENSITIES,
  PRODUCT_CATEGORIES,
  PRODUCT_STATUSES,
  TECHPACK_SIZE_COLUMNS,
} from '@/types/product';

const text = z.string().trim();
const hex = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'couleur attendue au format #RRGGBB');

/**
 * Normalise le « vide » d'un champ texte nullable : `''` devient `null`.
 *
 * Sans ca, vider DESCRIPTION depuis le header enregistre `''` alors que le
 * formulaire de creation enregistre `null` : deux representations du meme vide
 * cohabitent en base, et un `is null` en Phase 4 en raterait la moitie.
 *
 * A appliquer a tout champ texte nullable, y compris ceux dont le sous-schema
 * refuserait la chaine vide (hex, `min(1)`) : cote saisie, effacer un champ doit
 * l'effacer, pas produire une erreur 400 pendant l'auto-save.
 */
const emptyToNull = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? null : value;

/**
 * Les tailles saisissables sont les 10 colonnes du tableau page 3.
 *
 * `size_range` est un `text[]` libre en base, mais une taille hors de ces 10
 * colonnes n'aurait aucune colonne ou s'afficher dans le techpack : elle
 * disparaitrait silencieusement a la generation. Refuser a la saisie.
 */
const size = z.enum(TECHPACK_SIZE_COLUMNS, {
  error: `taille attendue parmi ${TECHPACK_SIZE_COLUMNS.join(', ')}`,
});

/**
 * Champs de `products`, sans valeur par defaut.
 *
 * Pas de `.default()` ici, deliberement : `.partial()` conserve les defauts, et
 * un PATCH qui n'envoie pas `designer` reecrirait alors "Constitue" par-dessus
 * la valeur reelle. Les valeurs par defaut sont pre-remplies par le formulaire
 * de creation, cote client, la ou elles sont visibles.
 *
 * `logoStoragePath` n'est PAS ici : il n'existe qu'a la creation, ou il sert au
 * pre-remplissage. L'exposer au PATCH permettrait de faire pointer un produit
 * sur le fichier d'un autre, puis de l'effacer en deposant un nouveau logo. Le
 * logo a ses deux routes dediees, POST et DELETE sur `/logo`.
 */
const productFields = z.strictObject({
  dropNumber: z.number().int().min(1, 'numero de drop minimum 1'),
  styleName: text.min(1, 'obligatoire'),
  styleNumber: text.min(1, 'obligatoire'),
  category: z.enum(PRODUCT_CATEGORIES, {
    error: `categorie attendue parmi ${PRODUCT_CATEGORIES.join(', ')}`,
  }),
  mainFabric: text.min(1, 'obligatoire'),
  description: z.preprocess(emptyToNull, text.nullable()),
  fabricColorHex: z.preprocess(emptyToNull, hex.nullable()),
  fabricGradientEnabled: z.boolean(),
  // `null` explicite accepte : c'est la valeur qui remet l'intensite a
  // « non renseignee », distincte de l'absence du champ dans un PATCH partiel.
  fabricGradientIntensity: z
    .enum(GRADIENT_INTENSITIES, {
      error: `intensite attendue parmi ${GRADIENT_INTENSITIES.join(', ')}`,
    })
    .nullable(),
  sizeRange: z.array(size).min(1, 'au moins une taille'),
  sampleSize: size.nullable(),
  designer: text.min(1, 'obligatoire'),
  company: text.min(1, 'obligatoire'),
  status: z.enum(PRODUCT_STATUSES, {
    error: `statut attendu parmi ${PRODUCT_STATUSES.join(', ')}`,
  }),
});

/**
 * Creation. `sampleSize` y est obligatoire alors qu'il est nullable en base :
 * il pilote trois rendus du techpack (encadre rouge du header, colonne remplie
 * page 3, valeurs des cotes page 2), autant l'exiger tout de suite.
 *
 * `logoStoragePath` n'apparait qu'ici : le formulaire de creation pre-remplit le
 * logo du produit le plus recent, la route se charge ensuite d'en dupliquer le
 * fichier sous le nouveau produit.
 */
export const productCreateSchema = productFields
  .extend({
    sampleSize: size,
    logoStoragePath: z.preprocess(emptyToNull, text.min(1).nullable()),
  })
  .refine((value) => value.sizeRange.includes(value.sampleSize), {
    message: 'la taille de reference doit faire partie de la gamme',
    path: ['sampleSize'],
  });

/** Mise a jour partielle, un champ a la fois dans le cas de l'auto-save. */
export const productPatchSchema = productFields.partial();

export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductPatchInput = z.infer<typeof productPatchSchema>;

/**
 * Coherence `sample_size` / `size_range` apres fusion avec la ligne existante.
 *
 * Un PATCH peut ne toucher qu'a l'un des deux : la verification ne peut donc
 * pas vivre dans le schema Zod, qui ne voit que le corps de la requete.
 * Reproduit le CHECK `products_sample_size_in_range`.
 */
export function sampleSizeError(
  sizeRange: readonly string[],
  sampleSize: string | null,
): string | null {
  if (sampleSize === null) return null;
  if (sizeRange.includes(sampleSize)) return null;
  return `La taille de reference ${sampleSize} ne fait pas partie de la gamme (${sizeRange.join(', ')})`;
}

// ---------------------------------------------------------------------------
// Flats
// ---------------------------------------------------------------------------

/**
 * Metadonnees accompagnant l'upload d'un flat. Le fichier lui-meme est valide
 * par `lib/storage` (type MIME, taille).
 */
export const flatUploadSchema = z
  .strictObject({
    type: z.enum(FLAT_TYPES, { error: `type attendu parmi ${FLAT_TYPES.join(', ')}` }),
    label: text.min(1).nullable(),
  })
  .refine((value) => value.type !== 'flat_detail' || value.label !== null, {
    message: 'un flat de detail doit porter un libelle',
    path: ['label'],
  });

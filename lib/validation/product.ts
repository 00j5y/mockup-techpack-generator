/**
 * Contrats d'entree des routes produit.
 *
 * Le schema Zod est la source de verite du contrat d'API. Il double
 * volontairement les contraintes CHECK de Postgres : la base est le dernier
 * rempart, mais une violation de CHECK remonte en erreur 500 illisible. Ici on
 * repond 400 avec le nom du champ fautif.
 */

import { z } from 'zod';
import { emptyToNull, text } from '@/lib/validation/common';
import {
  FLAT_TYPES,
  GRADIENT_INTENSITIES,
  PRODUCT_CATEGORIES,
  PRODUCT_STATUSES,
  TECHPACK_SIZE_COLUMNS,
  sortSizes,
} from '@/types/product';

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
 * Tailles d'echantillon, normalisees A L'ECRITURE.
 *
 * Le tri suit l'ordre canonique du template et non l'ordre de saisie, et les
 * doublons sautent : le premier element du tableau stocke est donc toujours la
 * taille dont les cotes de la page 2 portent les valeurs (voir
 * `primarySampleSize()` dans `types/product.ts`). Normaliser ici plutot qu'a
 * l'affichage garantit que deux produits portant les memes tailles produisent le
 * meme techpack.
 *
 * Tableau vide accepte : c'est l'etat d'un brouillon, comme le `sample_size`
 * nullable qu'il remplace. La creation, elle, en exige au moins une.
 */
const sampleSizes = z.array(size).transform(sortSizes);

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
  /**
   * Reference vers la bibliotheque Pantone, ou `null` pour detacher.
   *
   * L'EXISTENCE de l'uuid n'est PAS verifiee ici : le schema Zod ne voit que le
   * corps de la requete, pas la base. Les routes produit interrogent
   * `getPantoneColor()` avant d'ecrire, faute de quoi un uuid inconnu
   * remonterait en violation de cle etrangere, donc en 500 illisible.
   */
  fabricPantoneId: z.preprocess(emptyToNull, z.uuid('identifiant de couleur invalide').nullable()),
  fabricGradientEnabled: z.boolean(),
  // `null` explicite accepte : c'est la valeur qui remet l'intensite a
  // « non renseignee », distincte de l'absence du champ dans un PATCH partiel.
  fabricGradientIntensity: z
    .enum(GRADIENT_INTENSITIES, {
      error: `intensite attendue parmi ${GRADIENT_INTENSITIES.join(', ')}`,
    })
    .nullable(),
  sizeRange: z.array(size).min(1, 'au moins une taille'),
  sampleSizes,
  designer: text.min(1, 'obligatoire'),
  company: text.min(1, 'obligatoire'),
  status: z.enum(PRODUCT_STATUSES, {
    error: `statut attendu parmi ${PRODUCT_STATUSES.join(', ')}`,
  }),
});

/**
 * Creation. `sampleSizes` y exige AU MOINS UNE taille alors que la base accepte
 * le tableau vide : ces tailles pilotent trois rendus du techpack (encadres
 * rouges du header, colonnes remplies page 3, valeurs des cotes page 2), autant
 * les exiger tout de suite. Le tableau vide reste la souplesse du brouillon,
 * atteignable par PATCH.
 *
 * `logoStoragePath` n'apparait qu'ici : le formulaire de creation pre-remplit le
 * logo du produit le plus recent, la route se charge ensuite d'en dupliquer le
 * fichier sous le nouveau produit.
 */
export const productCreateSchema = productFields
  .extend({
    sampleSizes: z.array(size).min(1, 'au moins une taille d echantillon').transform(sortSizes),
    logoStoragePath: z.preprocess(emptyToNull, text.min(1).nullable()),
  })
  // `superRefine` et pas `refine` : le message doit NOMMER les tailles fautives,
  // ce qu'un message statique ne peut pas faire.
  .superRefine((value, ctx) => {
    const conflict = sampleSizesError(value.sizeRange, value.sampleSizes);
    if (conflict) {
      ctx.addIssue({ code: 'custom', message: conflict, path: ['sampleSizes'] });
    }
  });

/** Mise a jour partielle, un champ a la fois dans le cas de l'auto-save. */
export const productPatchSchema = productFields.partial();

export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductPatchInput = z.infer<typeof productPatchSchema>;

/**
 * Inclusion d'ensemble `sample_sizes` dans `size_range`, apres fusion avec la
 * ligne existante.
 *
 * Un PATCH peut ne toucher qu'a l'un des deux : la verification ne peut donc
 * pas vivre dans le schema Zod, qui ne voit que le corps de la requete.
 * Reproduit le CHECK `products_sample_sizes_in_range` (`sample_sizes <@
 * size_range`), tableau vide compris, qui est inclus dans n'importe quelle
 * gamme.
 *
 * Le message NOMME les tailles fautives : sur un PATCH de `sizeRange` qui
 * decocherait une taille encore utilisee comme echantillon, savoir laquelle est
 * la seule information qui permet de corriger.
 */
export function sampleSizesError(
  sizeRange: readonly string[],
  sampleSizes: readonly string[],
): string | null {
  const outOfRange = sampleSizes.filter((size) => !sizeRange.includes(size));
  if (outOfRange.length === 0) return null;
  const subject =
    outOfRange.length === 1
      ? `La taille d echantillon ${outOfRange[0]} ne fait pas`
      : `Les tailles d echantillon ${outOfRange.join(', ')} ne font pas`;
  return `${subject} partie de la gamme (${sizeRange.join(', ')})`;
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

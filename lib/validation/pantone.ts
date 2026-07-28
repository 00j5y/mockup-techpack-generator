/**
 * Contrats d'entree des routes de la bibliotheque Pantone.
 *
 * Meme principe que `lib/validation/product.ts` : le schema Zod est la source de
 * verite du contrat d'API et double volontairement les CHECK de Postgres, qui
 * restent le dernier rempart mais remontent en 500 illisible. Ici on repond 400
 * en nommant le champ fautif.
 *
 * Rappel du modele : le HEX N'EST PAS LA SPECIFICATION. C'est `reference` +
 * `library` qui font foi chez le fournisseur, le hex ne sert qu'a l'affichage.
 * Il reste `not null` parce qu'une pastille de couleur vide dans la bibliotheque
 * ne servirait a rien, pas parce qu'il aurait valeur de reference.
 */

import { z } from 'zod';
import { emptyToNull, hex, text } from '@/lib/validation/common';
import { PANTONE_LIBRARIES } from '@/types/product';

/**
 * Champs de `pantone_colors`, sans valeur par defaut.
 *
 * Pas de `.default()` ici, pour la meme raison que dans `productFields` :
 * `.partial()` conserve les defauts, et un PATCH qui n'enverrait pas `name`
 * reecrirait alors `null` par-dessus la valeur reelle. Les defauts du formulaire
 * de creation sont poses plus bas, sur le seul `pantoneCreateSchema`.
 */
const pantoneFields = z.strictObject({
  /**
   * Sans le suffixe de bibliotheque : `19-4052`, pas `19-4052 TCX`. Le suffixe
   * est porte par `library`, et `pantoneLabel()` les rassemble a l'affichage.
   */
  reference: text.min(1, 'obligatoire'),
  library: z.enum(PANTONE_LIBRARIES, {
    error: `bibliotheque attendue parmi ${PANTONE_LIBRARIES.join(', ')}`,
  }),
  // `null` explicite accepte : c'est la valeur qui efface un nom commercial,
  // distincte de l'absence du champ dans un PATCH partiel.
  name: z.preprocess(emptyToNull, text.min(1).nullable()),
  hex,
  notes: z.preprocess(emptyToNull, text.min(1).nullable()),
});

/**
 * Creation.
 *
 * `name` et `notes` valent `null` par defaut : une couleur validee sur un lab
 * dip peut n'avoir aucun nom commercial, et exiger `"name": null` dans le corps
 * n'apporterait rien. Le defaut est pose ICI et pas dans `pantoneFields`, sans
 * quoi il contaminerait le PATCH.
 */
export const pantoneCreateSchema = pantoneFields.extend({
  name: z.preprocess(emptyToNull, text.min(1).nullable()).default(null),
  notes: z.preprocess(emptyToNull, text.min(1).nullable()).default(null),
});

/** Mise a jour partielle, un champ a la fois dans le cas de l'auto-save. */
export const pantonePatchSchema = pantoneFields.partial();

export type PantoneCreateInput = z.infer<typeof pantoneCreateSchema>;
export type PantonePatchInput = z.infer<typeof pantonePatchSchema>;

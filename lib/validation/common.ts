/**
 * Briques communes aux schemas Zod des routes.
 *
 * Ces trois helpers etaient definis dans `lib/validation/product.ts`. Ils sont
 * remontes ici a l'arrivee de `pantone.ts` : recopier `emptyToNull` aurait
 * suffi a faire diverger deux definitions du « vide », donc deux
 * representations de la meme absence en base.
 */

import { z } from 'zod';

/** Champ texte trime. Base de tous les champs texte des schemas. */
export const text = z.string().trim();

/**
 * Couleur au format `#RRGGBB`.
 *
 * Double le CHECK `pantone_colors_hex` de la base : la base est le dernier
 * rempart, mais une violation de CHECK remonte en 500 illisible.
 */
export const hex = z
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
export const emptyToNull = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? null : value;

/**
 * Contrat d'entree des routes de la bibliotheque Pantone
 * (`lib/validation/pantone.ts`) et libelle de couleur (`types/product.ts`).
 *
 * Chaque cas correspond a une decision, pas a une observation : un test qui
 * changerait de reponse ici signale une regression du contrat d'API ou du
 * libelle qui part chez le fournisseur, pas un test a mettre a jour.
 *
 * Tests purs : pas de base, pas de reseau. `lib/db` importe `server-only` et
 * n'est volontairement jamais atteint depuis ce fichier.
 */

import { describe, expect, test } from 'bun:test';
import { pantoneCreateSchema, pantonePatchSchema } from '@/lib/validation/pantone';
import { PANTONE_LIBRARIES, pantoneLabel } from '@/types/product';

/** Couleur valide minimale, base de tous les cas de creation. */
function validCreateInput() {
  return {
    reference: '19-4052',
    library: 'TCX',
    name: 'Classic Blue',
    hex: '#0F4C81',
    notes: 'Lab dip valide le 12/03',
  };
}

/** Chemins des erreurs d un `safeParse` echoue, en notation pointee. */
function issuePaths(result: {
  error?: { readonly issues: readonly { readonly path: readonly PropertyKey[] }[] };
}) {
  return (result.error?.issues ?? []).map((issue) => issue.path.join('.'));
}

describe('pantoneCreateSchema', () => {
  test('accepte une creation valide', () => {
    expect(pantoneCreateSchema.safeParse(validCreateInput()).success).toBe(true);
  });

  test('accepte les quatre bibliotheques du CHECK, et rien d autre', () => {
    // Le schema Zod double le CHECK `pantone_colors_library` : la base reste le
    // dernier rempart, mais une violation de CHECK sort en 500 illisible.
    for (const library of PANTONE_LIBRARIES) {
      expect(pantoneCreateSchema.safeParse({ ...validCreateInput(), library }).success).toBe(true);
    }
    const result = pantoneCreateSchema.safeParse({ ...validCreateInput(), library: 'TCXX' });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain('library');
  });

  test('refuse une couleur qui n est pas au format #RRGGBB', () => {
    for (const hex of ['1A1A1A', '#GGGGGG', '#FFF', 'bleu', '#0F4C81FF']) {
      const result = pantoneCreateSchema.safeParse({ ...validCreateInput(), hex });
      expect(result.success).toBe(false);
      expect(issuePaths(result)).toContain('hex');
    }
  });

  test('accepte le hex en minuscules', () => {
    // Le CHECK de la base accepte les deux casses (`[0-9A-Fa-f]`) : normaliser
    // ici ferait diverger le contrat d API de la contrainte.
    expect(pantoneCreateSchema.safeParse({ ...validCreateInput(), hex: '#0f4c81' }).success).toBe(
      true,
    );
  });

  test('exige une reference non vide', () => {
    const result = pantoneCreateSchema.safeParse({ ...validCreateInput(), reference: '   ' });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain('reference');
  });

  test('trime la reference', () => {
    expect(pantoneCreateSchema.safeParse({ ...validCreateInput(), reference: '  19-4052  ' }).data)
      .toMatchObject({ reference: '19-4052' });
  });

  test('rend name et notes optionnels, a null', () => {
    // Une couleur validee sur un lab dip peut n avoir aucun nom commercial :
    // exiger `"name": null` dans le corps n apporterait rien.
    const withoutOptional: Record<string, unknown> = validCreateInput();
    delete withoutOptional.name;
    delete withoutOptional.notes;
    const result = pantoneCreateSchema.safeParse(withoutOptional);
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ name: null, notes: null });
  });

  test('normalise en null une chaine vide sur name et notes', () => {
    const result = pantoneCreateSchema.safeParse({
      ...validCreateInput(),
      name: '',
      notes: '   ',
    });
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ name: null, notes: null });
  });

  test('refuse un champ inconnu', () => {
    // `strictObject` : envoyer `pantoneId` ou `colorHex` doit echouer bruyamment,
    // pas etre ignore en silence pendant qu on croit avoir enregistre.
    const result = pantoneCreateSchema.safeParse({ ...validCreateInput(), colorHex: '#000000' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].code).toBe('unrecognized_keys');
  });
});

describe('pantonePatchSchema', () => {
  test('accepte un objet partiel d un seul champ', () => {
    const result = pantonePatchSchema.safeParse({ name: 'Classic Blue' });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ name: 'Classic Blue' });
  });

  test('n injecte aucun defaut sur les champs absents', () => {
    // Le piege que `pantoneFields` evite en ne portant aucun `.default()` :
    // `.partial()` les conserverait, et un PATCH de `hex` seul reecrirait
    // `name` a `null` par-dessus la valeur reelle.
    const result = pantonePatchSchema.safeParse({ hex: '#000000' });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ hex: '#000000' });
    expect(Object.keys(result.data ?? {})).toEqual(['hex']);
  });

  test('accepte null explicite pour effacer un nom commercial', () => {
    const result = pantonePatchSchema.safeParse({ name: null });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ name: null });
  });

  test('applique les memes formats que la creation', () => {
    expect(pantonePatchSchema.safeParse({ hex: 'bleu' }).success).toBe(false);
    expect(pantonePatchSchema.safeParse({ library: 'PMS' }).success).toBe(false);
    expect(pantonePatchSchema.safeParse({ reference: '' }).success).toBe(false);
  });

  test('accepte l objet vide, que la route rejette elle-meme', () => {
    // Le schema n a pas a connaitre cette regle : c est la route qui repond
    // « Aucun champ a mettre a jour », comme sur le produit.
    const result = pantonePatchSchema.safeParse({});
    expect(result.success).toBe(true);
    expect(result.data).toEqual({});
  });
});

describe('pantoneLabel', () => {
  test('rend reference, bibliotheque puis nom commercial', () => {
    expect(pantoneLabel({ reference: '19-4052', library: 'TCX', name: 'Classic Blue' })).toBe(
      'Pantone 19-4052 TCX Classic Blue',
    );
  });

  test('omet le nom commercial quand il n y en a pas', () => {
    expect(pantoneLabel({ reference: '7545', library: 'C', name: null })).toBe('Pantone 7545 C');
  });

  test('omet un nom reduit a des espaces, sans laisser d espace en fin', () => {
    // Une ligne ecrite hors des routes API peut porter une chaine d espaces :
    // le libelle ne doit pas se terminer par une espace pour autant.
    expect(pantoneLabel({ reference: '7545', library: 'U', name: '   ' })).toBe('Pantone 7545 U');
  });

  test('inclut toujours la bibliotheque', () => {
    // `7545 C` et `7545 U` ne donnent pas la meme couleur : la bibliotheque fait
    // partie integrante de la reference qui part chez le fournisseur.
    expect(pantoneLabel({ reference: '7545', library: 'C', name: null })).not.toBe(
      pantoneLabel({ reference: '7545', library: 'U', name: null }),
    );
  });

  test('ne fait jamais apparaitre le hex', () => {
    // Le hex est INDICATIF : il n a rien a faire dans une commande fournisseur.
    const label = pantoneLabel({ reference: '19-4052', library: 'TCX', name: 'Classic Blue' });
    expect(label).not.toContain('#');
  });
});

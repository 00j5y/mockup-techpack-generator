/**
 * Contrats d'entree des routes produit (`lib/validation/product.ts`).
 *
 * Ces schemas sont le dernier filtre avant la base : chaque cas ci-dessous
 * correspond a un comportement decide, pas a une observation. Un test qui
 * changerait de reponse ici est le signe d'une regression de contrat d'API, pas
 * d'un test a mettre a jour.
 *
 * Tests purs : pas de base, pas de reseau. `lib/db` et `lib/storage` importent
 * `server-only` et ne sont volontairement jamais atteints depuis ce fichier.
 */

import { describe, expect, test } from 'bun:test';
import {
  flatUploadSchema,
  productCreateSchema,
  productPatchSchema,
  sampleSizeError,
} from '@/lib/validation/product';

/** Produit valide minimal, base de tous les cas de creation. */
function validCreateInput() {
  return {
    dropNumber: 1,
    styleName: 'Boxy Tee',
    styleNumber: 'CST-001',
    category: 'shirt',
    mainFabric: 'Jersey coton 240g',
    description: 'Tee coupe boxy',
    fabricColorHex: '#1A1A1A',
    fabricGradientEnabled: false,
    fabricGradientIntensity: null,
    sizeRange: ['S', 'M', 'L'],
    sampleSize: 'M',
    designer: 'Jay',
    company: 'Constitue',
    status: 'draft',
    logoStoragePath: null,
  };
}

/** Chemins des erreurs d un `safeParse` echoue, en notation pointee. */
function issuePaths(result: {
  error?: { readonly issues: readonly { readonly path: readonly PropertyKey[] }[] };
}) {
  return (result.error?.issues ?? []).map((issue) => issue.path.join('.'));
}

describe('productCreateSchema', () => {
  test('accepte une creation valide', () => {
    const result = productCreateSchema.safeParse(validCreateInput());
    expect(result.success).toBe(true);
  });

  test('refuse une taille de reference hors de la gamme, sur le chemin sampleSize', () => {
    const result = productCreateSchema.safeParse({ ...validCreateInput(), sampleSize: 'XL' });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain('sampleSize');
    expect(result.error?.issues[0].message).toMatch(/gamme/i);
  });

  test('refuse une categorie inconnue', () => {
    const result = productCreateSchema.safeParse({ ...validCreateInput(), category: 'hat' });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain('category');
  });

  /**
   * Les tailles saisissables sont les 10 colonnes du tableau page 3. Une taille
   * hors de ces colonnes n aurait aucune case ou s afficher : elle
   * disparaitrait silencieusement a la generation du techpack.
   */
  test('refuse une taille hors des 10 colonnes du template', () => {
    const result = productCreateSchema.safeParse({
      ...validCreateInput(),
      sizeRange: ['S', '9XL'],
      sampleSize: 'S',
    });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain('sizeRange.1');
  });

  test('refuse une gamme de tailles vide', () => {
    const result = productCreateSchema.safeParse({
      ...validCreateInput(),
      sizeRange: [],
      sampleSize: 'M',
    });
    expect(result.success).toBe(false);
  });

  test('exige une taille de reference a la creation', () => {
    const input: Record<string, unknown> = validCreateInput();
    input.sampleSize = null;
    const result = productCreateSchema.safeParse(input);
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain('sampleSize');
  });

  test('refuse une couleur qui n est pas au format #RRGGBB', () => {
    const result = productCreateSchema.safeParse({
      ...validCreateInput(),
      fabricColorHex: '1A1A1A',
    });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain('fabricColorHex');
  });

  test('refuse un numero de drop inferieur a 1', () => {
    const result = productCreateSchema.safeParse({ ...validCreateInput(), dropNumber: 0 });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain('dropNumber');
  });
});

describe('productPatchSchema', () => {
  test('accepte un objet partiel d un seul champ', () => {
    const result = productPatchSchema.safeParse({ styleName: 'Boxy Tee v2' });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ styleName: 'Boxy Tee v2' });
  });

  test('accepte un objet vide', () => {
    expect(productPatchSchema.safeParse({}).success).toBe(true);
  });

  /**
   * `strictObject` protege l auto-save des fautes de frappe : un PATCH qui
   * enverrait `styleNam` serait sinon accepte et n enregistrerait rien, en
   * silence, avec un indicateur de sauvegarde au vert.
   */
  test('refuse une cle inconnue', () => {
    const result = productPatchSchema.safeParse({ styleNam: 'faute de frappe' });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].code).toBe('unrecognized_keys');
  });

  /**
   * VERROU DE SECURITE, ne pas relacher.
   *
   * `logoStoragePath` a ete volontairement retire du PATCH. Expose, il
   * permettait de faire pointer un produit vers le fichier logo d un AUTRE
   * produit, puis de faire supprimer ce fichier en deposant un nouveau logo :
   * suppression du bien d autrui par simple chemin arbitraire.
   *
   * Le logo passe desormais par ses deux routes dediees, POST et DELETE sur
   * `/logo`, qui derivent le chemin du produit cible. Reintroduire ce champ dans
   * le PATCH reintroduit la faille.
   */
  test('refuse logoStoragePath, retire du PATCH pour une raison de securite', () => {
    const result = productPatchSchema.safeParse({
      logoStoragePath: 'products/un-autre-produit/logo.png',
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].code).toBe('unrecognized_keys');
  });

  test('normalise en null une chaine vide sur un champ texte nullable', () => {
    // Vider DESCRIPTION depuis le header doit enregistrer `null`, la meme
    // representation du vide que le formulaire de creation. Deux vides
    // differents en base et un `is null` de Phase 4 en raterait la moitie.
    expect(productPatchSchema.safeParse({ description: '' }).data).toEqual({ description: null });
    expect(productPatchSchema.safeParse({ description: '   ' }).data).toEqual({
      description: null,
    });
  });

  test('normalise en null une chaine vide meme sur un champ au format contraint', () => {
    // Effacer un champ couleur doit l effacer, pas produire un 400 pendant
    // l auto-save alors que le regex `#RRGGBB` refuserait la chaine vide.
    const result = productPatchSchema.safeParse({ fabricColorHex: '  ' });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ fabricColorHex: null });
  });

  test('trime une valeur entouree d espaces', () => {
    expect(productPatchSchema.safeParse({ description: '  Tee boxy  ' }).data).toEqual({
      description: 'Tee boxy',
    });
    expect(productPatchSchema.safeParse({ styleName: '  Boxy Tee  ' }).data).toEqual({
      styleName: 'Boxy Tee',
    });
  });

  test('accepte null explicite sur l intensite de degrade', () => {
    // `null` est la valeur qui remet l intensite a « non renseignee », distincte
    // de l absence du champ dans un PATCH partiel.
    const result = productPatchSchema.safeParse({ fabricGradientIntensity: null });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ fabricGradientIntensity: null });
  });

  test('refuse une valeur vide sur un champ texte obligatoire', () => {
    const result = productPatchSchema.safeParse({ styleName: '   ' });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain('styleName');
  });

  /**
   * `productFields` ne porte aucun `.default()` : un PATCH qui ne mentionne pas
   * `designer` ne doit pas reecrire « Constitue » par-dessus la valeur reelle.
   */
  test('ne reintroduit aucune valeur par defaut sur un PATCH partiel', () => {
    const result = productPatchSchema.safeParse({ styleName: 'Boxy Tee' });
    expect(Object.keys(result.data ?? {})).toEqual(['styleName']);
  });
});

describe('sampleSizeError', () => {
  test('ne signale rien quand la taille de reference est absente', () => {
    expect(sampleSizeError(['S', 'M'], null)).toBeNull();
  });

  test('ne signale rien quand la taille de reference est dans la gamme', () => {
    expect(sampleSizeError(['S', 'M', 'L'], 'M')).toBeNull();
  });

  test('signale la taille et la gamme quand elle est hors gamme', () => {
    const error = sampleSizeError(['S', 'M', 'L'], 'XL');
    expect(error).not.toBeNull();
    expect(error).toContain('XL');
    expect(error).toContain('S, M, L');
  });
});

describe('flatUploadSchema', () => {
  test('refuse un flat de detail sans libelle, sur le chemin label', () => {
    const result = flatUploadSchema.safeParse({ type: 'flat_detail', label: null });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain('label');
  });

  test('accepte un flat de detail avec libelle', () => {
    const result = flatUploadSchema.safeParse({ type: 'flat_detail', label: 'Capuche' });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ type: 'flat_detail', label: 'Capuche' });
  });

  test('accepte un flat qui n est pas un detail sans libelle', () => {
    expect(flatUploadSchema.safeParse({ type: 'flat_front', label: null }).success).toBe(true);
  });

  test('refuse un libelle reduit a des espaces sur un flat de detail', () => {
    const result = flatUploadSchema.safeParse({ type: 'flat_detail', label: '   ' });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain('label');
  });

  test('refuse un type de flat inconnu', () => {
    const result = flatUploadSchema.safeParse({ type: 'flat_side', label: null });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain('type');
  });
});

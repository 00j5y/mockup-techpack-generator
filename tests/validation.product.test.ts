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
  sampleSizesError,
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
    fabricPantoneId: '3f2b0a5c-1d6e-4f2a-9c3b-8e7d6a5b4c3d',
    fabricGradientEnabled: false,
    fabricGradientIntensity: null,
    sizeRange: ['S', 'M', 'L'],
    sampleSizes: ['M'],
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

  test('accepte plusieurs tailles d echantillon', () => {
    // La demande d origine : produire un sample en M ET en L.
    const result = productCreateSchema.safeParse({
      ...validCreateInput(),
      sampleSizes: ['M', 'L'],
    });
    expect(result.success).toBe(true);
    expect(result.data?.sampleSizes).toEqual(['M', 'L']);
  });

  test('refuse une taille d echantillon hors de la gamme, sur le chemin sampleSizes', () => {
    const result = productCreateSchema.safeParse({
      ...validCreateInput(),
      sampleSizes: ['M', 'XL'],
    });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain('sampleSizes');
    expect(result.error?.issues[0].message).toMatch(/gamme/i);
    // Le message doit NOMMER la taille fautive, et elle seule.
    expect(result.error?.issues[0].message).toContain('XL');
  });

  /**
   * L ordre stocke est l ordre canonique du template, pas l ordre de saisie :
   * le premier element est la taille dont les cotes de la page 2 portent les
   * valeurs, deux produits aux memes tailles doivent donner le meme techpack.
   */
  test('normalise l ordre des tailles d echantillon a l ecriture', () => {
    const result = productCreateSchema.safeParse({
      ...validCreateInput(),
      sizeRange: ['S', 'M', 'L'],
      sampleSizes: ['L', 'S', 'M'],
    });
    expect(result.success).toBe(true);
    expect(result.data?.sampleSizes).toEqual(['S', 'M', 'L']);
  });

  test('dedoublonne les tailles d echantillon a l ecriture', () => {
    const result = productCreateSchema.safeParse({
      ...validCreateInput(),
      sampleSizes: ['L', 'M', 'L'],
    });
    expect(result.success).toBe(true);
    expect(result.data?.sampleSizes).toEqual(['M', 'L']);
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
      sampleSizes: ['S'],
    });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain('sizeRange.1');
  });

  test('refuse une gamme de tailles vide', () => {
    const result = productCreateSchema.safeParse({
      ...validCreateInput(),
      sizeRange: [],
      sampleSizes: ['M'],
    });
    expect(result.success).toBe(false);
  });

  /**
   * Le tableau vide est valide en base (brouillon) et valide au PATCH, mais la
   * creation exige au moins une taille : c est l esprit de l ancien
   * `.extend({ sampleSize: size })`, qui rendait la taille obligatoire alors que
   * la colonne etait nullable.
   */
  test('exige au moins une taille d echantillon a la creation', () => {
    const result = productCreateSchema.safeParse({ ...validCreateInput(), sampleSizes: [] });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain('sampleSizes');
  });

  test('refuse une taille d echantillon hors des 10 colonnes du template', () => {
    const result = productCreateSchema.safeParse({
      ...validCreateInput(),
      sampleSizes: ['M', '9XL'],
    });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain('sampleSizes.1');
  });

  test('refuse une couleur de tissu qui n est pas un uuid', () => {
    // Depuis la bibliotheque Pantone, la couleur du tissu est une REFERENCE, pas
    // un hex libre : un `#1A1A1A` envoye la n a plus aucun sens. Le format est
    // le seul controle que le schema puisse faire, l EXISTENCE de l uuid etant
    // verifiee par les routes produit, qui elles voient la base.
    const result = productCreateSchema.safeParse({
      ...validCreateInput(),
      fabricPantoneId: '#1A1A1A',
    });
    expect(result.success).toBe(false);
    expect(issuePaths(result)).toContain('fabricPantoneId');
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
   * Le PATCH accepte le tableau vide la ou la creation le refuse : c est la
   * souplesse du brouillon que portait le `sample_size` nullable. Le blocage
   * vit dans `techpackBlockers()`, pas dans le contrat d entree.
   */
  test('accepte un tableau de tailles d echantillon vide', () => {
    const result = productPatchSchema.safeParse({ sampleSizes: [] });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ sampleSizes: [] });
  });

  test('normalise l ordre des tailles d echantillon sur un PATCH', () => {
    const result = productPatchSchema.safeParse({ sampleSizes: ['2XL', 'M', 'XS'] });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ sampleSizes: ['XS', 'M', '2XL'] });
  });

  /**
   * Le PATCH ne voit pas `sizeRange` de la ligne existante : l inclusion
   * d ensemble n est donc PAS verifiee ici, mais par `sampleSizesError()` dans
   * la route, apres fusion. Ce test verrouille ce partage de responsabilite.
   */
  test('ne verifie pas l appartenance a la gamme, qui se joue apres fusion', () => {
    expect(productPatchSchema.safeParse({ sampleSizes: ['6XL'] }).success).toBe(true);
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
    // Detacher la couleur du tissu doit la detacher, pas produire un 400 pendant
    // l auto-save alors que le format uuid refuserait la chaine vide.
    const result = productPatchSchema.safeParse({ fabricPantoneId: '  ' });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ fabricPantoneId: null });
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

describe('sampleSizesError', () => {
  test('ne signale rien sur un tableau vide, l etat d un brouillon', () => {
    expect(sampleSizesError(['S', 'M'], [])).toBeNull();
  });

  test('ne signale rien quand toutes les tailles sont dans la gamme', () => {
    expect(sampleSizesError(['S', 'M', 'L'], ['M', 'L'])).toBeNull();
  });

  test('signale la taille fautive et la gamme, au singulier', () => {
    const error = sampleSizesError(['S', 'M', 'L'], ['XL']);
    expect(error).not.toBeNull();
    expect(error).toContain('XL');
    expect(error).toContain('S, M, L');
  });

  /**
   * Le message doit nommer les tailles fautives, et elles seules : sur un PATCH
   * de `sizeRange` qui decocherait une taille encore utilisee, savoir laquelle
   * est la seule information qui permet de corriger.
   */
  test('nomme toutes les tailles fautives sans citer les valides', () => {
    const error = sampleSizesError(['S', 'M'], ['M', 'XL', '3XL']);
    expect(error).not.toBeNull();
    expect(error).toContain('XL');
    expect(error).toContain('3XL');
    // Avant la parenthese : les fautives. Dedans : la gamme, ou M a sa place.
    expect(error?.split('(')[0]).not.toMatch(/\bM\b/);
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

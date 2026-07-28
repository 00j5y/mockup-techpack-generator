/**
 * Helpers purs du domaine produit (`types/product.ts`).
 *
 * `types/product.ts` derive ses types de `lib/db/schema.ts` par `import type`,
 * donc l'import est efface a la compilation : ce fichier n'ouvre aucune
 * connexion et n'atteint jamais `lib/db`, qui importe `server-only`.
 *
 * Quand un objet d'entite est necessaire, il est reconstruit ici en litteral
 * minimal plutot qu'importe depuis `lib/db/queries`.
 */

import { describe, expect, test } from 'bun:test';
import {
  DEFAULT_SIZE_RANGE,
  FLAT_TYPES,
  PRODUCT_CATEGORIES,
  TECHPACK_SIZE_COLUMNS,
  fileUrl,
  oneOf,
  primarySampleSize,
  sortSizes,
} from '@/types/product';

describe('oneOf', () => {
  test('rend la valeur telle quelle quand elle appartient a l union', () => {
    expect(oneOf(FLAT_TYPES, 'flat_back', 'flat_front')).toBe('flat_back');
  });

  test('rend le repli quand la valeur sort de l union', () => {
    // Le cas que le helper existe pour couvrir : une colonne `text` dont la
    // valeur echappe aux CHECK. Sans repli, la recherche dans un objet de
    // libelles rendrait `undefined` et l ecran afficherait un blanc silencieux.
    expect(oneOf(FLAT_TYPES, 'flat_side', 'flat_front')).toBe('flat_front');
  });

  test('rend le repli sur une chaine vide', () => {
    expect(oneOf(PRODUCT_CATEGORIES, '', 'other')).toBe('other');
  });

  test('ne fait aucune correspondance approximative ni insensible a la casse', () => {
    expect(oneOf(PRODUCT_CATEGORIES, 'Shirt', 'other')).toBe('other');
    expect(oneOf(PRODUCT_CATEGORIES, ' shirt', 'other')).toBe('other');
  });

  test('fonctionne sur une valeur reconstruite a l execution', () => {
    // Litteral minimal a la place d une ligne de `lib/db/queries` : le helper
    // consomme une colonne `text`, pas une entite complete.
    const rowFromDatabase = { type: 'inspo_reference' };
    expect(oneOf(FLAT_TYPES, rowFromDatabase.type, 'flat_front')).toBe('inspo_reference');
  });
});

describe('fileUrl', () => {
  test('prefixe le chemin par la route de service des fichiers', () => {
    expect(fileUrl('products/abc/logo.png')).toBe('/api/files/products/abc/logo.png');
  });

  test('conserve les slashs comme separateurs de segments', () => {
    // Encoder le chemin entier transformerait les `/` en `%2F` et la route
    // catch-all `/api/files/[...path]` ne retrouverait plus le fichier.
    expect(fileUrl('a/b/c.png')).not.toContain('%2F');
    expect(fileUrl('a/b/c.png').split('/')).toHaveLength(6);
  });

  test('encode un espace dans un segment', () => {
    expect(fileUrl('products/abc/mon flat.png')).toBe('/api/files/products/abc/mon%20flat.png');
  });

  test('encode un croisillon, qui couperait sinon l URL en fragment', () => {
    expect(fileUrl('products/abc/flat#2.png')).toBe('/api/files/products/abc/flat%232.png');
  });

  test('encode un point d interrogation, qui ouvrirait sinon une chaine de requete', () => {
    expect(fileUrl('products/abc/flat?v.png')).toBe('/api/files/products/abc/flat%3Fv.png');
  });

  test('encode les caracteres non ASCII', () => {
    expect(fileUrl('products/abc/étiquette.png')).toBe(
      '/api/files/products/abc/%C3%A9tiquette.png',
    );
  });

  test('laisse intact un chemin deja sur', () => {
    const safePath = 'products/8f1c/flat_front-01.png';
    expect(fileUrl(safePath)).toBe(`/api/files/${safePath}`);
  });
});

describe('sortSizes', () => {
  test('ordonne selon les colonnes du template, pas alphabetiquement', () => {
    // Un tri alphabetique rendrait ['2XL', 'M', 'S', 'XS'] : c est exactement le
    // bug que ce helper existe pour empecher.
    expect(sortSizes(['2XL', 'M', 'XS', 'S'])).toEqual(['XS', 'S', 'M', '2XL']);
  });

  test('retire les doublons', () => {
    expect(sortSizes(['L', 'M', 'L', 'M'])).toEqual(['M', 'L']);
  });

  test('laisse le tableau vide intact', () => {
    expect(sortSizes([])).toEqual([]);
  });

  test('ne modifie pas le tableau d entree', () => {
    const input = ['L', 'S'];
    sortSizes(input);
    expect(input).toEqual(['L', 'S']);
  });

  test('repousse en fin de liste une taille inconnue plutot que de la perdre', () => {
    // Une donnee anormale doit rester visible : la supprimer en silence ferait
    // disparaitre de l information sans que personne le voie.
    expect(sortSizes(['9XL', 'M'])).toEqual(['M', '9XL']);
  });
});

describe('primarySampleSize', () => {
  /**
   * Le contrat : la taille dont les cotes de la page 2 portent les valeurs.
   * Le header et la page 3 en affichent plusieurs, la page 2 une seule.
   */
  test('rend la premiere taille dans l ordre canonique', () => {
    expect(primarySampleSize({ sampleSizes: ['M', 'L'] })).toBe('M');
  });

  test('ignore l ordre de saisie : deux produits aux memes tailles s accordent', () => {
    expect(primarySampleSize({ sampleSizes: ['L', 'M'] })).toBe(
      primarySampleSize({ sampleSizes: ['M', 'L'] }),
    );
  });

  /**
   * Tri defensif : une ligne ecrite hors des routes API (script, psql) pourrait
   * porter un tableau non normalise. Le contrat doit tenir quand meme.
   */
  test('trie meme un tableau stocke dans le desordre', () => {
    expect(primarySampleSize({ sampleSizes: ['2XL', 'S'] })).toBe('S');
  });

  test('rend null sur un brouillon sans taille d echantillon', () => {
    expect(primarySampleSize({ sampleSizes: [] })).toBeNull();
  });
});

describe('listes de reference du template', () => {
  test('la gamme par defaut est incluse dans les colonnes du template', () => {
    // `DEFAULT_SIZE_RANGE` est la seule source de la gamme initiale : une taille
    // qui n aurait pas de colonne page 3 disparaitrait a la generation.
    for (const size of DEFAULT_SIZE_RANGE) {
      expect(TECHPACK_SIZE_COLUMNS).toContain(size);
    }
  });

  test('le template expose exactement 10 colonnes de tailles, sans doublon', () => {
    expect(TECHPACK_SIZE_COLUMNS).toHaveLength(10);
    expect(new Set(TECHPACK_SIZE_COLUMNS).size).toBe(10);
  });
});

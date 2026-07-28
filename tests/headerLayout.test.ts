/**
 * Invariants de la geometrie du header du techpack.
 *
 * Regle dure numero 2 du CLAUDE.md : la geometrie du header est definie a un
 * seul endroit, `components/techpack/headerLayout.ts`, consommee telle quelle
 * par le rendu print et par le rendu edition.
 *
 * Ce fichier est le premier des deux niveaux de protection de cette regle :
 *   1. ici, la COHERENCE INTERNE de la source unique,
 *   2. dans `headerLayout.singleSource.test.ts`, la detection de geometrie de
 *      header recopiee en dur ailleurs dans `components/`.
 *
 * Principe de redaction : on ne recopie pas les constantes, on verifie les
 * RELATIONS entre elles. Un test qui reecrirait `expect(COLUMNS[1].width).toBe(238)`
 * ne prouverait rien : il faudrait le modifier en meme temps que la valeur, donc
 * il ne protegerait de rien. Les tests ci-dessous cassent des qu'une valeur
 * derivee cesse de l'etre, ou qu'une valeur mesuree devient incoherente avec ses
 * voisines.
 *
 * Reference de mesure : .claude/docs/15-template-seaggs.md, section
 * « Bloc header ».
 */

import { describe, expect, test } from 'bun:test';
import {
  COLUMNS,
  CONTENT,
  HEADER_BAND,
  HEADER_SLOTS,
  HEADER_TEXT_SLOTS,
  LOGO_DIVIDER,
  LOGO_SLOT,
  PAGE,
  ROW_Y,
  SIZE_LIST,
  TP_COLORS,
  TYPO,
  headerSlot,
  sizeListPositions,
  sizeListWidth,
  type HeaderSlotKey,
} from '@/components/techpack/headerLayout';
import { DEFAULT_SIZE_RANGE, TECHPACK_SIZE_COLUMNS } from '@/types/product';

/** Tolerance de comparaison en points. Les largeurs derivees passent par des flottants. */
const PT = 6;

/**
 * x du bord droit mesure de la liste des tailles.
 *
 * Seule valeur du template recopiee volontairement dans ce fichier : c'est le
 * point d'ancrage externe qui permet de verifier la calibration de
 * `LABEL_ADVANCE_PT`. Sans reference exterieure, la calibration se verifierait
 * contre elle-meme.
 */
const MEASURED_SIZE_LIST_X = 359;

describe('headerLayout : coherence des bandes de page', () => {
  test('la zone de contenu est bornee par sa gauche et sa largeur', () => {
    expect(CONTENT.left + CONTENT.width).toBeCloseTo(CONTENT.right, PT);
  });

  test('la zone de contenu tient dans la page', () => {
    expect(CONTENT.left).toBeGreaterThan(0);
    expect(CONTENT.right).toBeLessThan(PAGE.width);
  });

  test('la bande du header couvre exactement la largeur de la zone de contenu', () => {
    expect(HEADER_BAND.x).toBe(CONTENT.left);
    expect(HEADER_BAND.width).toBe(CONTENT.width);
    expect(HEADER_BAND.x + HEADER_BAND.width).toBeCloseTo(CONTENT.right, PT);
  });

  test('la bande du header tient dans la hauteur de page', () => {
    expect(HEADER_BAND.y).toBeGreaterThan(0);
    expect(HEADER_BAND.y + HEADER_BAND.height).toBeLessThan(PAGE.height);
  });
});

describe('headerLayout : coherence du slot logo', () => {
  test('le slot logo et son separateur occupent toute la hauteur de la bande', () => {
    for (const zone of [LOGO_SLOT, LOGO_DIVIDER]) {
      expect(zone.y).toBe(HEADER_BAND.y);
      expect(zone.height).toBe(HEADER_BAND.height);
    }
  });

  test('le slot logo demarre au bord gauche de la bande', () => {
    expect(LOGO_SLOT.x).toBe(HEADER_BAND.x);
  });

  test('le slot logo et son separateur ne se chevauchent pas', () => {
    expect(LOGO_SLOT.x + LOGO_SLOT.width).toBeLessThanOrEqual(LOGO_DIVIDER.x);
  });

  test('le separateur precede la premiere colonne de libelles', () => {
    expect(LOGO_DIVIDER.x + LOGO_DIVIDER.width).toBeLessThanOrEqual(COLUMNS[0].x);
  });
});

describe('headerLayout : coherence des colonnes', () => {
  test('les colonnes sont ordonnees et ne se chevauchent pas', () => {
    for (let index = 1; index < COLUMNS.length; index += 1) {
      const previous = COLUMNS[index - 1];
      const current = COLUMNS[index];
      expect(current.x).toBeGreaterThanOrEqual(previous.x + previous.width);
    }
  });

  /**
   * Les colonnes sont jointives dans le template mesure : la largeur d'une
   * colonne est exactement la distance jusqu'a la suivante. C'est ce qui donne
   * son sens a `valueWidth`, defini comme « ce qui reste avant la colonne
   * suivante ». Changer `COLUMNS[1].width` sans deplacer `COLUMNS[2].x` casse
   * cet invariant, et le seuil de debordement affiche a la saisie ne correspond
   * plus a ce que le PDF imprimera.
   */
  test('chaque colonne se termine exactement la ou commence la suivante', () => {
    for (let index = 1; index < COLUMNS.length; index += 1) {
      const previous = COLUMNS[index - 1];
      expect(previous.x + previous.width).toBeCloseTo(COLUMNS[index].x, PT);
    }
  });

  test('les colonnes restent dans la zone de contenu', () => {
    const first = COLUMNS[0];
    const last = COLUMNS[COLUMNS.length - 1];
    expect(first.x).toBeGreaterThanOrEqual(CONTENT.left);
    expect(last.x + last.width).toBeCloseTo(CONTENT.right, PT);
  });

  test('aucune colonne n est de largeur nulle ou negative', () => {
    for (const column of COLUMNS) {
      expect(column.width).toBeGreaterThan(0);
    }
  });
});

describe('headerLayout : coherence des lignes', () => {
  test('les lignes sont espacees de l interligne declare', () => {
    for (let index = 1; index < ROW_Y.length; index += 1) {
      expect(ROW_Y[index] - ROW_Y[index - 1]).toBeCloseTo(TYPO.lineHeight, PT);
    }
  });

  test('chaque ligne de texte tient dans la bande du header', () => {
    const bandBottom = HEADER_BAND.y + HEADER_BAND.height;
    for (const y of ROW_Y) {
      expect(y).toBeGreaterThanOrEqual(HEADER_BAND.y);
      expect(y + TYPO.fontSize).toBeLessThanOrEqual(bandBottom);
    }
  });
});

describe('headerLayout : coherence des emplacements', () => {
  test('chaque emplacement lit bien la colonne et la ligne qu il declare', () => {
    for (const slot of HEADER_SLOTS) {
      expect(slot.x).toBe(COLUMNS[slot.column].x);
      expect(slot.y).toBe(ROW_Y[slot.row]);
    }
  });

  /**
   * L invariant central : `valueWidth` est bien « la place restante jusqu au
   * bord droit de la colonne », donc derive de la largeur de colonne et non
   * saisi a la main. C est ce qui fait qu une modification de
   * `COLUMNS[n].width` redimensionne les champs de saisie sans autre edition.
   */
  test('la valeur de chaque emplacement se termine sur le bord droit de sa colonne', () => {
    for (const slot of HEADER_SLOTS) {
      const column = COLUMNS[slot.column];
      expect(slot.valueX + slot.valueWidth).toBeCloseTo(column.x + column.width, PT);
    }
  });

  test('chaque emplacement laisse une place exploitable a sa valeur', () => {
    for (const slot of HEADER_SLOTS) {
      expect(slot.valueWidth).toBeGreaterThan(0);
    }
  });

  test('la valeur ne demarre jamais avant la fin de son libelle', () => {
    for (const slot of HEADER_SLOTS) {
      expect(slot.valueX).toBeGreaterThanOrEqual(slot.x + slot.labelWidth);
    }
  });

  test('la largeur de libelle est proportionnelle au nombre de caracteres', () => {
    // Une seule avance moyenne par caractere pour tous les libelles : si l un
    // d eux etait ajuste a la main, le rapport largeur / longueur decrocherait.
    const ratios = HEADER_SLOTS.map((slot) => slot.labelWidth / slot.label.length);
    for (const ratio of ratios) {
      expect(ratio).toBeCloseTo(ratios[0], 1);
    }
  });

  test('deux emplacements n occupent jamais la meme cellule de la grille', () => {
    const cells = HEADER_SLOTS.map((slot) => `${slot.column}:${slot.row}`);
    expect(new Set(cells).size).toBe(cells.length);
  });

  test('les cles des emplacements sont uniques', () => {
    const keys = HEADER_SLOTS.map((slot) => slot.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  test('HEADER_TEXT_SLOTS est exactement l ensemble des emplacements de texte libre', () => {
    const freeText: string[] = HEADER_SLOTS.filter((slot) => slot.isFreeText).map(
      (slot) => slot.key,
    );
    const declared: string[] = HEADER_TEXT_SLOTS.map((slot) => slot.key);
    expect(declared.sort()).toEqual(freeText.sort());
    for (const slot of HEADER_TEXT_SLOTS) {
      expect(slot.isFreeText).toBe(true);
    }
  });

  test('date et sizeRange ne sont pas des emplacements de texte libre', () => {
    // Ils ont un rendu dedie : `date` derive de `created_at`, `sizeRange` est
    // une liste cliquable. Les basculer en texte libre ferait chercher
    // `product.date`, qui n existe pas.
    expect(headerSlot('date').isFreeText).toBe(false);
    expect(headerSlot('sizeRange').isFreeText).toBe(false);
  });
});

describe('headerLayout : liste des tailles', () => {
  test('la premiere taille tombe sur le x mesure du template', () => {
    const positions = sizeListPositions(['XS', 'S', 'M']);
    expect(positions[0].x).toBe(MEASURED_SIZE_LIST_X);
    expect(positions[0].x).toBe(headerSlot('sizeRange').valueX);
  });

  /**
   * `LABEL_ADVANCE_PT` est calibree sur ce point de mesure : le libelle
   * `SIZE RANGE:` doit finir pile la ou la liste demarre. Si l avance moyenne
   * derive, la calibration ne retombe plus sur 359 et tous les autres libelles
   * du header sont faux dans la meme proportion.
   */
  test('la calibration de l avance de libelle retombe sur le x mesure', () => {
    const slot = headerSlot('sizeRange');
    expect(slot.x + slot.labelWidth).toBeCloseTo(MEASURED_SIZE_LIST_X, PT);
  });

  test('les tailles sont espacees du pas declare', () => {
    const positions = sizeListPositions(['XS', 'S', 'M', 'L']);
    for (let index = 1; index < positions.length; index += 1) {
      expect(positions[index].x - positions[index - 1].x).toBeCloseTo(SIZE_LIST.step, PT);
    }
  });

  test('sizeListPositions conserve l ordre et le libelle des tailles', () => {
    expect(sizeListPositions(['M', 'XS']).map((entry) => entry.size)).toEqual(['M', 'XS']);
  });

  test('la gamme par defaut tient dans la colonne de SIZE RANGE', () => {
    expect(sizeListWidth(DEFAULT_SIZE_RANGE)).toBeLessThanOrEqual(
      headerSlot('sizeRange').valueWidth,
    );
  });

  test('la gamme complete du template deborde, et c est signale et non tronque', () => {
    // Les 10 colonnes du template ne tiennent pas dans le header : c est le cas
    // que `TechpackHeaderEditor` doit avertir. Le test verrouille le fait que le
    // debordement existe, donc que l avertissement a une raison d etre.
    expect(sizeListWidth(TECHPACK_SIZE_COLUMNS)).toBeGreaterThan(
      headerSlot('sizeRange').valueWidth,
    );
  });
});

describe('headerLayout : helpers', () => {
  test('headerSlot retourne l emplacement demande', () => {
    expect(headerSlot('company').key).toBe('company');
    expect(headerSlot('company').label).toBe('COMPANY:');
  });

  test('headerSlot leve sur une cle inconnue', () => {
    // Cast volontaire : on simule une cle qui aurait echappe au typage, par
    // exemple une valeur venant d une chaine construite a l execution.
    const unknownKey = 'colorway' as HeaderSlotKey;
    expect(() => headerSlot(unknownKey)).toThrow(/inconnu/i);
  });

  test('sizeListWidth vaut 0 sur une gamme vide', () => {
    expect(sizeListWidth([])).toBe(0);
  });

  test('sizeListWidth vaut la largeur d un element sur une gamme d une taille', () => {
    expect(sizeListWidth(['M'])).toBe(SIZE_LIST.itemWidth);
  });

  test('sizeListWidth croit du pas a chaque taille supplementaire', () => {
    expect(sizeListWidth(['XS', 'S']) - sizeListWidth(['XS'])).toBeCloseTo(SIZE_LIST.step, PT);
  });

  test('sizeListPositions rend une liste vide sur une gamme vide', () => {
    expect(sizeListPositions([])).toEqual([]);
  });
});

describe('headerLayout : typographie du header', () => {
  /**
   * Demande de Jay : les valeurs saisies du header sont composees comme les
   * libelles, en Myriad Pro Bold. Les deux graisses restent nommees separement
   * mais ne doivent pas pouvoir diverger : une valeur en 400 se distinguerait a
   * l oeil de son libelle, et surtout serait plus etroite que ce que le PDF
   * imprime, donc l avertissement de debordement sonnerait trop tard.
   */
  test('les valeurs saisies ont la meme graisse que les libelles', () => {
    expect(TYPO.valueWeight).toBe(TYPO.labelWeight);
  });

  /**
   * `measureTextPt` passe cette graisse telle quelle a `ctx.font`. Une graisse
   * que `next/font` ne charge pas serait synthetisee par le navigateur, avec des
   * metriques differentes de celles du PDF : la mesure de debordement porterait
   * alors sur une fonte qui n existe nulle part ailleurs.
   */
  test('la graisse du header fait partie de celles reellement chargees', () => {
    // Poids declares dans `app/layout.tsx` pour Source Sans 3.
    expect([400, 600, 700]).toContain(TYPO.valueWeight);
  });
});

describe('headerLayout : couleurs du techpack', () => {
  test('toutes les couleurs sont des hexadecimaux a 6 chiffres', () => {
    for (const value of Object.values(TP_COLORS)) {
      expect(value).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  test('le rouge du techpack est le rouge pur impose par la regle 10', () => {
    expect(TP_COLORS.red.toUpperCase()).toBe('#FF0000');
  });

  /**
   * Dans le header, valeurs et libelles doivent etre indiscernables : meme
   * graisse (teste plus haut) et meme encre. Le token reste distinct de `frame`
   * pour pouvoir basculer les valeurs en `#000000` sans deteindre sur les
   * cadres, separateurs et bordures de tableau du template.
   */
  test('l encre des valeurs du header est celle des libelles', () => {
    expect(TP_COLORS.value.toUpperCase()).toBe(TP_COLORS.frame.toUpperCase());
  });

  test('l encre des valeurs du header n est pas le rouge', () => {
    // Seul rouge restant dans le header : l encadre des tailles d echantillon.
    expect(TP_COLORS.value.toUpperCase()).not.toBe(TP_COLORS.red.toUpperCase());
  });
});

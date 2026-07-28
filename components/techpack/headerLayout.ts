/**
 * Geometrie du bloc header du techpack : LA source unique.
 *
 * Ce bloc apparait sur les 12 pages. Il a deux rendus :
 *   - `TechpackHeader.tsx`       : rendu print, pur, sans interactivite (Puppeteer)
 *   - `TechpackHeaderEditor.tsx` : rendu edition, client, champs et zone de drop
 *
 * Les deux lisent ce fichier. Une coordonnee de header ecrite ailleurs est un
 * bug d'architecture (regle dure numero 2 du CLAUDE.md).
 *
 * Test de non-regression du principe : changer `COLUMNS[1].width` ci-dessous
 * doit deplacer le texte print ET redimensionner le champ de saisie, sans
 * toucher a un autre fichier.
 *
 * Unite : le point PostScript (1pt = 1/72 in), origine en haut a gauche de la
 * page. Voir .claude/docs/15-template-seaggs.md.
 *
 * MESURE sur le template : `PAGE`, `CONTENT`, `HEADER_BAND`, `LOGO_SLOT`,
 * `LOGO_DIVIDER`, `COLUMNS`, `ROW_Y`, et le `x = 359` de la liste des tailles.
 *
 * ESTIME, a recalibrer en Phase 4 contre `exemple-p-01.jpg` : `TYPO.fontSize`,
 * `LABEL_ADVANCE_PT` (donc toutes les largeurs de libelle), `SIZE_LIST.step`,
 * `SIZE_LIST.box` et `FIELD_INSET`. Ne pas les traiter comme des mesures.
 */

// ---------------------------------------------------------------------------
// Page et bandes
// ---------------------------------------------------------------------------

/** Paysage custom. Ni A4 ni Letter. */
export const PAGE = { width: 761.4, height: 581.4 } as const;

/** Zone utile entre les cadres lateraux (x 0-4 et x 756-760). */
export const CONTENT = { left: 5, right: 755, width: 750 } as const;

/** Bande grise du header, y 31 a 100. */
export const HEADER_BAND = {
  x: CONTENT.left,
  y: 31,
  width: CONTENT.width,
  height: 70,
} as const;

/**
 * Slot logo, a gauche du header. Fond `--tp-bar` : un logo sans canal alpha
 * y produit un rectangle blanc visible sur les 12 pages.
 */
export const LOGO_SLOT = { x: 5, y: 31, width: 72, height: 70 } as const;

/** Trait vertical qui separe le logo des colonnes de libelles. */
export const LOGO_DIVIDER = { x: 77, y: 31, width: 4, height: 70 } as const;

// ---------------------------------------------------------------------------
// Colonnes et lignes
// ---------------------------------------------------------------------------

/**
 * Les 3 colonnes de libelles. Leur largeur est la contrainte reelle de saisie :
 * une valeur plus large deborde sur la colonne suivante dans le PDF.
 */
export const COLUMNS = [
  { x: 86, width: 204 }, // 86 -> 290
  { x: 290, width: 238 }, // 290 -> 528
  { x: 528, width: 227 }, // 528 -> 755
] as const;

/** yMin du texte de chaque ligne. Interligne ~24pt. */
export const ROW_Y = [34, 58, 82] as const;

export const TYPO = {
  /** Corps des libelles et des valeurs du header. */
  fontSize: 10,
  lineHeight: 24,
  labelWeight: 700,
  valueWeight: 400,
  /** Espace entre la fin du libelle et le debut de la valeur. */
  labelGap: 3,
} as const;

/**
 * Ajustements de la surface de saisie par rapport a la position du texte imprime.
 *
 * Un `<input>` n'a pas la meme boite qu'un `<span>` : sans ces valeurs le texte
 * saisi ne tombe pas ou tombera le texte du PDF. Elles vivent ici et non dans
 * `TechpackHeaderEditor.tsx` parce que ce sont des coordonnees de header, et
 * qu'une coordonnee de header ne se recopie pas dans un renderer (regle 2).
 *
 * `paddingX` est a 0 : tout decalage horizontal desalignerait la saisie du
 * rendu print, donc fausserait le seuil de debordement percu.
 */
export const FIELD_INSET = {
  offsetY: -2,
  extraHeight: 4,
  paddingX: 0,
} as const;

/**
 * Largeur moyenne d'un caractere du libelle, en pt, a 10pt bold.
 *
 * Calibree sur le seul point de mesure disponible dans le template : la liste
 * des tailles de `SIZE RANGE:` demarre a x = 359, soit 69pt apres le x de la
 * colonne 2. `"SIZE RANGE:"` fait 11 caracteres, donc 69 / 11 = 6.27.
 *
 * A revalider en Phase 4 contre `exemple-p-01.jpg`, avec la vraie metrique de
 * Source Sans 3 : c'est une moyenne, pas une mesure par glyphe.
 */
const LABEL_ADVANCE_PT = 69 / 11;

function labelWidthFor(label: string): number {
  return Math.round(label.length * LABEL_ADVANCE_PT * 100) / 100;
}

// ---------------------------------------------------------------------------
// Champs
// ---------------------------------------------------------------------------

/** Champs du header qui portent une valeur produit librement saisissable. */
export type HeaderTextKey =
  | 'company'
  | 'designer'
  | 'mainFabric'
  | 'styleNumber'
  | 'description'
  | 'styleName';

/** Tous les emplacements du header, y compris ceux au rendu particulier. */
export type HeaderSlotKey = HeaderTextKey | 'date' | 'sizeRange';

export interface HeaderSlot {
  key: HeaderSlotKey;
  label: string;
  /** Index dans `COLUMNS`. */
  column: 0 | 1 | 2;
  /** Index dans `ROW_Y`. */
  row: 0 | 1 | 2;
  /** x du libelle, donc x de la colonne. */
  x: number;
  /** yMin du texte. */
  y: number;
  labelWidth: number;
  /** x ou commence la valeur. */
  valueX: number;
  /** Largeur disponible pour la valeur avant debordement sur la colonne suivante. */
  valueWidth: number;
  /** Faux pour `date` (derivee) et `sizeRange` (rendu dedie). */
  isFreeText: boolean;
}

function slot(
  key: HeaderSlotKey,
  label: string,
  column: 0 | 1 | 2,
  row: 0 | 1 | 2,
  isFreeText: boolean,
  /** Override pour `SIZE RANGE:`, dont le x de valeur est mesure et non calcule. */
  measuredValueX?: number,
): HeaderSlot {
  const col = COLUMNS[column];
  const labelWidth = labelWidthFor(label);
  const valueX = measuredValueX ?? col.x + labelWidth + TYPO.labelGap;
  return {
    key,
    label,
    column,
    row,
    x: col.x,
    y: ROW_Y[row],
    labelWidth,
    valueX,
    valueWidth: col.x + col.width - valueX,
    isFreeText,
  };
}

export const HEADER_SLOTS: readonly HeaderSlot[] = [
  slot('company', 'COMPANY:', 0, 0, true),
  slot('designer', 'DESIGNER:', 0, 1, true),
  slot('date', 'DATE:', 0, 2, false),
  slot('mainFabric', 'MAIN FABRIC:', 1, 0, true),
  slot('styleNumber', 'STYLE NUMBER:', 1, 1, true),
  // x = 359 est mesure sur le template, pas deduit de la longueur du libelle.
  slot('sizeRange', 'SIZE RANGE:', 1, 2, false, 359),
  slot('description', 'DESCRIPTION:', 2, 0, true),
  slot('styleName', 'STYLE NAME:', 2, 1, true),
];

export function headerSlot(key: HeaderSlotKey): HeaderSlot {
  const found = HEADER_SLOTS.find((s) => s.key === key);
  if (!found) throw new Error(`Emplacement de header inconnu : ${key}`);
  return found;
}

export interface HeaderTextSlot extends HeaderSlot {
  key: HeaderTextKey;
  isFreeText: true;
}

/**
 * Emplacements portant une valeur produit librement saisissable.
 *
 * Construits depuis une liste de cles typees, pas par un `filter` sur
 * `isFreeText` : un predicat `s is ... { key: HeaderTextKey }` base sur un
 * booleen est un cast deguise. Le jour ou `isFreeText` passerait a `true` sur
 * `date`, le code compilerait et planterait a l'execution en lisant
 * `product['date']`, qui n'existe pas.
 */
const TEXT_KEYS = [
  'company',
  'designer',
  'mainFabric',
  'styleNumber',
  'description',
  'styleName',
] as const satisfies readonly HeaderTextKey[];

export const HEADER_TEXT_SLOTS: readonly HeaderTextSlot[] = TEXT_KEYS.map((key) => {
  const found = headerSlot(key);
  if (!found.isFreeText) {
    throw new Error(`Incoherence de header : ${key} est liste en texte libre mais ne l'est pas`);
  }
  return { ...found, key, isFreeText: true };
});

// ---------------------------------------------------------------------------
// Liste des tailles
// ---------------------------------------------------------------------------

/**
 * Reglages du rendu de la ligne `SIZE RANGE:`.
 *
 * Le template imprime une liste statique `XS S M L XL 2XL ______`. On rend a la
 * place le `size_range` reel du produit : hardcoder la liste casserait
 * silencieusement un produit dont la gamme differe (voir 12-pieges.md).
 * La taille de reference (`sample_size`) est encadree de rouge.
 */
export const SIZE_LIST = {
  /** Pas horizontal entre deux tailles. Estime. */
  step: 26,
  /** Largeur du libelle de taille le plus large (`2XL`). Estimee. */
  itemWidth: 18,
  /** Encadre rouge de la taille de reference. Estime. */
  box: { paddingX: 3, paddingY: 2, borderWidth: 1 },
} as const;

export function sizeListPositions(sizes: readonly string[]): { size: string; x: number }[] {
  const start = headerSlot('sizeRange').valueX;
  return sizes.map((size, index) => ({ size, x: start + index * SIZE_LIST.step }));
}

/**
 * Largeur totale occupee par la liste des tailles. Sert a avertir quand une
 * gamme trop large deborderait de la colonne 2.
 */
export function sizeListWidth(sizes: readonly string[]): number {
  if (sizes.length === 0) return 0;
  return (sizes.length - 1) * SIZE_LIST.step + SIZE_LIST.itemWidth;
}

// ---------------------------------------------------------------------------
// Couleurs
// ---------------------------------------------------------------------------

/**
 * Repris des tokens CSS de `globals.css`. En dur ici parce que le rendu print
 * est traverse par Puppeteer : une `var()` non resolue donnerait du noir.
 */
export const TP_COLORS = {
  frame: '#231F20',
  bar: '#CCCCCC',
  red: '#FF0000',
  white: '#FFFFFF',
} as const;

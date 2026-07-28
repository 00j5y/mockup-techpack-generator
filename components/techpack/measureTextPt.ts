/**
 * Mesure de largeur de texte, en points, avec la police reelle du techpack.
 *
 * Sert a signaler un debordement de colonne du header A LA FRAPPE plutot qu'a
 * la generation du PDF. Les colonnes du header ont des largeurs fixes : une
 * valeur trop longue passe par-dessus la colonne suivante.
 * Voir .claude/docs/04-module-produit.md.
 *
 * Navigateur uniquement (utilise un canvas 2D). Retourne 0 cote serveur, ce qui
 * n'affiche aucun avertissement avant hydratation : c'est le comportement
 * voulu, un faux positif au premier rendu serait pire.
 */

import { TYPO } from './headerLayout';

/** 1pt = 1/72 in, le canvas mesure en px CSS a 96 dpi. */
const PX_PER_PT = 96 / 72;

let context: CanvasRenderingContext2D | null = null;

function getContext(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  if (context) return context;
  context = document.createElement('canvas').getContext('2d');
  return context;
}

/**
 * Largeur du texte en points, rendu avec la police du header.
 *
 * La famille est lue sur `--font-techpack`, la variable posee par `next/font`
 * dans le layout : mesurer avec une autre police donnerait un seuil de
 * debordement faux.
 *
 * Lecture sur `document.body` et non sur `document.documentElement` : la classe
 * `sourceSans.variable` est posee sur le `<body>` (voir `app/layout.tsx`), et
 * une custom property n'est heritee que vers le bas. Lue sur `<html>` elle est
 * vide, le repli `sans-serif` s'applique, et tout le seuil de debordement se
 * calcule alors sur une police plus large que Source Sans 3.
 */
export function measureTextPt(text: string, weight: number = TYPO.valueWeight): number {
  const ctx = getContext();
  if (!ctx || text === '') return 0;

  const family =
    getComputedStyle(document.body).getPropertyValue('--font-techpack').trim() || 'sans-serif';

  ctx.font = `${weight} ${TYPO.fontSize * PX_PER_PT}px ${family}, sans-serif`;
  return ctx.measureText(text).width / PX_PER_PT;
}

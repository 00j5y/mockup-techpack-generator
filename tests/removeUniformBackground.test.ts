/**
 * Detourage du fond uni d'un logo.
 *
 * Seul le coeur PUR de l'algorithme est teste ici : `bun test` tourne sans DOM,
 * donc sans canvas et sans `createImageBitmap`. C'est la raison d'etre de la
 * separation entre `removeUniformBackgroundFromPixels`, qui ne connait qu'une
 * matrice RGBA, et `removeUniformBackground`, qui decode un `File`.
 *
 * Le cas qui justifie tout le module est le troisieme : un logo dont l'interieur
 * est de la meme couleur que le fond. Une suppression globale de la couleur le
 * trouerait, la diffusion depuis les bords le preserve.
 */

import { describe, expect, test } from 'bun:test';
import {
  DEFAULT_REMOVAL_OPTIONS,
  removeUniformBackgroundFromPixels,
  rgbToHex,
  type RgbColor,
} from '@/components/techpack/removeUniformBackground';

const WHITE: RgbColor = { r: 255, g: 255, b: 255 };
const BLACK: RgbColor = { r: 0, g: 0, b: 0 };

/** Cree une image RGBA opaque remplie d'une couleur. */
function createImage(width: number, height: number, fill: RgbColor): Uint8ClampedArray {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    setPixel(pixels, width, index % width, Math.floor(index / width), fill);
  }
  return pixels;
}

function setPixel(
  pixels: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
  color: RgbColor,
  alpha = 255,
): void {
  const offset = (y * width + x) * 4;
  pixels[offset] = color.r;
  pixels[offset + 1] = color.g;
  pixels[offset + 2] = color.b;
  pixels[offset + 3] = alpha;
}

/** Remplit un rectangle, bornes incluses. */
function fillRect(
  pixels: Uint8ClampedArray,
  width: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  color: RgbColor,
): void {
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) setPixel(pixels, width, x, y, color);
  }
}

function alphaAt(pixels: Uint8ClampedArray, width: number, x: number, y: number): number {
  return pixels[(y * width + x) * 4 + 3];
}

describe('removeUniformBackgroundFromPixels : fond uni', () => {
  test('retire le fond uni connecte au bord et laisse le trace opaque', () => {
    const width = 12;
    const height = 12;
    const pixels = createImage(width, height, WHITE);
    fillRect(pixels, width, 4, 4, 7, 7, BLACK);

    const result = removeUniformBackgroundFromPixels(pixels, width, height);

    expect(result.outcome).toBe('removed');
    expect(result.backgroundColor).toEqual(WHITE);

    // Les quatre coins sont du fond, le carre central est le logo.
    expect(alphaAt(pixels, width, 0, 0)).toBe(0);
    expect(alphaAt(pixels, width, width - 1, height - 1)).toBe(0);
    expect(alphaAt(pixels, width, 5, 5)).toBe(255);

    // 16 pixels de logo sur 144 : tout le reste doit etre transparent.
    expect(result.transparentRatio).toBeCloseTo((144 - 16) / 144, 6);
  });

  test('la couleur de fond detectee est rendue lisible en hexa', () => {
    expect(rgbToHex(WHITE)).toBe('#FFFFFF');
    expect(rgbToHex({ r: 18, g: 52, b: 86 })).toBe('#123456');
  });

  test('preserve un blanc enferme a l interieur du trace', () => {
    // Anneau noir sur fond blanc, centre blanc : la contre-forme d'un `O`.
    const width = 11;
    const height = 11;
    const pixels = createImage(width, height, WHITE);
    fillRect(pixels, width, 2, 2, 8, 8, BLACK);
    fillRect(pixels, width, 4, 4, 6, 6, WHITE);

    const result = removeUniformBackgroundFromPixels(pixels, width, height);

    expect(result.outcome).toBe('removed');
    // Le centre est de la couleur du fond mais n'est pas atteignable depuis le
    // bord : il reste opaque. C'est tout l'interet de la diffusion.
    for (let y = 4; y <= 6; y += 1) {
      for (let x = 4; x <= 6; x += 1) {
        expect(alphaAt(pixels, width, x, y)).toBe(255);
      }
    }
    expect(alphaAt(pixels, width, 0, 0)).toBe(0);
    expect(alphaAt(pixels, width, 3, 3)).toBe(255);
  });

  test('absorbe le bruit de compression d un aplat', () => {
    const width = 10;
    const height = 10;
    const pixels = createImage(width, height, WHITE);
    // Fond « blanc » d'un JPEG : quelques niveaux de respiration par canal.
    let seed = 0;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        const jitter = 249 + (seed % 7);
        setPixel(pixels, width, x, y, { r: jitter, g: jitter, b: jitter });
      }
    }
    fillRect(pixels, width, 4, 4, 5, 5, BLACK);

    const result = removeUniformBackgroundFromPixels(pixels, width, height);

    expect(result.outcome).toBe('removed');
    expect(alphaAt(pixels, width, 0, 0)).toBe(0);
    expect(alphaAt(pixels, width, 9, 0)).toBe(0);
    expect(alphaAt(pixels, width, 4, 4)).toBe(255);
    expect(result.transparentRatio).toBeCloseTo((100 - 4) / 100, 6);
  });

  test('adoucit les pixels d anticrenelage au lieu de laisser un lisere', () => {
    const width = 9;
    const height = 9;
    const pixels = createImage(width, height, WHITE);
    fillRect(pixels, width, 4, 4, 5, 5, BLACK);
    // Un pixel de bord a mi-chemin entre le fond et le trait, tel qu'en produit
    // un export anticrenele. Son ecart au blanc tombe dans la zone de
    // transition : ni fond, ni trait.
    setPixel(pixels, width, 3, 4, { r: 226, g: 226, b: 226 });

    expect(alphaAt(pixels, width, 3, 4)).toBe(255);

    const result = removeUniformBackgroundFromPixels(pixels, width, height);

    expect(result.outcome).toBe('removed');
    expect(result.softenedPixels).toBeGreaterThan(0);
    const transition = alphaAt(pixels, width, 3, 4);
    expect(transition).toBeGreaterThan(0);
    expect(transition).toBeLessThan(255);
  });
});

describe('removeUniformBackgroundFromPixels : cas ou il ne faut rien faire', () => {
  test('laisse intacte une image dont le contour n est pas uni', () => {
    const width = 10;
    const height = 10;
    const pixels = createImage(width, height, WHITE);
    // Moitie basse noire : le graphisme touche le bord, le fond fait partie du
    // visuel.
    fillRect(pixels, width, 0, 5, 9, 9, BLACK);
    const before = Uint8ClampedArray.from(pixels);

    const result = removeUniformBackgroundFromPixels(pixels, width, height);

    expect(result.outcome).toBe('no-uniform-background');
    expect(result.backgroundColor).toBeNull();
    expect(pixels).toEqual(before);
  });

  test('laisse intacte une image qui porte deja de la transparence', () => {
    const width = 8;
    const height = 8;
    const pixels = createImage(width, height, WHITE);
    fillRect(pixels, width, 3, 3, 4, 4, BLACK);
    setPixel(pixels, width, 0, 0, WHITE, 0);
    const before = Uint8ClampedArray.from(pixels);

    const result = removeUniformBackgroundFromPixels(pixels, width, height);

    expect(result.outcome).toBe('already-transparent');
    expect(pixels).toEqual(before);
  });

  test('refuse de vider une image entierement unie', () => {
    const width = 8;
    const height = 8;
    const pixels = createImage(width, height, WHITE);
    const before = Uint8ClampedArray.from(pixels);

    const result = removeUniformBackgroundFromPixels(pixels, width, height);

    expect(result.outcome).toBe('background-covers-image');
    expect(result.transparentRatio).toBe(1);
    expect(pixels).toEqual(before);
  });
});

describe('removeUniformBackgroundFromPixels : seuils', () => {
  test('un contour tout juste sous le seuil de dominance est refuse', () => {
    // 40 pixels de contour sur une image 11x11. On en repeint assez pour passer
    // sous 85 %, sans toucher au reste de l'image.
    const width = 11;
    const height = 11;
    const pixels = createImage(width, height, WHITE);
    fillRect(pixels, width, 0, 0, 6, 0, BLACK);

    const result = removeUniformBackgroundFromPixels(pixels, width, height);

    expect(DEFAULT_REMOVAL_OPTIONS.borderDominance).toBe(0.85);
    expect(result.outcome).toBe('no-uniform-background');
  });

  test('les seuils sont reglables sans toucher a l algorithme', () => {
    const width = 10;
    const height = 10;
    const pixels = createImage(width, height, WHITE);
    // Fond gris tres clair : hors tolerance par defaut d'un blanc pur, mais le
    // fond detecte est le gris lui-meme, donc le detourage passe quand meme.
    // On verifie ici qu'une tolerance ecrasee empeche la diffusion de sortir du
    // contour, sans changer la detection.
    fillRect(pixels, width, 3, 3, 6, 6, { r: 250, g: 250, b: 250 });

    const strict = removeUniformBackgroundFromPixels(pixels, width, height, {
      ...DEFAULT_REMOVAL_OPTIONS,
      coreTolerance: 1,
      edgeTolerance: 2,
    });

    expect(strict.outcome).toBe('removed');
    // Le carre a 250 est hors tolerance stricte : il reste opaque.
    expect(alphaAt(pixels, width, 4, 4)).toBe(255);
    expect(alphaAt(pixels, width, 0, 0)).toBe(0);
  });
});

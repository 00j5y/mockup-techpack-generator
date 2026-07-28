/**
 * Detourage du fond uni d'un logo depose.
 *
 * Le slot logo a pour fond le gris `TP_COLORS.bar` de la bande de header, et il
 * apparait sur les 12 pages du techpack. Un logo livre sur fond blanc opaque y
 * produit donc un rectangle franc, repete 12 fois, qu'on ne remarque en general
 * qu'une fois le PDF parti chez le fournisseur. `hasAlphaChannel` se contentait
 * d'avertir : ce module corrige.
 *
 * DEUX NIVEAUX
 *   1. `removeUniformBackgroundFromPixels` : le coeur de l'algorithme, PUR,
 *      sans DOM, teste dans `tests/removeUniformBackground.test.ts`.
 *   2. `removeUniformBackground` : l'enveloppe qui decode un `File` via un
 *      canvas 2D et reencode en PNG. Navigateur uniquement.
 *
 * POURQUOI UN REMPLISSAGE PAR DIFFUSION, ET PAS UN « SUPPRIMER TOUS LES PIXELS
 * BLANCS »
 *   Un logo contenant du blanc a l'interieur (contre-forme d'un `O`, texte
 *   blanc dans un bloc) serait troue par une suppression globale de la couleur.
 *   Le resultat serait pire que le rectangle qu'on voulait enlever. On part donc
 *   des pixels du contour et on diffuse en 4-connexite : un blanc enferme dans
 *   le trace n'est jamais atteint, donc jamais efface.
 */

/** Couleur RGB, canaux 0-255. */
export interface RgbColor {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/**
 * Ce qui a ete fait du fichier depose.
 *
 * - `removed` : un fond uni a ete detoure, le PNG resultant remplace l'original.
 * - `already-transparent` : l'image porte deja des pixels alpha. On n'y touche
 *   pas : il n'y a pas de fond a retirer, et retoucher risquerait d'abimer un
 *   fichier deja correct.
 * - `no-uniform-background` : le contour n'est pas majoritairement d'une seule
 *   couleur. Le fond fait probablement partie du visuel.
 * - `background-covers-image` : le detourage aurait vide quasiment toute
 *   l'image. Symptome d'une image quasi unie, on n'applique rien.
 * - `vector-image` : SVG, pas de matrice de pixels a traiter sans rendu.
 * - `decode-failed` : lecture impossible (hors navigateur, format refuse par le
 *   decodeur, canvas trop grand pour le moteur).
 */
export type BackgroundOutcome =
  | 'removed'
  | 'already-transparent'
  | 'no-uniform-background'
  | 'background-covers-image'
  | 'vector-image'
  | 'decode-failed';

/** Les seuils de l'algorithme, exposes pour les tests et pour un futur reglage. */
export interface RemovalOptions {
  /**
   * Distance euclidienne RGB en dessous de laquelle un pixel EST le fond.
   *
   * 24 sur une echelle qui va jusqu'a 441 (noir contre blanc), soit environ 14
   * niveaux d'ecart sur chacun des trois canaux. Un JPEG de qualite courante
   * fait respirer un aplat de quelques niveaux, et les artefacts de bloc au
   * voisinage d'un trait contraste montent a une dizaine. 24 les absorbe sans
   * mordre sur un gris clair volontaire du logo, qui se distingue d'un fond
   * blanc d'au moins 20 niveaux pour rester visible a l'impression.
   */
  readonly coreTolerance: number;
  /**
   * Distance au dela de laquelle un pixel est du logo, sans discussion.
   *
   * Entre `coreTolerance` et `edgeTolerance` se trouve la zone de transition de
   * l'anticrenelage, traitee en alpha progressive. 96 correspond a un melange
   * d'environ 20 % de trait pour 80 % de fond quand le trait est tres contraste,
   * ce qui couvre le lisere vraiment problematique sans toucher aux pixels qui
   * portent l'essentiel de la forme.
   */
  readonly edgeTolerance: number;
  /**
   * Nombre de pixels de transition que la diffusion peut traverser d'affilee.
   *
   * L'anticrenelage d'un export Illustrator fait un pixel, deux apres un
   * reechantillonnage. Au dela, une bande douce n'est plus un bord : c'est un
   * degrade, et le laisser diffuser ferait fuir le detourage dans le logo.
   */
  readonly transitionDepth: number;
  /**
   * Part minimale du contour qui doit etre de la couleur dominante pour qu'on
   * parle d'un fond uni.
   *
   * 0,85. Un logo pose au centre d'un aplat a un contour uni a plus de 95 %. Un
   * visuel dont le graphisme atteint les bords tombe bien en dessous. La marge
   * laisse passer un element qui mord sur un bord (signature, filet), et le
   * seuil est volontairement haut : effacer un fond voulu est un degat bien plus
   * couteux que de laisser un rectangle blanc, contre lequel l'avertissement
   * existant continue de proteger.
   */
  readonly borderDominance: number;
  /**
   * Part de l'image au dela de laquelle on considere qu'il ne resterait rien.
   *
   * Garde-fou contre l'image quasi unie, ou le « logo » disparaitrait
   * entierement sans que rien ne le signale.
   */
  readonly maxBackgroundRatio: number;
}

export const DEFAULT_REMOVAL_OPTIONS: RemovalOptions = {
  coreTolerance: 24,
  edgeTolerance: 96,
  transitionDepth: 2,
  borderDominance: 0.85,
  maxBackgroundRatio: 0.995,
};

/**
 * En dessous de cette alpha, on ne tente pas de retrouver la couleur d'origine
 * du pixel de transition : la division amplifierait le bruit par plus de huit.
 */
const UNMIX_MIN_ALPHA = 32;

/** Resultat du coeur pur de l'algorithme. */
export interface PixelRemovalReport {
  readonly outcome: Extract<
    BackgroundOutcome,
    'removed' | 'already-transparent' | 'no-uniform-background' | 'background-covers-image'
  >;
  /** Couleur de fond retenue, `null` si aucune n'a ete jugee dominante. */
  readonly backgroundColor: RgbColor | null;
  /** Part des pixels rendus totalement transparents, 0 a 1. */
  readonly transparentRatio: number;
  /** Nombre de pixels passes en alpha partielle (zone d'anticrenelage). */
  readonly softenedPixels: number;
}

/**
 * Coeur de l'algorithme : detoure le fond uni d'une matrice RGBA.
 *
 * `pixels` n'est modifie QUE si le rapport vaut `removed`. Dans tous les autres
 * cas la matrice ressort intacte, ce qui permet a l'appelant de reutiliser le
 * fichier d'origine sans le redecoder.
 *
 * CE QUE CETTE FONCTION FAIT DE L'ANTICRENELAGE
 *   Les pixels du bord du trace sont des melanges entre le trait et le fond. Un
 *   seuil binaire les laisserait opaques et donnerait un lisere de la couleur du
 *   fond tout autour du logo, tres visible sur le gris de la bande de header.
 *   Ils recoivent donc une alpha proportionnelle a leur distance a la couleur de
 *   fond, puis leur couleur est « demelangee » : sachant `C = a*F + (1-a)*B`, on
 *   retrouve `F = B + (C - B) / a`. Sans ce second temps, un pixel clair a 20 %
 *   d'opacite eclaircirait encore le gris du slot au lieu d'assombrir comme le
 *   fait le trait qu'il prolonge.
 *
 * CE QU'ELLE NE FAIT PAS
 *   - pas de fond en degrade, ni de fond a texture : ils sont refuses en amont
 *     par le test de dominance du contour,
 *   - pas de suppression d'ombre portee : une ombre est un degrade, elle sortira
 *     de la tolerance et restera,
 *   - pas de reconstruction au dela de deux pixels de transition,
 *   - pas de lissage du contour obtenu : la forme reste celle du fichier.
 */
export function removeUniformBackgroundFromPixels(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  options: RemovalOptions = DEFAULT_REMOVAL_OPTIONS,
): PixelRemovalReport {
  const count = width * height;
  if (count <= 0 || pixels.length < count * 4) {
    return report('no-uniform-background', null, 0, 0);
  }

  // 1. Image deja transparente : il n'y a pas de fond a retirer.
  for (let offset = 3; offset < count * 4; offset += 4) {
    if (pixels[offset] < 255) return report('already-transparent', null, 0, 0);
  }

  // 2. Le fond, s'il existe, est la couleur dominante du contour.
  const border = collectBorderIndices(width, height);
  const background = detectBorderColor(pixels, border, options);
  if (!background) return report('no-uniform-background', null, 0, 0);

  // 3. Diffusion depuis le contour. Pile explicite : un logo peut faire 4000 px
  //    de cote, une descente recursive ferait deborder la pile d'appels.
  const alpha = new Uint8Array(count).fill(255);
  const queued = new Uint8Array(count);
  const coreLimit = options.coreTolerance * options.coreTolerance;
  const edgeLimit = options.edgeTolerance * options.edgeTolerance;
  const ramp = options.edgeTolerance - options.coreTolerance;

  /** Paires `(index, profondeur)` empilees a plat. */
  const stack: number[] = [];
  let softenedPixels = 0;

  /**
   * Examine un pixel atteint depuis le fond. Un pixel ni fond ni transition
   * n'est pas marque : il pourra etre re-examine depuis une autre direction, a
   * une profondeur plus faible.
   */
  const reach = (index: number, depth: number): void => {
    if (queued[index]) return;
    const distance2 = squaredDistance(pixels, index, background);
    if (distance2 <= coreLimit) {
      queued[index] = 1;
      alpha[index] = 0;
      stack.push(index, 0);
      return;
    }
    if (distance2 <= edgeLimit && depth <= options.transitionDepth) {
      queued[index] = 1;
      // Alpha proportionnelle a l'ecart au fond : 0 au contact du fond, opaque
      // au contact du trait.
      alpha[index] = Math.round((255 * (Math.sqrt(distance2) - options.coreTolerance)) / ramp);
      softenedPixels += 1;
      stack.push(index, depth);
    }
  };

  // Amorcage sur tous les pixels du contour, comme s'ils etaient atteints depuis
  // l'exterieur de l'image (profondeur 1 pour un pixel de transition).
  for (const index of border) reach(index, 1);

  while (stack.length > 0) {
    const depth = stack.pop() as number;
    const index = stack.pop() as number;
    const x = index % width;
    const y = (index - x) / width;
    // La profondeur 0 marque un pixel de fond, les profondeurs 1 et plus un
    // pixel de transition. Repartir de 1 apres chaque pixel de fond est ce qui
    // borne la traversee d'une bande douce, donc d'un degrade.
    const nextDepth = depth === 0 ? 1 : depth + 1;
    if (x > 0) reach(index - 1, nextDepth);
    if (x < width - 1) reach(index + 1, nextDepth);
    if (y > 0) reach(index - width, nextDepth);
    if (y < height - 1) reach(index + width, nextDepth);
  }

  let transparent = 0;
  for (let index = 0; index < count; index += 1) if (alpha[index] === 0) transparent += 1;
  const transparentRatio = transparent / count;

  // 4. Garde-fou : ne pas rendre un logo entierement vide.
  if (transparentRatio > options.maxBackgroundRatio) {
    return report('background-covers-image', background, transparentRatio, softenedPixels);
  }

  // 5. Application. C'est le seul endroit qui ecrit dans `pixels`.
  for (let index = 0; index < count; index += 1) {
    const value = alpha[index];
    if (value === 255) continue;
    const offset = index * 4;
    pixels[offset + 3] = value;
    if (value >= UNMIX_MIN_ALPHA) unmix(pixels, offset, value, background);
  }

  return report('removed', background, transparentRatio, softenedPixels);
}

/** Convertit une couleur en `#RRGGBB`, pour l'afficher a l'utilisateur. */
export function rgbToHex({ r, g, b }: RgbColor): string {
  const channel = (value: number) =>
    Math.max(0, Math.min(255, Math.round(value)))
      .toString(16)
      .padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`.toUpperCase();
}

// ---------------------------------------------------------------------------
// Enveloppe navigateur
// ---------------------------------------------------------------------------

/** Ce que l'appelant doit envoyer au serveur, et ce qui a ete fait pour y arriver. */
export interface LogoBackgroundRemoval {
  readonly outcome: BackgroundOutcome;
  readonly backgroundColor: RgbColor | null;
  readonly transparentRatio: number;
  /**
   * Le fichier a envoyer : le PNG detoure si `outcome === 'removed'`, sinon le
   * fichier d'origine, inchange.
   */
  readonly file: File;
}

/**
 * Detoure le fond uni d'un logo depose et renvoie le fichier a envoyer.
 *
 * Le PNG est le seul format de sortie sensible : c'est le seul des formats
 * acceptes par le stockage qui porte un canal alpha et ne degrade pas un aplat.
 * L'image est traitee a sa resolution naturelle, jamais reduite : le techpack
 * imprime le fichier tel quel.
 */
export async function removeUniformBackground(
  file: File,
  options: RemovalOptions = DEFAULT_REMOVAL_OPTIONS,
): Promise<LogoBackgroundRemoval> {
  const unchanged = (outcome: BackgroundOutcome): LogoBackgroundRemoval => ({
    outcome,
    backgroundColor: null,
    transparentRatio: 0,
    file,
  });

  if (typeof document === 'undefined') return unchanged('decode-failed');
  // Un SVG n'a pas de matrice de pixels a inspecter sans le rendre, et le rendre
  // le figerait a une resolution. On n'y touche pas.
  if (file.type === 'image/svg+xml') return unchanged('vector-image');

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return unchanged('decode-failed');
  }

  try {
    const { width, height } = bitmap;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) return unchanged('decode-failed');

    context.drawImage(bitmap, 0, 0);
    const image = context.getImageData(0, 0, width, height);
    const pixels = removeUniformBackgroundFromPixels(image.data, width, height, options);

    if (pixels.outcome !== 'removed') {
      return {
        outcome: pixels.outcome,
        backgroundColor: pixels.backgroundColor,
        transparentRatio: pixels.transparentRatio,
        file,
      };
    }

    context.putImageData(image, 0, 0);
    const blob = await toPngBlob(canvas);
    if (!blob) return unchanged('decode-failed');

    return {
      outcome: 'removed',
      backgroundColor: pixels.backgroundColor,
      transparentRatio: pixels.transparentRatio,
      file: new File([blob], pngFileName(file.name), { type: 'image/png' }),
    };
  } catch {
    // Un canvas trop grand pour le moteur echoue ici, sur `drawImage` ou
    // `getImageData`. On rend l'original : c'est le comportement d'avant.
    return unchanged('decode-failed');
  } finally {
    bitmap.close();
  }
}

// ---------------------------------------------------------------------------
// Internes
// ---------------------------------------------------------------------------

function report(
  outcome: PixelRemovalReport['outcome'],
  backgroundColor: RgbColor | null,
  transparentRatio: number,
  softenedPixels: number,
): PixelRemovalReport {
  return { outcome, backgroundColor, transparentRatio, softenedPixels };
}

/** Indices des pixels du contour de l'image, sans doublon. */
function collectBorderIndices(width: number, height: number): number[] {
  const indices: number[] = [];
  for (let x = 0; x < width; x += 1) {
    indices.push(x);
    if (height > 1) indices.push((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y += 1) {
    indices.push(y * width);
    if (width > 1) indices.push(y * width + width - 1);
  }
  return indices;
}

interface ColorBucket {
  n: number;
  r: number;
  g: number;
  b: number;
}

/**
 * Couleur dominante du contour, ou `null` si le contour n'est pas uni.
 *
 * Les couleurs sont d'abord regroupees par paquets de 16 niveaux par canal pour
 * trouver la teinte majoritaire malgre le bruit, puis la moyenne exacte du
 * paquet gagnant sert de couleur de reference. Le comptage final se refait a la
 * tolerance, et pas au paquet : un fond peut se retrouver a cheval sur deux
 * paquets voisins sans cesser d'etre uni.
 */
function detectBorderColor(
  pixels: Uint8ClampedArray,
  border: readonly number[],
  options: RemovalOptions,
): RgbColor | null {
  if (border.length === 0) return null;

  const buckets = new Map<number, ColorBucket>();
  for (const index of border) {
    const offset = index * 4;
    const r = pixels[offset];
    const g = pixels[offset + 1];
    const b = pixels[offset + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.n += 1;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
    } else {
      buckets.set(key, { n: 1, r, g, b });
    }
  }

  let best: ColorBucket | null = null;
  for (const bucket of buckets.values()) {
    if (!best || bucket.n > best.n) best = bucket;
  }
  if (!best) return null;

  const candidate: RgbColor = {
    r: Math.round(best.r / best.n),
    g: Math.round(best.g / best.n),
    b: Math.round(best.b / best.n),
  };

  const limit = options.coreTolerance * options.coreTolerance;
  let within = 0;
  for (const index of border) {
    if (squaredDistance(pixels, index, candidate) <= limit) within += 1;
  }

  return within / border.length >= options.borderDominance ? candidate : null;
}

/** Distance euclidienne au carre entre un pixel et une couleur, canaux RGB. */
function squaredDistance(pixels: Uint8ClampedArray, index: number, color: RgbColor): number {
  const offset = index * 4;
  const dr = pixels[offset] - color.r;
  const dg = pixels[offset + 1] - color.g;
  const db = pixels[offset + 2] - color.b;
  return dr * dr + dg * dg + db * db;
}

/**
 * Retrouve la couleur du trait dans un pixel de transition.
 *
 * `C = a*F + (1-a)*B` donne `F = B + (C - B) / a`. Le resultat est borne par
 * `Uint8ClampedArray`, ce qui limite les degats quand le pixel n'etait pas un
 * vrai melange.
 */
function unmix(
  pixels: Uint8ClampedArray,
  offset: number,
  alphaValue: number,
  background: RgbColor,
): void {
  const factor = 255 / alphaValue;
  pixels[offset] = background.r + (pixels[offset] - background.r) * factor;
  pixels[offset + 1] = background.g + (pixels[offset + 1] - background.g) * factor;
  pixels[offset + 2] = background.b + (pixels[offset + 2] - background.b) * factor;
}

function toPngBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

/** `logo.jpg` devient `logo.png` : le contenu envoye n'est plus le format d'origine. */
function pngFileName(name: string): string {
  const base = name.replace(/\.[^.]+$/, '').trim();
  return `${base.length > 0 ? base : 'logo'}.png`;
}

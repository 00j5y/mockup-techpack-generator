/**
 * Detecte si une image deposee comporte des pixels transparents.
 *
 * Le slot logo a pour fond le gris `--tp-bar` du header : un JPG sur fond blanc
 * y produit un rectangle blanc franc, visible sur les 12 pages du techpack.
 * C'est le genre de detail qu'on ne remarque qu'une fois le PDF parti chez le
 * fournisseur, d'ou l'avertissement au depot.
 *
 * Depuis `removeUniformBackground`, le cas courant est CORRIGE et non plus
 * seulement signale : cette detection ne sert donc plus que de repli, quand le
 * detourage n'a pas pu se prononcer (SVG, decodage impossible). Le cas « image
 * opaque sans fond uni », lui, est deduit directement du rapport de detourage,
 * sans second decodage.
 *
 * Navigateur uniquement.
 */

/** L'echantillonnage se fait sur une version reduite : un logo peut faire 4000px. */
const SAMPLE_SIZE = 160;

/**
 * `true` transparence detectee, `false` opaque, `null` indeterminable.
 *
 * `null` couvre le SVG (pas de matrice de pixels a inspecter sans le rendre) et
 * l'echec de lecture. On n'avertit pas dans ce cas : un faux avertissement sur
 * un logo correct apprend a ignorer l'avertissement.
 */
export async function hasAlphaChannel(file: File): Promise<boolean | null> {
  if (typeof document === 'undefined') return null;
  // Un JPG ne peut structurellement pas porter d'alpha : reponse immediate.
  if (file.type === 'image/jpeg') return false;
  if (file.type === 'image/svg+xml') return null;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null;
  }

  try {
    const scale = Math.min(1, SAMPLE_SIZE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    ctx.drawImage(bitmap, 0, 0, width, height);
    const { data } = ctx.getImageData(0, 0, width, height);

    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 255) return true;
    }
    return false;
  } catch {
    return null;
  } finally {
    bitmap.close();
  }
}

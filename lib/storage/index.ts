/**
 * Stockage des fichiers sur le systeme de fichiers local.
 *
 * Remplace Supabase Storage. Les fichiers sont servis par l'application
 * elle-meme via /api/files/[...path], donc **a la meme origine que le canvas**.
 *
 * C'est un gain, pas un pis-aller : le piege du canvas "tainted" disparait.
 * `stage.toDataURL()` echouait des que l'image de fond venait d'une origine
 * sans en-tete CORS approprie ; en meme origine, la question ne se pose plus.
 * Voir .claude/docs/12-pieges.md.
 *
 * Cote serveur uniquement.
 */

import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve, sep } from 'node:path';

/**
 * Racine de stockage. Volume Docker en production, dossier local en dev.
 *
 * Le `.trim()` et le test de chaine vide ne sont pas cosmetiques : une variable
 * declaree mais vide dans .env.local (`STORAGE_DIR=`) donne une chaine vide, que
 * `??` laisse passer. On se retrouverait a ecrire les uploads a la racine du
 * projet au lieu du dossier de stockage.
 */
const STORAGE_ROOT = resolve(
  process.env.STORAGE_DIR?.trim() || join(process.cwd(), '.storage'),
);

/** Types acceptes a l'upload. Un flat Illustrator sort en PNG transparent. */
const ALLOWED_MIME = new Map<string, string>([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/webp', '.webp'],
  ['image/svg+xml', '.svg'],
  ['application/pdf', '.pdf'],
]);

/** 25 Mo : large pour un flat haute resolution, assez bas pour bloquer un envoi accidentel. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export class StorageError extends Error {}

/**
 * Resout un chemin relatif en chemin absolu, en garantissant qu'il reste sous
 * la racine de stockage.
 *
 * Un chemin vient toujours de la base ou d'une requete : il est donc a traiter
 * comme non fiable. Sans cette verification, `../../etc/passwd` sortirait du
 * volume.
 */
function resolveInsideRoot(relativePath: string): string {
  const absolute = resolve(STORAGE_ROOT, normalize(relativePath));
  if (absolute !== STORAGE_ROOT && !absolute.startsWith(STORAGE_ROOT + sep)) {
    throw new StorageError(`Chemin hors du stockage : ${relativePath}`);
  }
  return absolute;
}

/**
 * Construit un chemin de stockage stable et previsible.
 * ex: buildPath('prod-uuid', 'flats', '.png') -> "products/prod-uuid/flats/<uuid>.png"
 */
export function buildPath(productId: string, folder: string, extension: string): string {
  return `products/${productId}/${folder}/${randomUUID()}${extension}`;
}

/** Ecrit un fichier et retourne son chemin relatif, celui stocke en base. */
export async function putFile(
  relativePath: string,
  data: Buffer | Uint8Array,
): Promise<string> {
  const absolute = resolveInsideRoot(relativePath);
  await mkdir(dirname(absolute), { recursive: true });
  await writeFile(absolute, data);
  return relativePath;
}

/**
 * Ecrit un fichier envoye par formulaire, apres validation du type et de la taille.
 * Retourne le chemin relatif a stocker en base.
 */
export async function putUpload(
  file: File,
  productId: string,
  folder: string,
): Promise<string> {
  const extension = ALLOWED_MIME.get(file.type);
  if (!extension) {
    throw new StorageError(
      `Type non accepte : ${file.type || 'inconnu'}. Attendus : ${[...ALLOWED_MIME.keys()].join(', ')}`,
    );
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new StorageError(
      `Fichier trop volumineux : ${(file.size / 1024 / 1024).toFixed(1)} Mo, maximum ${MAX_UPLOAD_BYTES / 1024 / 1024} Mo`,
    );
  }

  const data = Buffer.from(await file.arrayBuffer());
  return putFile(buildPath(productId, folder, extension), data);
}

/** Ecrit un dataURL base64, tel que produit par `stage.toDataURL()` de Konva. */
export async function putDataUrl(relativePath: string, dataUrl: string): Promise<string> {
  const match = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
  if (!match) {
    throw new StorageError('dataURL invalide');
  }
  const [, mime, base64] = match;
  if (!ALLOWED_MIME.has(mime)) {
    throw new StorageError(`Type non accepte : ${mime}`);
  }
  return putFile(relativePath, Buffer.from(base64, 'base64'));
}

export async function getFile(relativePath: string): Promise<Buffer> {
  return readFile(resolveInsideRoot(relativePath));
}

export async function fileExists(relativePath: string): Promise<boolean> {
  try {
    await stat(resolveInsideRoot(relativePath));
    return true;
  } catch {
    return false;
  }
}

/**
 * Supprime un fichier. Silencieux s'il n'existe pas.
 *
 * A appeler dans la meme operation que la suppression de la ligne en base :
 * supprimer l'un sans l'autre laisse soit un orphelin sur le disque, soit un
 * chemin mort en base.
 */
export async function deleteFile(relativePath: string): Promise<void> {
  await rm(resolveInsideRoot(relativePath), { force: true });
}

/** Type MIME deduit de l'extension, pour l'en-tete de la route de service. */
export function contentTypeFor(relativePath: string): string {
  const extension = extname(relativePath).toLowerCase();
  for (const [mime, ext] of ALLOWED_MIME) {
    if (ext === extension) return mime;
  }
  return 'application/octet-stream';
}

/** ETag stable, pour que le navigateur et Puppeteer puissent mettre en cache. */
export function etagFor(data: Buffer): string {
  return `"${createHash('sha1').update(data).digest('hex')}"`;
}

export { STORAGE_ROOT };

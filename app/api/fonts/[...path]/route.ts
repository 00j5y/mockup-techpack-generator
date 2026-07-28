import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { extname, join, normalize, resolve, sep } from 'node:path';

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * Sert les polices deposees dans `assets/fonts/`, a la MEME origine que
 * l'application, exactement comme `/api/files/[...path]` sert les flats.
 *
 * Pourquoi une route et pas `next/font/local` ni `public/` :
 *
 * - Myriad Pro Bold est un fichier sous licence Adobe que Jay ne veut pas
 *   committer. Il n'est donc present ni dans le depot, ni dans l'image Docker :
 *   il est monte en lecture seule dans le conteneur. `next/font/local` exige le
 *   fichier AU BUILD et ferait echouer un clone frais.
 * - Chromium tourne dans le conteneur Debian et ne voit pas les polices
 *   installees sur macOS. Sans ce montage servi par l'application, le navigateur
 *   de Jay afficherait Myriad Pro et le PDF sortirait en Source Sans 3. Or
 *   l'avertissement de debordement de colonne du header mesure avec la police du
 *   navigateur : une divergence rendrait cet avertissement faux.
 *
 * Fichier absent = 404. C'est un cas nominal, pas une erreur : le navigateur
 * retombe sur Source Sans 3 et le bandeau d'avertissement previent.
 *
 * Volontairement independant de `lib/storage`, qui porte `import 'server-only'`
 * et vise le stockage des uploads. Deux racines, deux responsabilites.
 */

/**
 * Racine des polices. Dossier local en dev, montage en lecture seule en
 * conteneur (voir `docker-compose.yml`).
 *
 * Le `.trim()` et le test de chaine vide reproduisent la regle de
 * `lib/storage` : une variable declaree mais VIDE (`FONTS_DIR=`) donne une
 * chaine vide, que `??` laisserait passer. Le piege est deja arrive en Phase 0
 * sur `STORAGE_DIR`, voir `.claude/docs/12-pieges.md`.
 */
const FONTS_ROOT = resolve(
  process.env.FONTS_DIR?.trim() || join(process.cwd(), 'assets', 'fonts'),
);

/** Types acceptes. Rien d'autre ne doit sortir de ce dossier. */
const FONT_CONTENT_TYPES = new Map<string, string>([
  ['.ttf', 'font/ttf'],
  ['.otf', 'font/otf'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
]);

/**
 * Resout un chemin de requete sous la racine des polices.
 *
 * Le chemin vient de l'URL : il est non fiable. `normalize` replie les `..`,
 * puis on verifie que le resultat reste sous la racine. Retourne `null` plutot
 * que de lever : la route ne distingue pas une traversee d'un fichier absent,
 * les deux repondent 404 et ne renseignent donc pas un attaquant.
 */
function resolveInsideFontsRoot(relativePath: string): string | null {
  const absolute = resolve(FONTS_ROOT, normalize(relativePath));
  if (absolute !== FONTS_ROOT && !absolute.startsWith(FONTS_ROOT + sep)) {
    return null;
  }
  return absolute;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const relativePath = path.join('/');

  const contentType = FONT_CONTENT_TYPES.get(extname(relativePath).toLowerCase());
  if (!contentType) {
    return NextResponse.json({ error: 'Police introuvable' }, { status: 404 });
  }

  const absolute = resolveInsideFontsRoot(relativePath);
  if (absolute === null) {
    return NextResponse.json({ error: 'Police introuvable' }, { status: 404 });
  }

  let data: Buffer;
  try {
    data = await readFile(absolute);
  } catch {
    // Cas nominal sur un clone frais : la police n'a pas ete deposee.
    return NextResponse.json({ error: 'Police introuvable' }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(data), {
    headers: {
      'Content-Type': contentType,
      'Content-Length': String(data.byteLength),
      ETag: `"${createHash('sha1').update(data).digest('hex')}"`,
      // Un fichier de police ne change jamais en cours de session.
      // `must-revalidate` garde l'ETag utile si Jay remplace le fichier.
      'Cache-Control': 'private, max-age=86400, must-revalidate',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

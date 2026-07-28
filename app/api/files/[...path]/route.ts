import { NextResponse } from 'next/server';
import { contentTypeFor, etagFor, getFile, StorageError } from '@/lib/storage';

export const runtime = 'nodejs';

/**
 * Sert les fichiers du stockage local.
 *
 * Sert le canvas d'annotation ET le rendu Puppeteer, tous deux a la meme
 * origine que l'application. C'est ce qui elimine le probleme de canvas
 * "tainted" a l'export : plus aucune image ne vient d'une origine tierce.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const relativePath = path.join('/');

  try {
    const data = await getFile(relativePath);

    return new NextResponse(new Uint8Array(data), {
      headers: {
        'Content-Type': contentTypeFor(relativePath),
        'Content-Length': String(data.byteLength),
        ETag: etagFor(data),
        // Les chemins portent un uuid : un fichier donne ne change jamais de
        // contenu, sauf les overlays, ecrases a chaque export. `must-revalidate`
        // garde le cache utile sans servir un overlay perime.
        'Cache-Control': 'private, max-age=3600, must-revalidate',
        // Le stockage accepte le SVG, qui peut porter du script et qui est ici
        // servi a la meme origine que l'application. `sandbox` neutralise
        // l'execution, `nosniff` empeche le navigateur de reinterpreter le type.
        'Content-Security-Policy': 'sandbox; default-src \'none\'',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    if (error instanceof StorageError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Fichier introuvable' }, { status: 404 });
  }
}

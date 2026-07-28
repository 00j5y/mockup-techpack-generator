import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getProduct } from '@/lib/db/queries';
import { products } from '@/lib/db/schema';
import { apiError } from '@/lib/http';
import { belongsToProduct, deleteFile, putUpload, StorageError } from '@/lib/storage';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

/**
 * Depose le logo du produit : slot de 72 x 70 pt present sur les 12 pages.
 *
 * L'upload n'est pas delegue a une route generique : il ecrit un fichier ET une
 * colonne. Les separer exposerait a laisser un fichier sans ligne, ou l'inverse.
 * La validation MIME et le plafond de taille sont deja centralises dans
 * `lib/storage`, ce qui etait la raison d'etre de la route generique.
 */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) return apiError('Produit introuvable', 404);

  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return apiError('Fichier manquant', 400);

  let storagePath: string | null = null;
  try {
    storagePath = await putUpload(file, id, 'logo');

    const [updated] = await db
      .update(products)
      .set({ logoStoragePath: storagePath, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();

    const previous = product.logoStoragePath;

    // Remplacer un logo laisse l'ancien fichier sur le disque. Le supprimer
    // apres l'ecriture en base : si la mise a jour echoue, on prefere un
    // orphelin a un produit qui pointe sur un fichier disparu.
    //
    // `belongsToProduct` est un garde-fou et pas une formalite : un chemin qui
    // ne vit pas sous `products/<id>/` appartient a un AUTRE produit, et
    // l'effacer ferait disparaitre son logo des 12 pages de son techpack.
    if (previous && previous !== storagePath && belongsToProduct(previous, id)) {
      // La base pointe deja sur le nouveau fichier : une erreur disque ici ne
      // doit pas faire echouer l'upload, ni entrainer la suppression du fichier
      // fraichement ecrit par le `catch`.
      await deleteFile(previous).catch((error: unknown) => {
        console.warn(`Logo remplace, ancien fichier ${previous} non efface :`, error);
      });
    }

    return NextResponse.json(updated, { status: 201 });
  } catch (error) {
    // La mise a jour a echoue apres l'ecriture du fichier : le retirer, sinon il
    // reste sur le volume sans qu'aucune ligne ne le reference.
    if (storagePath) await deleteFile(storagePath).catch(() => undefined);
    if (error instanceof StorageError) return apiError(error.message, 400);
    return apiError('Upload impossible', 500, String(error));
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) return apiError('Produit introuvable', 404);

  const [updated] = await db
    .update(products)
    .set({ logoStoragePath: null, updatedAt: new Date() })
    .where(eq(products.id, id))
    .returning();

  // La colonne est deja a `null` : une erreur disque ne doit pas produire un 500
  // alors que la suppression a bien eu lieu, sinon Jay reclique et recoit un 404.
  // Le fichier reste un orphelin connu, trace ici.
  if (product.logoStoragePath) {
    await deleteFile(product.logoStoragePath).catch((error: unknown) => {
      console.warn(
        `Logo detache du produit ${id}, fichier ${product.logoStoragePath} non efface :`,
        error,
      );
    });
  }

  return NextResponse.json(updated);
}

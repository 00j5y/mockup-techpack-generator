import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getProduct, touchProduct } from '@/lib/db/queries';
import { productFlats } from '@/lib/db/schema';
import { apiError, apiValidationError } from '@/lib/http';
import { deleteFile, putUpload, StorageError } from '@/lib/storage';
import { flatUploadSchema } from '@/lib/validation/product';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

/**
 * Upload d'un flat : le fichier sur le volume, la ligne en base.
 *
 * Les deux ecritures vivent dans la meme route pour la meme raison que le logo :
 * un fichier sans ligne est un orphelin invisible, une ligne sans fichier est
 * une image cassee dans le techpack.
 */
export async function POST(request: Request, { params }: Params) {
  const { id } = await params;
  if (!(await getProduct(id))) return apiError('Produit introuvable', 404);

  const form = await request.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return apiError('Fichier manquant', 400);

  const label = form.get('label');
  const parsed = flatUploadSchema.safeParse({
    type: form.get('type'),
    label: typeof label === 'string' && label.trim() !== '' ? label.trim() : null,
  });
  if (!parsed.success) return apiValidationError(parsed.error);

  let storagePath: string | null = null;
  try {
    storagePath = await putUpload(file, id, 'flats');

    const [created] = await db
      .insert(productFlats)
      .values({
        productId: id,
        type: parsed.data.type,
        label: parsed.data.label,
        storagePath,
      })
      .returning();

    // Deposer un flat modifie le produit, meme si aucune colonne de `products`
    // ne change. L'echec de ce simple marquage ne doit pas annuler un upload
    // reussi, ni declencher la suppression du fichier par le `catch`.
    await touchProduct(id).catch((error: unknown) => {
      console.warn(`Flat ajoute, updated_at non rafraichi pour le produit ${id} :`, error);
    });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    // L'insertion a echoue apres l'ecriture du fichier : le retirer, sinon il
    // reste sur le volume sans qu'aucune ligne ne le reference.
    if (storagePath) await deleteFile(storagePath).catch(() => undefined);
    if (error instanceof StorageError) return apiError(error.message, 400);
    return apiError('Upload impossible', 500, String(error));
  }
}

import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { touchProduct } from '@/lib/db/queries';
import { productFlats } from '@/lib/db/schema';
import { apiError } from '@/lib/http';
import { deleteFile } from '@/lib/storage';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string; flatId: string }> };

/**
 * Supprime un flat.
 *
 * La suppression cascade sur `measurement_points` et `callouts`, et passe a
 * null le `flat_id` de `color_specs` et `artwork_specs`. Le nombre d'elements
 * concernes est affiche par la confirmation cote client, alimente par
 * `listFlatsWithImpact()` : la page connait deja les chiffres, pas besoin d'un
 * aller-retour supplementaire avant de confirmer.
 */
export async function DELETE(_request: Request, { params }: Params) {
  const { id, flatId } = await params;

  const [flat] = await db
    .select()
    .from(productFlats)
    .where(and(eq(productFlats.id, flatId), eq(productFlats.productId, id)))
    .limit(1);

  if (!flat) return apiError('Flat introuvable', 404);

  await db.delete(productFlats).where(eq(productFlats.id, flatId));

  await touchProduct(id).catch((error: unknown) => {
    console.warn(`Flat supprime, updated_at non rafraichi pour le produit ${id} :`, error);
  });

  // La ligne est deja supprimee : une erreur disque ne doit pas produire un 500
  // trompeur, sinon Jay reclique et recoit un 404 sur un flat reellement
  // supprime. Les fichiers deviennent des orphelins connus, traces ici.
  await deleteFile(flat.storagePath).catch((error: unknown) => {
    console.warn(`Flat ${flatId} supprime, fichier ${flat.storagePath} non efface :`, error);
  });
  if (flat.overlayStoragePath) {
    const overlayPath = flat.overlayStoragePath;
    await deleteFile(overlayPath).catch((error: unknown) => {
      console.warn(`Flat ${flatId} supprime, overlay ${overlayPath} non efface :`, error);
    });
  }

  return NextResponse.json({ deleted: flatId });
}

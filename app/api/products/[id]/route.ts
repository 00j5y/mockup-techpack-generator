import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fabricPantoneError, getProduct } from '@/lib/db/queries';
import { products } from '@/lib/db/schema';
import { apiError, apiValidationError, readJson } from '@/lib/http';
import { deleteDirectory } from '@/lib/storage';
import { productPatchSchema, sampleSizesError } from '@/lib/validation/product';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) return apiError('Produit introuvable', 404);
  return NextResponse.json(product);
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;

  const parsed = productPatchSchema.safeParse(await readJson(request));
  if (!parsed.success) return apiValidationError(parsed.error);
  if (Object.keys(parsed.data).length === 0) {
    return apiError('Aucun champ a mettre a jour', 400);
  }

  const existing = await getProduct(id);
  if (!existing) return apiError('Produit introuvable', 404);

  // `sample_sizes` et `size_range` sont lies par un CHECK d'inclusion en base,
  // et un PATCH peut ne toucher qu'a l'un des deux. La verification a donc
  // besoin de la ligne existante, ce que le schema Zod ne voit pas.
  const merged = { ...existing, ...parsed.data };
  const conflict = sampleSizesError(merged.sizeRange, merged.sampleSizes);
  if (conflict) return apiError(conflict, 400);

  // Meme raison : la cle etrangere vers `pantone_colors` echapperait au schema
  // Zod, qui ne voit pas la base, et sortirait en 500 illisible.
  const pantoneError = await fabricPantoneError(parsed.data.fabricPantoneId);
  if (pantoneError) return apiError(pantoneError, 400);

  try {
    const [updated] = await db
      .update(products)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    return apiError('Mise a jour impossible', 500, String(error));
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;

  const existing = await getProduct(id);
  if (!existing) return apiError('Produit introuvable', 404);

  await db.delete(products).where(eq(products.id, id));

  // La cascade nettoie la base, pas le disque. Sans ca, tout `products/<id>/`
  // resterait sur le volume sans qu'aucune ligne ne le reference.
  //
  // La suppression en base a deja eu lieu : une erreur disque ne doit pas
  // produire un 500 trompeur, sinon Jay reclique et recoit un 404 sur un produit
  // reellement supprime. Le dossier devient un orphelin connu, trace ici.
  await deleteDirectory(`products/${id}`).catch((error: unknown) => {
    console.warn(`Produit ${id} supprime, dossier products/${id} non efface :`, error);
  });

  return NextResponse.json({ deleted: id });
}

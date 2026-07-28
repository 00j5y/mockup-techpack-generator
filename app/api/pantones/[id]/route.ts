/**
 * Bibliotheque Pantone : mise a jour et suppression d'une couleur.
 *
 * Meme table GLOBALE que `../route.ts` : aucun `productId` ici non plus. Une
 * couleur corrigee l'est pour tous les produits qui la referencent, c'est
 * exactement l'interet d'une bibliotheque.
 */

import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  getPantoneColor,
  getPantoneUsage,
  isUniqueViolation,
  pantoneConflictMessage,
} from '@/lib/db/queries';
import { pantoneColors } from '@/lib/db/schema';
import { apiError, apiValidationError, readJson } from '@/lib/http';
import { pantonePatchSchema } from '@/lib/validation/pantone';

export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;

  const parsed = pantonePatchSchema.safeParse(await readJson(request));
  if (!parsed.success) return apiValidationError(parsed.error);
  if (Object.keys(parsed.data).length === 0) {
    return apiError('Aucun champ a mettre a jour', 400);
  }

  const existing = await getPantoneColor(id);
  if (!existing) return apiError('Couleur introuvable', 404);

  // Le couple (reference, library) porte l'unicite, et un PATCH peut ne toucher
  // qu'a l'un des deux : le message de conflit a donc besoin de la ligne
  // existante pour reconstituer le couple reellement soumis a la contrainte.
  const merged = { ...existing, ...parsed.data };

  try {
    const [updated] = await db
      .update(pantoneColors)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(pantoneColors.id, id))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    // Renommer une couleur vers un couple deja pris est le scenario reel :
    // corriger « 7545 » en « 7546 » des mois plus tard, sans se souvenir que
    // 7546 est deja en bibliotheque. Nommer la couleur en conflit est la seule
    // information qui permette de choisir entre corriger et reutiliser.
    if (isUniqueViolation(error, 'pantone_colors_reference_library')) {
      return apiError(await pantoneConflictMessage(merged.reference, merged.library), 409);
    }
    return apiError('Mise a jour impossible', 500, String(error));
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;

  const existing = await getPantoneColor(id);
  if (!existing) return apiError('Couleur introuvable', 404);

  // Compte lu AVANT la suppression : apres, `products.fabric_pantone_id` vaut
  // deja `null` partout et le chiffre serait irremediablement 0.
  //
  // La suppression ne casse rien (`on delete set null` detache les produits
  // sans les supprimer), mais elle vide silencieusement la couleur de tissu de
  // chacun d'eux : le nombre est la seule facon de le savoir.
  const detachedProducts = await getPantoneUsage(id);

  await db.delete(pantoneColors).where(eq(pantoneColors.id, id));

  return NextResponse.json({ deleted: id, detachedProducts });
}

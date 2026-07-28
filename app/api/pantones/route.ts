/**
 * Bibliotheque Pantone de la marque : liste et creation.
 *
 * Table GLOBALE, pas par produit : aucun `productId` dans ces routes, et c'est
 * volontaire. Voir le commentaire de `pantoneColors` dans `lib/db/schema.ts`.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  isUniqueViolation,
  listPantoneColors,
  pantoneConflictMessage,
} from '@/lib/db/queries';
import { pantoneColors } from '@/lib/db/schema';
import { apiError, apiValidationError, readJson } from '@/lib/http';
import { pantoneCreateSchema } from '@/lib/validation/pantone';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  // `q` absent et `q` vide sont traites pareil : toute la bibliotheque. Un champ
  // de recherche qu'on vide doit rendre la liste complete, pas une liste vide.
  const search = url.searchParams.get('q') ?? undefined;

  return NextResponse.json(await listPantoneColors(search));
}

export async function POST(request: Request) {
  const parsed = pantoneCreateSchema.safeParse(await readJson(request));
  if (!parsed.success) return apiValidationError(parsed.error);

  try {
    const [created] = await db.insert(pantoneColors).values(parsed.data).returning();
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    // Le cas d'erreur le plus probable en usage reel : ressaisir une couleur
    // deja validee, des mois plus tard, sans se souvenir qu'elle est en
    // bibliotheque. Une violation de contrainte brute donnerait un 500 et un
    // pave SQL la ou il faut nommer la couleur qui existe deja.
    if (isUniqueViolation(error, 'pantone_colors_reference_library')) {
      return apiError(await pantoneConflictMessage(parsed.data.reference, parsed.data.library), 409);
    }
    return apiError('Creation impossible', 500, String(error));
  }
}

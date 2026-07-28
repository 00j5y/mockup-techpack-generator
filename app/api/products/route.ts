import { randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { products } from '@/lib/db/schema';
import { fabricPantoneError, listProducts } from '@/lib/db/queries';
import { apiError, apiValidationError, readJson } from '@/lib/http';
import { copyIntoProduct, deleteFile } from '@/lib/storage';
import { productCreateSchema } from '@/lib/validation/product';
import { PRODUCT_CATEGORIES, PRODUCT_STATUSES } from '@/types/product';
import type { ProductCategory, ProductStatus } from '@/types/product';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const category = url.searchParams.get('category');
  const status = url.searchParams.get('status');

  const rows = await listProducts({
    category: PRODUCT_CATEGORIES.includes(category as ProductCategory)
      ? (category as ProductCategory)
      : undefined,
    status: PRODUCT_STATUSES.includes(status as ProductStatus)
      ? (status as ProductStatus)
      : undefined,
  });

  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const parsed = productCreateSchema.safeParse(await readJson(request));
  if (!parsed.success) return apiValidationError(parsed.error);

  // Verifie AVANT la copie du logo : un 400 apres la copie laisserait un fichier
  // sur le volume qu'aucune ligne ne referencerait.
  const pantoneError = await fabricPantoneError(parsed.data.fabricPantoneId);
  if (pantoneError) return apiError(pantoneError, 400);

  // L'identifiant est genere ici, pas par la base : c'est ce qui permet de
  // connaitre le dossier de destination du logo AVANT l'insert, et donc
  // d'inserer directement le chemin final. Sans lui il faudrait copier puis
  // faire un UPDATE, avec deux facons de laisser la base incoherente.
  const id = randomUUID();

  let copiedLogoPath: string | null = null;
  try {
    // Le formulaire pre-remplit le logo avec celui du produit le plus recent :
    // le chemin recu pointe donc sur le dossier d'un AUTRE produit (l'identifiant
    // vient d'etre genere, aucun fichier ne peut deja vivre sous le sien). On
    // duplique le fichier pour que chaque produit possede les siens, sinon
    // supprimer le produit d'origine effacerait le logo de celui-ci.
    //
    // La copie a lieu AVANT l'insert. Le fichier source peut avoir disparu entre
    // le rendu du formulaire et la soumission : `copyIntoProduct` leve alors
    // ENOENT, et on repond 500 sans avoir cree de ligne. Copier apres l'insert
    // laissait au contraire un produit fantome pointant sur un chemin mort.
    if (parsed.data.logoStoragePath) {
      copiedLogoPath = await copyIntoProduct(parsed.data.logoStoragePath, id, 'logo');
    }

    const [created] = await db
      .insert(products)
      .values({ ...parsed.data, id, logoStoragePath: copiedLogoPath })
      .returning();

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    // L'insert a echoue apres la copie : retirer le fichier, sinon il reste sur
    // le volume sans qu'aucune ligne ne le reference.
    if (copiedLogoPath) await deleteFile(copiedLogoPath).catch(() => undefined);
    return apiError('Creation impossible', 500, String(error));
  }
}

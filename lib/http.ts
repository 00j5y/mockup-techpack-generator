/**
 * Reponses d'erreur uniformes des routes API.
 *
 * Contrat unique : `{ error: string, details?: unknown }`. Le client peut donc
 * toujours afficher `body.error`, ce dont depend l'auto-save pour montrer une
 * erreur utile plutot qu'un code HTTP nu.
 */

import { NextResponse } from 'next/server';
import type { ZodError } from 'zod';

/**
 * Le detail n'est expose qu'en dehors de la production.
 *
 * Les routes passent volontiers `String(error)` en `details`, ce qui pour une
 * erreur Postgres contient la requete complete. Precieux en local, a ne pas
 * envoyer au client une fois deploye. Le filtrage vit ici et pas dans chaque
 * route : un seul endroit a verifier, aucun oubli possible a l'ajout d'une route.
 */
export function apiError(message: string, status: number, details?: unknown) {
  const exposeDetails = process.env.NODE_ENV !== 'production';
  return NextResponse.json(
    { error: message, details: exposeDetails ? details : undefined },
    { status },
  );
}

/**
 * Erreur de validation Zod, aplatie en un message lisible.
 *
 * Le message concatene les chemins fautifs : un auto-save qui echoue affiche
 * ainsi « sampleSize : valeur invalide » et pas juste « Erreur 400 ».
 */
export function apiValidationError(error: ZodError) {
  const message = error.issues
    .map((issue) => {
      const path = issue.path.join('.');
      return path ? `${path} : ${issue.message}` : issue.message;
    })
    .join(' | ');
  return apiError(message || 'Donnees invalides', 400, error.issues);
}

/** Corps JSON d'une requete, ou `null` si le corps est absent ou malforme. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

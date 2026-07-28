import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * Connexion Postgres, cote serveur uniquement.
 *
 * Ne jamais importer ce fichier depuis un Client Component : la chaine de
 * connexion contient le mot de passe de la base.
 */

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    'DATABASE_URL manquante. Copier .env.example en .env.local, puis lancer `docker compose up -d db`.',
  );
}

/**
 * En developpement, Next recharge les modules a chaque edition. Sans ce cache
 * global, chaque rechargement ouvrirait un nouveau pool et la base finirait
 * par refuser les connexions.
 */
const globalForDb = globalThis as unknown as { queryClient?: postgres.Sql };

const queryClient =
  globalForDb.queryClient ??
  postgres(connectionString, {
    max: 10,
    // `prepare: false` n'est utile que derriere un pooler en mode transaction.
    // On se connecte directement a Postgres, donc on garde les requetes preparees.
  });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.queryClient = queryClient;
}

export const db = drizzle(queryClient, { schema });

export { schema };

// Fait echouer le BUILD si un Client Component atteint ce module, au lieu de
// laisser `DATABASE_URL` partir dans le bundle sans le moindre avertissement.
// La frontiere ne tenait jusqu'ici qu'a la discipline du mot-cle `type` a
// l'import, que l'auto-import d'un editeur omet par defaut.
import 'server-only';

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * Connexion Postgres, cote serveur uniquement.
 *
 * Ne jamais importer ce fichier depuis un Client Component : la chaine de
 * connexion contient le mot de passe de la base.
 *
 * **La connexion est paresseuse, et ce n'est pas un detail de style.**
 * `next build` evalue les modules des routes API a l'etape « Collecting page
 * data ». Lire `DATABASE_URL` au chargement du module faisait donc echouer le
 * build Docker, ou aucun `.env.local` n'existe : le build cassait alors qu'il
 * n'a besoin d'aucune base. Rencontre en Phase 1, invisible en local puisque le
 * fichier y est present. Voir .claude/docs/12-pieges.md.
 */

type Database = ReturnType<typeof createDatabase>;

/**
 * En developpement, Next recharge les modules a chaque edition. Sans ce cache
 * global, chaque rechargement ouvrirait un nouveau pool et la base finirait
 * par refuser les connexions.
 */
const globalForDb = globalThis as unknown as {
  queryClient?: postgres.Sql;
  database?: Database;
};

function createDatabase() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL manquante. Copier .env.example en .env.local, puis lancer `docker compose up -d db`.',
    );
  }

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

  return drizzle(queryClient, { schema });
}

function getDatabase(): Database {
  if (!globalForDb.database) {
    globalForDb.database = createDatabase();
  }
  return globalForDb.database;
}

/**
 * Meme surface d'API qu'un `db` classique : `db.select()`, `db.insert()`...
 * Le proxy ne sert qu'a retarder la creation du pool au premier appel reel.
 */
export const db = new Proxy({} as Database, {
  get(_target, property) {
    const database = getDatabase();
    const value = Reflect.get(database, property, database);
    return typeof value === 'function' ? value.bind(database) : value;
  },
});

export { schema };

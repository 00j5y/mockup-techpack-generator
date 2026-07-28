import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

/**
 * drizzle-kit evalue ce fichier dans un sous-processus Node qui n'herite pas du
 * chargement .env de Bun : il faut donc charger .env.local explicitement ici,
 * sinon `url` arrive undefined et la commande echoue.
 */
config({ path: '.env.local', quiet: true });

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error('DATABASE_URL manquante. Copier .env.example en .env.local.');
}

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url },
  // Les migrations sont versionnees et relues : jamais de push direct en base
  // sans passer par un fichier SQL committe.
  strict: true,
  verbose: true,
});

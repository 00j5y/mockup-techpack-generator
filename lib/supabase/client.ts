import { createBrowserClient } from '@supabase/ssr';

/**
 * Client Supabase pour les Client Components.
 * Utilise la cle anon, qui est publique par nature : la protection des donnees
 * repose sur la RLS, pas sur le secret de cette cle.
 *
 * Ne JAMAIS importer ce fichier depuis du code serveur privilegie, et ne jamais
 * y faire passer la cle service_role.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Client Supabase pour les Server Components, Server Actions et routes API.
 * Porte la session de l'utilisateur via les cookies : la RLS s'applique.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Appele depuis un Server Component : l'ecriture de cookie est
            // interdite ici. Le middleware rafraichit deja la session, on ignore.
          }
        },
      },
    },
  );
}

/**
 * Client administrateur, avec la cle service_role : contourne entierement la RLS.
 *
 * A n'utiliser que dans des routes API, pour les operations qui ne peuvent pas
 * passer par la session utilisateur (upload serveur, generation de techpack,
 * ecriture d'un visuel IA). Ne jamais l'appeler depuis un fichier importe par
 * un Client Component : la cle finirait dans le bundle navigateur.
 */
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY manquante');
  }

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRoleKey, {
    cookies: {
      getAll: () => [],
      setAll: () => {},
    },
  });
}

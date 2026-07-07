import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase côté SERVEUR uniquement, avec la clé service_role.
 * Elle bypass les policies RLS → permet l'upload dans le bucket "avatars"
 * même si l'utilisateur n'a pas de session Supabase (l'app utilise NextAuth).
 *
 * ⚠️ NE JAMAIS importer ce module dans un composant client :
 * la clé service_role ne doit jamais atterrir dans le bundle navigateur.
 */
let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase admin non configuré : SUPABASE_SERVICE_ROLE_KEY manquante"
    );
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

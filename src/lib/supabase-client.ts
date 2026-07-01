import { createClient } from "@supabase/supabase-js";

// Singleton browser-side client (NEXT_PUBLIC_ vars are exposed to the client bundle)
export function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

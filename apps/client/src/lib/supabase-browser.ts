import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null | undefined;

/**
 * Browser / shared Supabase client. Lazily created so SSR and `next start`
 * do not throw when NEXT_PUBLIC_* vars are missing (e.g. fresh clone or CI).
 */
export function getBrowserSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) {
    client = null;
    return null;
  }
  client = createClient(url, key);
  return client;
}

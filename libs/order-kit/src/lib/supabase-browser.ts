import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cachedClient: SupabaseClient | null = null;
let warned = false;

export function createBrowserSupabase(): SupabaseClient {
  if (cachedClient) return cachedClient;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if ((!supabaseUrl || !supabaseAnonKey) && !warned) {
    warned = true;
    console.warn(
      'Supabase URL or Anon Key is missing. Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.',
    );
  }
  cachedClient = createClient(supabaseUrl, supabaseAnonKey);
  return cachedClient;
}

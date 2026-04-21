import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from '@/lib/env';

let client: SupabaseClient | null | undefined;

/** Returns null when env is not configured (MVP: browse/track work without auth). */
export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const cfg = getSupabaseConfig();
  if (!cfg) {
    client = null;
    return client;
  }
  client = createClient(cfg.url, cfg.anonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  return client;
}

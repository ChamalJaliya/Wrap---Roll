import Constants from 'expo-constants';
import { Platform } from 'react-native';

function fromExtra(key: string): string | undefined {
  const extra = Constants.expoConfig?.extra as Record<string, string> | undefined;
  const v = extra?.[key]?.trim();
  return v || undefined;
}

/**
 * Default API URL when nothing is configured. Android emulator maps `10.0.2.2` to the
 * host machine; `127.0.0.1` there would mean the emulator itself → ECONNREFUSED.
 * Physical devices must set EXPO_PUBLIC_API_URL to your Mac/PC LAN IP (e.g. http://192.168.1.10:4000/api).
 */
function defaultApiBaseForDev(): string {
  if (Platform.OS === 'android') {
    return 'http://10.0.2.2:4000/api';
  }
  return 'http://127.0.0.1:4000/api';
}

/** Nest API base including `/api` prefix, e.g. `http://127.0.0.1:4000/api`. */
export function getApiBaseUrl(): string {
  const raw =
    process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ||
    fromExtra('apiUrl')?.replace(/\/$/, '') ||
    defaultApiBaseForDev();
  return raw;
}

export function getSupabaseConfig(): { url: string; anonKey: string } | null {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL || fromExtra('supabaseUrl');
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || fromExtra('supabaseAnonKey');
  if (!url?.trim() || !anonKey?.trim()) return null;
  return { url: url.trim(), anonKey: anonKey.trim() };
}

import { AuthError } from '@supabase/supabase-js';
import { SHOPPER_ROLE } from '@wrap-roll/contracts';
import { getBrowserSupabase } from '@/lib/supabase-browser';

function missingSupabaseError(): AuthError {
  return new AuthError(
    'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    500,
    'supabase_not_configured',
  );
}

export const AuthService = {
  signInWithMagicLink: async (
    email: string,
    metadata?: { full_name?: string; phone?: string },
  ) => {
    const supabase = getBrowserSupabase();
    if (!supabase) return { data: null, error: missingSupabaseError() };
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}${window.location.pathname.replace(/\/auth\/.*/, '/auth/callback')}`,
        data: { ...metadata, role: SHOPPER_ROLE },
      },
    });
    return { data, error };
  },

  signInWithPassword: async (email: string, password: string) => {
    const supabase = getBrowserSupabase();
    if (!supabase) return { data: null, error: missingSupabaseError() };
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  },

  signUpWithPassword: async (
    email: string,
    password: string,
    metadata?: { full_name?: string; phone?: string },
  ) => {
    const supabase = getBrowserSupabase();
    if (!supabase) return { data: null, error: missingSupabaseError() };
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { ...metadata, role: SHOPPER_ROLE },
      },
    });
    return { data, error };
  },

  // Backward compatibility for existing callers.
  signIn: async (email: string, metadata?: { full_name?: string; phone?: string }) => {
    return AuthService.signInWithMagicLink(email, metadata);
  },

  signOut: async () => {
    const supabase = getBrowserSupabase();
    if (!supabase) return { error: missingSupabaseError() };
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  getSession: async () => {
    const supabase = getBrowserSupabase();
    if (!supabase) return null;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session;
  },

  getUser: async () => {
    const supabase = getBrowserSupabase();
    if (!supabase) return null;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user;
  },
};

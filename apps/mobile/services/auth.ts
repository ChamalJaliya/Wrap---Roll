import { AuthError } from '@supabase/supabase-js';
import type { EmailOtpType } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { SHOPPER_ROLE } from '@wrap-roll/contracts';
import { getSupabase } from '@/lib/supabase';

function missingSupabaseError(): AuthError {
  return new AuthError(
    'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
    500,
    'supabase_not_configured',
  );
}

export const AuthService = {
  getAuthRedirectUrl: () => Linking.createURL('/auth/callback'),

  completeAuthFromUrl: async (url: string) => {
    const supabase = getSupabase();
    if (!supabase) return { error: missingSupabaseError() };

    const parsed = new URL(url);
    const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ''));
    const queryParams = new URLSearchParams(parsed.search);

    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');
    if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      return { error };
    }

    const code = queryParams.get('code');
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      return { error };
    }

    const tokenHash = queryParams.get('token_hash');
    const type = queryParams.get('type') as EmailOtpType | null;
    if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type,
      });
      return { error };
    }

    return { error: null };
  },

  signInWithMagicLink: async (
    email: string,
    metadata?: { full_name?: string; phone?: string },
  ) => {
    const supabase = getSupabase();
    if (!supabase) return { data: null, error: missingSupabaseError() };
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: Linking.createURL('/auth/callback'),
        data: { ...metadata, role: SHOPPER_ROLE },
      },
    });
    return { data, error };
  },

  signInWithPassword: async (email: string, password: string) => {
    const supabase = getSupabase();
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
    const supabase = getSupabase();
    if (!supabase) return { data: null, error: missingSupabaseError() };
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: Linking.createURL('/auth/callback'),
        data: { ...metadata, role: SHOPPER_ROLE },
      },
    });
    return { data, error };
  },

  signOut: async () => {
    const supabase = getSupabase();
    if (!supabase) return { error: missingSupabaseError() };
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  getSession: async () => {
    const supabase = getSupabase();
    if (!supabase) return null;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session;
  },

  /** Opens the system browser for Google OAuth; completes session via deep link to `/auth/callback`. */
  signInWithGoogle: async () => {
    const supabase = getSupabase();
    if (!supabase) return { error: missingSupabaseError() };
    const redirectTo = Linking.createURL('/auth/callback');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) return { error };
    if (!data?.url) {
      return { error: new AuthError('Could not start Google sign-in', 500, 'oauth_no_url') };
    }
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success' || !result.url) {
      return { error: null };
    }
    return AuthService.completeAuthFromUrl(result.url);
  },

  sendPasswordResetEmail: async (email: string) => {
    const supabase = getSupabase();
    if (!supabase) return { error: missingSupabaseError() };
    const redirectTo = Linking.createURL('/auth/callback');
    return supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
  },
};

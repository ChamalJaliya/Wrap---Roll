import { supabase } from './supabaseClient';

const missingConfigMessage =
  'Supabase client config missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.';
const hasSupabasePublicConfig = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export const AdminAuthService = {
  async ensureCsrfToken() {
    const response = await fetch('/api/auth/csrf', { method: 'GET' });
    const token = response.headers.get('x-csrf-token');
    if (!response.ok || !token) {
      return { token: null, error: new Error('Failed to initialize CSRF token') };
    }
    return { token, error: null };
  },

  hasPublicConfig() {
    return hasSupabasePublicConfig;
  },

  async signIn(email: string, returnTo = '/') {
    if (!hasSupabasePublicConfig) {
      return { data: null, error: new Error(missingConfigMessage) };
    }
    const next = encodeURIComponent(returnTo);
    const callbackUrl = `${window.location.origin}/auth/callback?next=${next}`;
    return supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl },
    });
  },

  async signOut() {
    const { token } = await this.ensureCsrfToken();
    await fetch('/api/auth/signout', {
      method: 'POST',
      headers: token ? { 'x-csrf-token': token } : undefined,
    });
    if (!hasSupabasePublicConfig) return { error: null };
    return supabase.auth.signOut();
  },

  async signInWithPassword(email: string, password: string) {
    const csrf = await this.ensureCsrfToken();
    if (csrf.error || !csrf.token) {
      return { data: null, error: csrf.error ?? new Error('Missing CSRF token') };
    }
    const response = await fetch('/api/auth/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf.token },
      body: JSON.stringify({ email, password }),
    });
    const data = await response.json();
    return {
      data: response.ok ? data : null,
      error: response.ok ? null : new Error(data?.error || 'Sign in failed'),
    };
  },

  async setCookieSession(accessToken: string, refreshToken: string) {
    const csrf = await this.ensureCsrfToken();
    if (csrf.error || !csrf.token) {
      return { error: csrf.error ?? new Error('Missing CSRF token') };
    }
    const response = await fetch('/api/auth/set-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf.token },
      body: JSON.stringify({ accessToken, refreshToken }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return { error: new Error(data?.error || 'Failed to persist cookie session') };
    }
    return { error: null };
  },

  async getCurrentUser() {
    const response = await fetch('/api/auth/session', { method: 'GET' });
    if (!response.ok) {
      return { user: null, role: '', accessToken: null, error: new Error('No session') };
    }
    const data = (await response.json()) as {
      user?: { id?: string; email?: string | null; role?: string } | null;
      accessToken?: string;
    };
    const accessToken = typeof data?.accessToken === 'string' ? data.accessToken : null;
    return {
      user: data.user ?? null,
      role: String(data?.user?.role ?? '').toUpperCase(),
      accessToken,
      error: null,
    };
  },

  async getSession() {
    const { user, accessToken, error } = await this.getCurrentUser();
    return { session: user ? ({ user, accessToken } as unknown) : null, error };
  },

  async getUserRole() {
    const { user, role, error } = await this.getCurrentUser();
    if (error || !user) return { role: '', user: null, error };
    return { role, user, error: null };
  },
};

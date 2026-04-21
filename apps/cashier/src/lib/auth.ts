const missingConfigMessage =
  'Supabase client config missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.';
const hasSupabasePublicConfig = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export type CashierSessionUser = {
  id: string;
  email?: string | null;
  role?: string;
};

export type CashierSession = {
  user: CashierSessionUser;
  accessToken?: string | null;
};

export const CashierAuthService = {
  async ensureCsrfToken() {
    const response = await fetch('/api/auth/csrf', { method: 'GET' });
    const token = response.headers.get('x-csrf-token');
    if (!response.ok || !token) {
      return { token: null, error: new Error('Failed to initialize CSRF token') };
    }
    return { token, error: null };
  },

  async signInWithPassword(email: string, password: string) {
    if (!hasSupabasePublicConfig) {
      return { data: null, error: new Error(missingConfigMessage) };
    }
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

  async signOut() {
    const csrf = await this.ensureCsrfToken();
    const response = await fetch('/api/auth/signout', {
      method: 'POST',
      headers: csrf.token ? { 'x-csrf-token': csrf.token } : undefined,
    });
    if (!response.ok) throw new Error('Sign out failed');
  },

  async getSession(): Promise<{
    session: CashierSession | null;
    role: string;
    error: Error | null;
  }> {
    const response = await fetch('/api/auth/session', { method: 'GET' });
    if (!response.ok) return { session: null, role: '', error: new Error('No session') };
    const data = (await response.json()) as {
      user?: CashierSessionUser | null;
      accessToken?: string;
    };
    const user = data?.user ?? null;
    const role = String(user?.role ?? '').toUpperCase();
    const accessToken = typeof data?.accessToken === 'string' ? data.accessToken : null;
    return { session: user ? { user, accessToken } : null, role, error: null };
  },
};


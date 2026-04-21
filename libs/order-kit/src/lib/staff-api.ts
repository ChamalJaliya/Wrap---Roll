export type StaffApiError = {
  status: number;
  message: string;
  raw?: unknown;
};

export type StaffApiResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; error: StaffApiError };

export const STAFF_APP_ROLES = ['ADMIN', 'CASHIER', 'KITCHEN', 'COURIER'] as const;
export type StaffAppRole = (typeof STAFF_APP_ROLES)[number];

export function resolveApiUrl(): string {
  // Nest global prefix is /api — base must include it (paths are like `/orders/queue`).
  return (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api').replace(/\/$/, '');
}

export async function getStaffAccessToken(
  getSession: () => Promise<{ data?: { session?: { access_token?: string } | null } }>,
): Promise<string | undefined> {
  const session = await getSession();
  return session?.data?.session?.access_token ?? undefined;
}

export function getSessionRole(session: {
  user?: { user_metadata?: Record<string, unknown> | null } | null;
} | null): string {
  return String(session?.user?.user_metadata?.role ?? '').toUpperCase();
}

export function hasAllowedStaffRole(
  session: { user?: { user_metadata?: Record<string, unknown> | null } | null } | null,
  allowed: readonly StaffAppRole[],
): boolean {
  const role = getSessionRole(session);
  return allowed.includes(role as StaffAppRole);
}

export async function staffFetchJson<T>(
  path: string,
  opts: {
    method?: string;
    token?: string;
    body?: unknown;
    timeoutMs?: number;
  } = {},
): Promise<StaffApiResult<T>> {
  const controller = new AbortController();
  const timeoutMs = opts.timeoutMs ?? 8000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${resolveApiUrl()}${path}`, {
      method: opts.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: controller.signal,
    });
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    if (!response.ok) {
      return {
        ok: false,
        error: {
          status: response.status,
          message:
            (payload && typeof payload === 'object' && 'message' in payload
              ? String((payload as Record<string, unknown>).message)
              : `Request failed (${response.status})`) || 'Request failed',
          raw: payload,
        },
      };
    }
    return { ok: true, data: payload as T, status: response.status };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network error';
    return { ok: false, error: { status: 0, message } };
  } finally {
    clearTimeout(timer);
  }
}

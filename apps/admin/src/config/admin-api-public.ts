import { z } from 'zod';

/**
 * How the Admin browser bundle reaches Nest:
 *
 * | Deployment | `NEXT_PUBLIC_API_URL` | Result |
 * |------------|------------------------|--------|
 * | Typical Next admin + proxy | unset or `/api/nest` | Same-origin `/api/nest/*` → App Route → Nest (session cookie). |
 * | Browser hits Nest directly | `http://127.0.0.1:4000/api` | Axios baseURL is that origin (CORS/cookies are your ops concern). |
 *
 * Relative values other than `/api/nest` are rejected so misconfigurations fail at startup instead of 404s at runtime.
 */

const optionalEnv = z.object({
  NEXT_PUBLIC_API_URL: z.string().optional(),
});

/** Ports where Next.js apps usually run — not Nest (`4000` / `4001`). */
const TYPICAL_NEXT_DEV_PORTS = new Set(['3000', '3001', '3002', '4200']);

/**
 * Reject `http://localhost:3001/api`–style values: that is this admin app’s `/api`, not Nest.
 * Axios then calls `/api/supervisor/...` and Next answers “Cannot PATCH …”.
 */
function assertUrlIsNotNextAdminInsteadOfNest(u: URL): void {
  const path = u.pathname.replace(/\/$/, '') || '/';
  const port = u.port || (u.protocol === 'https:' ? '443' : '80');
  if (path === '/api' && TYPICAL_NEXT_DEV_PORTS.has(port)) {
    throw new Error(
      `[admin] NEXT_PUBLIC_API_URL points to port ${port} with path /api — that matches this Next.js admin, not Nest. ` +
        `Remove NEXT_PUBLIC_API_URL (defaults to same-origin /api/nest), or set Nest explicitly, e.g. http://127.0.0.1:4000/api`,
    );
  }
}

function assertDirectHttpUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/$/, '');
  const urlResult = z.string().url().safeParse(trimmed);
  if (!urlResult.success) {
    throw new Error(
      `[admin] NEXT_PUBLIC_API_URL must be a valid http(s) URL when pointing at Nest directly. Got: ${JSON.stringify(raw)}`,
    );
  }
  const u = new URL(urlResult.data);
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new Error(
      `[admin] NEXT_PUBLIC_API_URL must use http: or https:. Got protocol: ${u.protocol}`,
    );
  }
  assertUrlIsNotNextAdminInsteadOfNest(u);
  return trimmed;
}

export function getAdminApiBaseUrl(): string {
  const raw = optionalEnv.parse({
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  }).NEXT_PUBLIC_API_URL;

  if (raw == null || raw.trim() === '') {
    return '/api/nest';
  }

  const normalized = raw.trim().replace(/\/$/, '');
  if (normalized === '/api/nest') {
    return '/api/nest';
  }

  if (/^https?:\/\//i.test(normalized)) {
    return assertDirectHttpUrl(normalized);
  }

  throw new Error(
    `[admin] Invalid NEXT_PUBLIC_API_URL: ${JSON.stringify(raw)}. ` +
      `Omit it (or use exactly "/api/nest") for the default Next proxy, or set a full URL to Nest (e.g. http://127.0.0.1:4000/api).`,
  );
}

/** Inlined at build time with other `NEXT_PUBLIC_*` vars. */
export const ADMIN_API_BASE_URL = getAdminApiBaseUrl();

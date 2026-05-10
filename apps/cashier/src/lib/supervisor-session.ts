export type SupervisorElevation = {
  token: string;
  expiresAt: string;
};

/**
 * Treat elevation as expired this many milliseconds before the server `expiresAt`
 * so we never send a token the API will reject (clock skew, network delay).
 */
export const SUPERVISOR_EXPIRY_SKEW_MS = 30_000;

export function parseElevationExpiryMs(expiresAt: string): number | null {
  const t = expiresAt.trim();
  if (!t) return null;
  const ms = Date.parse(t);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * When expiry cannot be parsed, treat as expired — fail closed.
 */
export function isElevationExpired(
  elevation: SupervisorElevation,
  nowMs = Date.now(),
  skewMs = SUPERVISOR_EXPIRY_SKEW_MS,
): boolean {
  const exp = parseElevationExpiryMs(elevation.expiresAt);
  if (exp === null) return true;
  return nowMs >= exp - skewMs;
}

export type SupervisorChallengeJson = {
  elevationToken?: unknown;
  expiresAt?: unknown;
  message?: unknown;
};

export function parseSupervisorChallengeResponse(data: unknown): {
  ok: true;
  elevationToken: string;
  expiresAt: string;
} | {
  ok: false;
  message?: string;
} {
  if (typeof data !== 'object' || data === null) {
    return { ok: false };
  }
  const r = data as SupervisorChallengeJson;
  const token =
    typeof r.elevationToken === 'string' && r.elevationToken.trim()
      ? r.elevationToken.trim()
      : '';
  if (!token) {
    const msg = typeof r.message === 'string' ? r.message : undefined;
    return { ok: false, message: msg };
  }
  const expiresAt =
    typeof r.expiresAt === 'string'
      ? r.expiresAt
      : r.expiresAt != null
        ? String(r.expiresAt)
        : '';
  return { ok: true, elevationToken: token, expiresAt };
}

export async function readJsonUnknown(res: Response): Promise<unknown> {
  try {
    const text = await res.text();
    if (!text.trim()) return {};
    return JSON.parse(text) as unknown;
  } catch {
    return {};
  }
}

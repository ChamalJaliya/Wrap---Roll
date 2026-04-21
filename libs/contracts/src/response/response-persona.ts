import type { StaffRole } from '../staff.contracts';

/** API response projection for queue payloads (least-privilege JSON). */
export type ResponsePersona = 'ops' | 'kitchen' | 'courier';

const OPS_ROLES = new Set<string>(['ADMIN', 'CASHIER']);

/**
 * Maps JWT staff role to queue response persona.
 * Non-staff or unknown roles default to `ops` (full queue shape) — callers should enforce RBAC first.
 */
export function staffRoleToResponsePersona(role: string | undefined): ResponsePersona {
  if (role === 'KITCHEN') return 'kitchen';
  if (role === 'COURIER') return 'courier';
  if (role && OPS_ROLES.has(role)) return 'ops';
  return 'ops';
}

export function isStaffRole(value: unknown): value is StaffRole {
  return (
    value === 'ADMIN' ||
    value === 'CASHIER' ||
    value === 'KITCHEN' ||
    value === 'COURIER'
  );
}

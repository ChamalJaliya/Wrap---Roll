import type { StaffRole } from '../staff.contracts';
/** API response projection for queue payloads (least-privilege JSON). */
export type ResponsePersona = 'ops' | 'kitchen' | 'courier';
/**
 * Maps JWT staff role to queue response persona.
 * Non-staff or unknown roles default to `ops` (full queue shape) — callers should enforce RBAC first.
 */
export declare function staffRoleToResponsePersona(role: string | undefined): ResponsePersona;
export declare function isStaffRole(value: unknown): value is StaffRole;
//# sourceMappingURL=response-persona.d.ts.map
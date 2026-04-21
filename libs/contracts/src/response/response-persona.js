"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.staffRoleToResponsePersona = staffRoleToResponsePersona;
exports.isStaffRole = isStaffRole;
const OPS_ROLES = new Set(['ADMIN', 'CASHIER']);
/**
 * Maps JWT staff role to queue response persona.
 * Non-staff or unknown roles default to `ops` (full queue shape) — callers should enforce RBAC first.
 */
function staffRoleToResponsePersona(role) {
    if (role === 'KITCHEN')
        return 'kitchen';
    if (role === 'COURIER')
        return 'courier';
    if (role && OPS_ROLES.has(role))
        return 'ops';
    return 'ops';
}
function isStaffRole(value) {
    return (value === 'ADMIN' ||
        value === 'CASHIER' ||
        value === 'KITCHEN' ||
        value === 'COURIER');
}
//# sourceMappingURL=response-persona.js.map
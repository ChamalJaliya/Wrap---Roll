import type { ResponsePersona } from './response-persona';
/** Keys courier queue JSON should not expose (gateway ids, internal pricing codes). */
export declare const COURIER_QUEUE_FORBIDDEN_KEYS: readonly ["discountCode", "discountAmount", "transactionId", "staffScheduleOverride"];
export declare function listForbiddenKeysPresent(keys: readonly string[], obj: object): string[];
export declare function kitchenQueueForbiddenKeysPresent(obj: object): string[];
export declare function courierQueueForbiddenKeysPresent(obj: object): string[];
/**
 * Best-effort Zod check for projected rows. Used in non-production or when forced via env in API.
 * Returns human-readable issues (flattened) when validation fails.
 */
export declare function describeQueueProjectionZodIssues(persona: Exclude<ResponsePersona, 'ops'>, body: unknown): string[];
//# sourceMappingURL=queue-projection-runtime.d.ts.map
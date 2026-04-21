import type { ResponsePersona } from './response-persona';
import { CourierQueueOrderSchema, KitchenQueueOrderSchema } from './order-queue-projection.schema';
import { KITCHEN_QUEUE_FORBIDDEN_KEYS } from './order-queue-projection';

/** Keys courier queue JSON should not expose (gateway ids, internal pricing codes). */
export const COURIER_QUEUE_FORBIDDEN_KEYS = [
  'discountCode',
  'discountAmount',
  'transactionId',
  'staffScheduleOverride',
] as const;

export function listForbiddenKeysPresent(
  keys: readonly string[],
  obj: object,
): string[] {
  return keys.filter((k) => Object.prototype.hasOwnProperty.call(obj, k));
}

export function kitchenQueueForbiddenKeysPresent(obj: object): string[] {
  return listForbiddenKeysPresent([...KITCHEN_QUEUE_FORBIDDEN_KEYS], obj);
}

export function courierQueueForbiddenKeysPresent(obj: object): string[] {
  return listForbiddenKeysPresent([...COURIER_QUEUE_FORBIDDEN_KEYS], obj);
}

/**
 * Best-effort Zod check for projected rows. Used in non-production or when forced via env in API.
 * Returns human-readable issues (flattened) when validation fails.
 */
export function describeQueueProjectionZodIssues(
  persona: Exclude<ResponsePersona, 'ops'>,
  body: unknown,
): string[] {
  if (persona === 'kitchen') {
    const r = KitchenQueueOrderSchema.safeParse(body);
    return r.success ? [] : [r.error.message];
  }
  const r = CourierQueueOrderSchema.safeParse(body);
  return r.success ? [] : [r.error.message];
}

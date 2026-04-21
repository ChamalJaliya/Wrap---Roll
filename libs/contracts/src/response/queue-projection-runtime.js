"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COURIER_QUEUE_FORBIDDEN_KEYS = void 0;
exports.listForbiddenKeysPresent = listForbiddenKeysPresent;
exports.kitchenQueueForbiddenKeysPresent = kitchenQueueForbiddenKeysPresent;
exports.courierQueueForbiddenKeysPresent = courierQueueForbiddenKeysPresent;
exports.describeQueueProjectionZodIssues = describeQueueProjectionZodIssues;
const order_queue_projection_schema_1 = require("./order-queue-projection.schema");
const order_queue_projection_1 = require("./order-queue-projection");
/** Keys courier queue JSON should not expose (gateway ids, internal pricing codes). */
exports.COURIER_QUEUE_FORBIDDEN_KEYS = [
    'discountCode',
    'discountAmount',
    'transactionId',
    'staffScheduleOverride',
];
function listForbiddenKeysPresent(keys, obj) {
    return keys.filter((k) => Object.prototype.hasOwnProperty.call(obj, k));
}
function kitchenQueueForbiddenKeysPresent(obj) {
    return listForbiddenKeysPresent([...order_queue_projection_1.KITCHEN_QUEUE_FORBIDDEN_KEYS], obj);
}
function courierQueueForbiddenKeysPresent(obj) {
    return listForbiddenKeysPresent([...exports.COURIER_QUEUE_FORBIDDEN_KEYS], obj);
}
/**
 * Best-effort Zod check for projected rows. Used in non-production or when forced via env in API.
 * Returns human-readable issues (flattened) when validation fails.
 */
function describeQueueProjectionZodIssues(persona, body) {
    if (persona === 'kitchen') {
        const r = order_queue_projection_schema_1.KitchenQueueOrderSchema.safeParse(body);
        return r.success ? [] : [r.error.message];
    }
    const r = order_queue_projection_schema_1.CourierQueueOrderSchema.safeParse(body);
    return r.success ? [] : [r.error.message];
}
//# sourceMappingURL=queue-projection-runtime.js.map
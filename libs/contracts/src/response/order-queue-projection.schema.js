"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CourierQueueOrderSchema = exports.KitchenQueueOrderSchema = void 0;
const zod_1 = require("zod");
const order_schema_1 = require("../order.schema");
const ApiNumericSchema = zod_1.z.union([zod_1.z.number(), zod_1.z.string(), zod_1.z.custom()]);
const KitchenQueueOrderItemSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    quantity: zod_1.z.number(),
    modifiersJson: zod_1.z.unknown().optional(),
    menuItemId: zod_1.z.string().optional(),
});
const QueueMoveBlockedReasonSchema = zod_1.z.enum([
    'ROLE_FORBIDDEN',
    'INVALID_TRANSITION',
    'PAYMENT_NOT_COMPLETED',
    'COURIER_NOT_ASSIGNED',
    'NOT_DELIVERY_ORDER',
    'KITCHEN_POLICY_BLOCK',
    'SCHEDULE_GATE',
    'TERMINAL_STATE',
    'UNKNOWN',
]);
/** Runtime shape check for KDS queue rows (strict: unknown keys rejected). */
exports.KitchenQueueOrderSchema = zod_1.z
    .object({
    id: zod_1.z.string(),
    status: order_schema_1.OrderStatusSchema,
    source: zod_1.z.enum(order_schema_1.ORDER_SOURCES).optional(),
    fulfillmentType: zod_1.z.enum(order_schema_1.FULFILLMENT_TYPES).optional(),
    tableNumber: zod_1.z.string().nullable().optional(),
    itemCount: zod_1.z.number().optional(),
    items: zod_1.z.array(KitchenQueueOrderItemSchema).optional(),
    estimatedReadyTime: zod_1.z.union([zod_1.z.string(), zod_1.z.date()]).nullable().optional(),
    customer: zod_1.z
        .object({
        name: zod_1.z.string().nullable().optional(),
    })
        .nullable()
        .optional(),
    placedAt: zod_1.z.union([zod_1.z.string(), zod_1.z.date()]).optional(),
    updatedAt: zod_1.z.union([zod_1.z.string(), zod_1.z.date()]).optional(),
    kitchenPriority: zod_1.z.enum(['normal', 'rush']).optional(),
    printedAt: zod_1.z.union([zod_1.z.string(), zod_1.z.date()]).nullable().optional(),
    readyAt: zod_1.z.union([zod_1.z.string(), zod_1.z.date()]).nullable().optional(),
    kitchenEligible: zod_1.z.boolean().optional(),
    releaseReason: zod_1.z
        .enum([
        'PREPAID',
        'TAKEAWAY_PAY_LATER',
        'DINE_IN_POSTPAY',
        'DELIVERY_PAY_LATER',
        'STAFF_PAY_LATER',
        'MANUAL_OVERRIDE',
        'SCHEDULED_PENDING',
    ])
        .nullable()
        .optional(),
    kitchenReleaseAt: zod_1.z.union([zod_1.z.string(), zod_1.z.date()]).nullable().optional(),
    priorityDeadlineAt: zod_1.z.union([zod_1.z.string(), zod_1.z.date()]).optional(),
    slaBucket: zod_1.z.enum(['overdue', 'due_soon', 'ok']).optional(),
    allowedNextStatuses: zod_1.z.array(order_schema_1.OrderStatusSchema).optional(),
    actions: zod_1.z
        .object({
        canMove: zod_1.z.boolean(),
        canAssignCourier: zod_1.z.boolean(),
        canCollectPayment: zod_1.z.boolean(),
        canMarkDelivered: zod_1.z.boolean(),
        canVoid: zod_1.z.boolean(),
        canRefund: zod_1.z.boolean(),
    })
        .optional(),
    blockedReasonsByStatus: zod_1.z
        .record(zod_1.z.string(), QueueMoveBlockedReasonSchema.nullable())
        .optional(),
})
    .strict();
const CourierQueueOrderItemSchema = zod_1.z.object({
    id: zod_1.z.string(),
    name: zod_1.z.string(),
    quantity: zod_1.z.number(),
    modifiersJson: zod_1.z.unknown().optional(),
});
exports.CourierQueueOrderSchema = zod_1.z
    .object({
    id: zod_1.z.string(),
    status: order_schema_1.OrderStatusSchema,
    source: zod_1.z.enum(order_schema_1.ORDER_SOURCES).optional(),
    paymentStatus: zod_1.z.enum(order_schema_1.PAYMENT_STATUSES),
    paymentMethod: zod_1.z.enum(order_schema_1.PAYMENT_METHODS),
    paymentCollection: zod_1.z.unknown().nullable().optional(),
    fulfillmentType: zod_1.z.enum(order_schema_1.FULFILLMENT_TYPES).optional(),
    customer: zod_1.z
        .object({
        id: zod_1.z.string().nullable().optional(),
        name: zod_1.z.string().nullable().optional(),
        phone: zod_1.z.string().nullable().optional(),
    })
        .nullable()
        .optional(),
    subtotal: ApiNumericSchema.optional(),
    tax: ApiNumericSchema.optional(),
    deliveryFee: ApiNumericSchema.optional(),
    total: ApiNumericSchema,
    itemCount: zod_1.z.number().optional(),
    items: zod_1.z.array(CourierQueueOrderItemSchema).optional(),
    deliveryAddress: zod_1.z.string().nullable().optional(),
    deliveryLatitude: ApiNumericSchema.nullable().optional(),
    deliveryLongitude: ApiNumericSchema.nullable().optional(),
    deliveryDistanceKm: ApiNumericSchema.nullable().optional(),
    deliveryGeoSource: zod_1.z.string().nullable().optional(),
    estimatedReadyTime: zod_1.z.union([zod_1.z.string(), zod_1.z.date()]).nullable().optional(),
    courierId: zod_1.z.string().nullable().optional(),
    placedAt: zod_1.z.union([zod_1.z.string(), zod_1.z.date()]).optional(),
    updatedAt: zod_1.z.union([zod_1.z.string(), zod_1.z.date()]).optional(),
    kitchenPriority: zod_1.z.enum(['normal', 'rush']).optional(),
    paymentRisk: zod_1.z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
    allowedNextStatuses: zod_1.z.array(order_schema_1.OrderStatusSchema).optional(),
    actions: zod_1.z
        .object({
        canMove: zod_1.z.boolean(),
        canAssignCourier: zod_1.z.boolean(),
        canCollectPayment: zod_1.z.boolean(),
        canMarkDelivered: zod_1.z.boolean(),
        canVoid: zod_1.z.boolean(),
        canRefund: zod_1.z.boolean(),
    })
        .optional(),
    blockedReasonsByStatus: zod_1.z
        .record(zod_1.z.string(), QueueMoveBlockedReasonSchema.nullable())
        .optional(),
})
    .strict();
//# sourceMappingURL=order-queue-projection.schema.js.map
import { z } from 'zod';
/** Runtime shape check for KDS queue rows (strict: unknown keys rejected). */
export declare const KitchenQueueOrderSchema: z.ZodObject<{
    id: z.ZodString;
    status: z.ZodEnum<{
        placed: "placed";
        paid: "paid";
        in_kitchen: "in_kitchen";
        ready: "ready";
        in_transit: "in_transit";
        delivered: "delivered";
        cancelled: "cancelled";
        voided: "voided";
        refunded: "refunded";
    }>;
    source: z.ZodOptional<z.ZodEnum<{
        client_web: "client_web";
        client_mobile: "client_mobile";
        cashier_pos: "cashier_pos";
        cashier_pos_offline: "cashier_pos_offline";
    }>>;
    fulfillmentType: z.ZodOptional<z.ZodEnum<{
        dine_in: "dine_in";
        takeaway: "takeaway";
        delivery: "delivery";
    }>>;
    tableNumber: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    itemCount: z.ZodOptional<z.ZodNumber>;
    items: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        quantity: z.ZodNumber;
        modifiersJson: z.ZodOptional<z.ZodUnknown>;
        menuItemId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>>;
    estimatedReadyTime: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodDate]>>>;
    customer: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>>>;
    placedAt: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodDate]>>;
    updatedAt: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodDate]>>;
    kitchenPriority: z.ZodOptional<z.ZodEnum<{
        normal: "normal";
        rush: "rush";
    }>>;
    printedAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodDate]>>>;
    readyAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodDate]>>>;
    kitchenEligible: z.ZodOptional<z.ZodBoolean>;
    releaseReason: z.ZodOptional<z.ZodNullable<z.ZodEnum<{
        PREPAID: "PREPAID";
        TAKEAWAY_PAY_LATER: "TAKEAWAY_PAY_LATER";
        DINE_IN_POSTPAY: "DINE_IN_POSTPAY";
        DELIVERY_PAY_LATER: "DELIVERY_PAY_LATER";
        STAFF_PAY_LATER: "STAFF_PAY_LATER";
        MANUAL_OVERRIDE: "MANUAL_OVERRIDE";
        SCHEDULED_PENDING: "SCHEDULED_PENDING";
    }>>>;
    kitchenReleaseAt: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodDate]>>>;
    priorityDeadlineAt: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodDate]>>;
    slaBucket: z.ZodOptional<z.ZodEnum<{
        overdue: "overdue";
        due_soon: "due_soon";
        ok: "ok";
    }>>;
    allowedNextStatuses: z.ZodOptional<z.ZodArray<z.ZodEnum<{
        placed: "placed";
        paid: "paid";
        in_kitchen: "in_kitchen";
        ready: "ready";
        in_transit: "in_transit";
        delivered: "delivered";
        cancelled: "cancelled";
        voided: "voided";
        refunded: "refunded";
    }>>>;
    actions: z.ZodOptional<z.ZodObject<{
        canMove: z.ZodBoolean;
        canAssignCourier: z.ZodBoolean;
        canCollectPayment: z.ZodBoolean;
        canMarkDelivered: z.ZodBoolean;
        canVoid: z.ZodBoolean;
        canRefund: z.ZodBoolean;
    }, z.core.$strip>>;
    blockedReasonsByStatus: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNullable<z.ZodEnum<{
        ROLE_FORBIDDEN: "ROLE_FORBIDDEN";
        INVALID_TRANSITION: "INVALID_TRANSITION";
        PAYMENT_NOT_COMPLETED: "PAYMENT_NOT_COMPLETED";
        COURIER_NOT_ASSIGNED: "COURIER_NOT_ASSIGNED";
        NOT_DELIVERY_ORDER: "NOT_DELIVERY_ORDER";
        KITCHEN_POLICY_BLOCK: "KITCHEN_POLICY_BLOCK";
        SCHEDULE_GATE: "SCHEDULE_GATE";
        TERMINAL_STATE: "TERMINAL_STATE";
        UNKNOWN: "UNKNOWN";
    }>>>>;
}, z.core.$strict>;
export declare const CourierQueueOrderSchema: z.ZodObject<{
    id: z.ZodString;
    status: z.ZodEnum<{
        placed: "placed";
        paid: "paid";
        in_kitchen: "in_kitchen";
        ready: "ready";
        in_transit: "in_transit";
        delivered: "delivered";
        cancelled: "cancelled";
        voided: "voided";
        refunded: "refunded";
    }>;
    source: z.ZodOptional<z.ZodEnum<{
        client_web: "client_web";
        client_mobile: "client_mobile";
        cashier_pos: "cashier_pos";
        cashier_pos_offline: "cashier_pos_offline";
    }>>;
    paymentStatus: z.ZodEnum<{
        refunded: "refunded";
        pending: "pending";
        completed: "completed";
        failed: "failed";
    }>;
    paymentMethod: z.ZodEnum<{
        cash: "cash";
        card: "card";
        payhere: "payhere";
        online: "online";
    }>;
    paymentCollection: z.ZodOptional<z.ZodNullable<z.ZodUnknown>>;
    fulfillmentType: z.ZodOptional<z.ZodEnum<{
        dine_in: "dine_in";
        takeaway: "takeaway";
        delivery: "delivery";
    }>>;
    customer: z.ZodOptional<z.ZodNullable<z.ZodObject<{
        id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        name: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        phone: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, z.core.$strip>>>;
    subtotal: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString, z.ZodCustom<{
        toString(): string;
    }, {
        toString(): string;
    }>]>>;
    tax: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString, z.ZodCustom<{
        toString(): string;
    }, {
        toString(): string;
    }>]>>;
    deliveryFee: z.ZodOptional<z.ZodUnion<readonly [z.ZodNumber, z.ZodString, z.ZodCustom<{
        toString(): string;
    }, {
        toString(): string;
    }>]>>;
    total: z.ZodUnion<readonly [z.ZodNumber, z.ZodString, z.ZodCustom<{
        toString(): string;
    }, {
        toString(): string;
    }>]>;
    itemCount: z.ZodOptional<z.ZodNumber>;
    items: z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        quantity: z.ZodNumber;
        modifiersJson: z.ZodOptional<z.ZodUnknown>;
    }, z.core.$strip>>>;
    deliveryAddress: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    deliveryLatitude: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodNumber, z.ZodString, z.ZodCustom<{
        toString(): string;
    }, {
        toString(): string;
    }>]>>>;
    deliveryLongitude: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodNumber, z.ZodString, z.ZodCustom<{
        toString(): string;
    }, {
        toString(): string;
    }>]>>>;
    deliveryDistanceKm: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodNumber, z.ZodString, z.ZodCustom<{
        toString(): string;
    }, {
        toString(): string;
    }>]>>>;
    deliveryGeoSource: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    estimatedReadyTime: z.ZodOptional<z.ZodNullable<z.ZodUnion<readonly [z.ZodString, z.ZodDate]>>>;
    courierId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    placedAt: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodDate]>>;
    updatedAt: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodDate]>>;
    kitchenPriority: z.ZodOptional<z.ZodEnum<{
        normal: "normal";
        rush: "rush";
    }>>;
    paymentRisk: z.ZodOptional<z.ZodEnum<{
        LOW: "LOW";
        MEDIUM: "MEDIUM";
        HIGH: "HIGH";
    }>>;
    allowedNextStatuses: z.ZodOptional<z.ZodArray<z.ZodEnum<{
        placed: "placed";
        paid: "paid";
        in_kitchen: "in_kitchen";
        ready: "ready";
        in_transit: "in_transit";
        delivered: "delivered";
        cancelled: "cancelled";
        voided: "voided";
        refunded: "refunded";
    }>>>;
    actions: z.ZodOptional<z.ZodObject<{
        canMove: z.ZodBoolean;
        canAssignCourier: z.ZodBoolean;
        canCollectPayment: z.ZodBoolean;
        canMarkDelivered: z.ZodBoolean;
        canVoid: z.ZodBoolean;
        canRefund: z.ZodBoolean;
    }, z.core.$strip>>;
    blockedReasonsByStatus: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodNullable<z.ZodEnum<{
        ROLE_FORBIDDEN: "ROLE_FORBIDDEN";
        INVALID_TRANSITION: "INVALID_TRANSITION";
        PAYMENT_NOT_COMPLETED: "PAYMENT_NOT_COMPLETED";
        COURIER_NOT_ASSIGNED: "COURIER_NOT_ASSIGNED";
        NOT_DELIVERY_ORDER: "NOT_DELIVERY_ORDER";
        KITCHEN_POLICY_BLOCK: "KITCHEN_POLICY_BLOCK";
        SCHEDULE_GATE: "SCHEDULE_GATE";
        TERMINAL_STATE: "TERMINAL_STATE";
        UNKNOWN: "UNKNOWN";
    }>>>>;
}, z.core.$strict>;
//# sourceMappingURL=order-queue-projection.schema.d.ts.map
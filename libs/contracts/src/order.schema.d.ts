import { z } from 'zod';
export declare const ORDER_STATUSES: readonly ["placed", "paid", "in_kitchen", "ready", "in_transit", "delivered", "cancelled", "voided", "refunded"];
export declare const ORDER_SOURCES: readonly ["client_web", "client_mobile", "cashier_pos", "cashier_pos_offline"];
export declare const PAYMENT_METHODS: readonly ["cash", "card", "payhere", "online"];
export declare const PAYMENT_STATUSES: readonly ["pending", "completed", "failed", "refunded"];
export declare const FULFILLMENT_TYPES: readonly ["dine_in", "takeaway", "delivery"];
export declare const OrderStatusSchema: z.ZodEnum<{
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
export type OrderStatus = z.infer<typeof OrderStatusSchema>;
export declare const AvailabilitySchema: z.ZodEnum<{
    available: "available";
    sold_out: "sold_out";
    limited: "limited";
}>;
export type Availability = z.infer<typeof AvailabilitySchema>;
export declare const WrapOrderSchema: z.ZodObject<{
    orderId: z.ZodString;
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
    source: z.ZodEnum<{
        client_web: "client_web";
        client_mobile: "client_mobile";
        cashier_pos: "cashier_pos";
        cashier_pos_offline: "cashier_pos_offline";
    }>;
    placedAt: z.ZodString;
    updatedAt: z.ZodString;
    customer: z.ZodObject<{
        customerId: z.ZodOptional<z.ZodString>;
        name: z.ZodString;
        phone: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    items: z.ZodArray<z.ZodObject<{
        lineItemId: z.ZodString;
        wrapId: z.ZodString;
        name: z.ZodString;
        availability: z.ZodDefault<z.ZodEnum<{
            available: "available";
            sold_out: "sold_out";
            limited: "limited";
        }>>;
        quantity: z.ZodNumber;
        unitPrice: z.ZodNumber;
        modifiers: z.ZodObject<{
            base: z.ZodString;
            protein: z.ZodString;
            toppings: z.ZodArray<z.ZodString>;
            sauces: z.ZodArray<z.ZodString>;
            extras: z.ZodOptional<z.ZodArray<z.ZodObject<{
                name: z.ZodString;
                price: z.ZodNumber;
            }, z.core.$strip>>>;
            notes: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>;
        lineTotal: z.ZodNumber;
    }, z.core.$strip>>;
    pricing: z.ZodObject<{
        subtotal: z.ZodNumber;
        discountCode: z.ZodOptional<z.ZodString>;
        discountAmount: z.ZodDefault<z.ZodNumber>;
        tax: z.ZodNumber;
        deliveryFee: z.ZodDefault<z.ZodNumber>;
        total: z.ZodNumber;
    }, z.core.$strip>;
    payment: z.ZodObject<{
        method: z.ZodEnum<{
            cash: "cash";
            card: "card";
            payhere: "payhere";
            online: "online";
        }>;
        status: z.ZodEnum<{
            refunded: "refunded";
            pending: "pending";
            completed: "completed";
            failed: "failed";
        }>;
        transactionId: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    fulfillment: z.ZodObject<{
        type: z.ZodEnum<{
            dine_in: "dine_in";
            takeaway: "takeaway";
            delivery: "delivery";
        }>;
        tableNumber: z.ZodOptional<z.ZodString>;
        deliveryAddress: z.ZodOptional<z.ZodString>;
        deliveryLatitude: z.ZodOptional<z.ZodNumber>;
        deliveryLongitude: z.ZodOptional<z.ZodNumber>;
        courierId: z.ZodOptional<z.ZodString>;
        estimatedReadyTime: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
    kitchen: z.ZodObject<{
        priority: z.ZodDefault<z.ZodEnum<{
            normal: "normal";
            rush: "rush";
        }>>;
        printedAt: z.ZodOptional<z.ZodString>;
        readyAt: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>;
}, z.core.$strip>;
export type WrapOrder = z.infer<typeof WrapOrderSchema>;
export type WrapOrderItem = WrapOrder['items'][number];
//# sourceMappingURL=order.schema.d.ts.map
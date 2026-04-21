"use strict";
// libs/contracts/src/order.schema.ts
// ⛔ LSA-ONLY — Single source of truth for WrapOrder across all 5 domains.
// DO NOT MODIFY without LSA approval.
Object.defineProperty(exports, "__esModule", { value: true });
exports.WrapOrderSchema = exports.AvailabilitySchema = exports.OrderStatusSchema = exports.FULFILLMENT_TYPES = exports.PAYMENT_STATUSES = exports.PAYMENT_METHODS = exports.ORDER_SOURCES = exports.ORDER_STATUSES = void 0;
const zod_1 = require("zod");
exports.ORDER_STATUSES = [
    'placed',
    'paid',
    'in_kitchen',
    'ready',
    'in_transit',
    'delivered',
    'cancelled',
    'voided',
    'refunded',
];
exports.ORDER_SOURCES = [
    'client_web',
    'client_mobile',
    'cashier_pos',
    'cashier_pos_offline',
];
exports.PAYMENT_METHODS = ['cash', 'card', 'payhere', 'online'];
exports.PAYMENT_STATUSES = ['pending', 'completed', 'failed', 'refunded'];
exports.FULFILLMENT_TYPES = ['dine_in', 'takeaway', 'delivery'];
// ─── Order Status State Machine ───────────────────────────────────────────────
exports.OrderStatusSchema = zod_1.z.enum(exports.ORDER_STATUSES);
// ─── Item Availability (managed by apps/admin, Sprint S5) ────────────────────
exports.AvailabilitySchema = zod_1.z.enum([
    'available',
    'sold_out',
    'limited',
]);
// ─── WrapOrder Canonical Schema ───────────────────────────────────────────────
exports.WrapOrderSchema = zod_1.z.object({
    orderId: zod_1.z.string().uuid(),
    status: exports.OrderStatusSchema,
    source: zod_1.z.enum(exports.ORDER_SOURCES),
    placedAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime(),
    // ── Customer (single-branch; no branchId) ──────────────────────────────────
    customer: zod_1.z.object({
        customerId: zod_1.z.string().uuid().optional(), // null for walk-in / guest / POS
        name: zod_1.z.string(),
        phone: zod_1.z.string().optional(),
    }),
    // ── Line Items ─────────────────────────────────────────────────────────────
    items: zod_1.z.array(zod_1.z.object({
        lineItemId: zod_1.z.string().uuid(),
        wrapId: zod_1.z.string().uuid(), // FK → MenuItem
        name: zod_1.z.string(), // Denormalized for receipt/KDS printing
        // 📦 Item-level availability — UX flag, managed in apps/admin (Sprint S5)
        // Broadcast via Supabase Realtime to client + cashier
        availability: exports.AvailabilitySchema.default('available'),
        quantity: zod_1.z.number().int().min(1),
        unitPrice: zod_1.z.number().nonnegative(), // LKR
        // 🌯 Wrap Modifier Logic (Base → Protein → Toppings → Sauces)
        modifiers: zod_1.z.object({
            base: zod_1.z.string(), // e.g. "Whole Wheat", "Spinach Tortilla"
            protein: zod_1.z.string(), // e.g. "Grilled Chicken", "Falafel"
            toppings: zod_1.z.array(zod_1.z.string()), // e.g. ["Lettuce", "Tomato", "Jalapeño"]
            sauces: zod_1.z.array(zod_1.z.string()), // e.g. ["Garlic Aioli", "Sriracha"]
            extras: zod_1.z.array(zod_1.z.object({
                name: zod_1.z.string(),
                price: zod_1.z.number().nonnegative(), // LKR — chargeable add-ons
            })).optional(),
            notes: zod_1.z.string().max(200).optional(),
        }),
        lineTotal: zod_1.z.number().nonnegative(), // (unitPrice + extras) × quantity — LKR
    })),
    // ── Pricing ────────────────────────────────────────────────────────────────
    pricing: zod_1.z.object({
        subtotal: zod_1.z.number().nonnegative(), // LKR
        discountCode: zod_1.z.string().optional(),
        discountAmount: zod_1.z.number().nonnegative().default(0), // LKR
        tax: zod_1.z.number().nonnegative(), // LKR
        deliveryFee: zod_1.z.number().nonnegative().default(0), // LKR
        total: zod_1.z.number().nonnegative(), // LKR
    }),
    // ── Payment ────────────────────────────────────────────────────────────────
    // Offline constraint: method MUST be "cash" when source = "cashier_pos_offline"
    // Enforced in apps/cashier Zustand store (NOT in this schema — contracts are gateway-agnostic)
    payment: zod_1.z.object({
        method: zod_1.z.enum(exports.PAYMENT_METHODS),
        status: zod_1.z.enum(exports.PAYMENT_STATUSES),
        transactionId: zod_1.z.string().optional(),
    }),
    // ── Fulfillment ────────────────────────────────────────────────────────────
    fulfillment: zod_1.z.object({
        type: zod_1.z.enum(exports.FULFILLMENT_TYPES),
        tableNumber: zod_1.z.string().optional(), // dine_in only
        deliveryAddress: zod_1.z.string().optional(), // delivery only
        /** Drop-off coordinates for distance-based delivery fees (client_web). */
        deliveryLatitude: zod_1.z.number().min(-90).max(90).optional(),
        deliveryLongitude: zod_1.z.number().min(-180).max(180).optional(),
        courierId: zod_1.z.string().uuid().optional(), // in-house courier assigned
        estimatedReadyTime: zod_1.z.string().datetime().optional(),
    }),
    // ── Kitchen ────────────────────────────────────────────────────────────────
    kitchen: zod_1.z.object({
        priority: zod_1.z.enum(['normal', 'rush']).default('normal'),
        printedAt: zod_1.z.string().datetime().optional(), // ESC/POS KDS ticket timestamp
        readyAt: zod_1.z.string().datetime().optional(),
    }),
});
//# sourceMappingURL=order.schema.js.map
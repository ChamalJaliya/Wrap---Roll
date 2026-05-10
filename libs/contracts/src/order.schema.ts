// libs/contracts/src/order.schema.ts
// ⛔ LSA-ONLY — Single source of truth for WrapOrder across all 5 domains.
// DO NOT MODIFY without LSA approval.

import { z } from 'zod';

export const ORDER_STATUSES = [
  'placed',
  'paid',
  'in_kitchen',
  'ready',
  'in_transit',
  'delivered',
  'cancelled',
  'voided',
  'refunded',
] as const;
export const ORDER_SOURCES = [
  'client_web',
  'client_mobile',
  'cashier_pos',
  'cashier_pos_offline',
] as const;
export const PAYMENT_METHODS = ['cash', 'card', 'payhere', 'online'] as const;
export const PAYMENT_STATUSES = ['pending', 'completed', 'failed', 'refunded'] as const;
export const FULFILLMENT_TYPES = ['dine_in', 'takeaway', 'delivery'] as const;

// ─── Order Status State Machine ───────────────────────────────────────────────
export const OrderStatusSchema = z.enum(ORDER_STATUSES);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

// ─── Item Availability (managed by apps/admin, Sprint S5) ────────────────────
export const AvailabilitySchema = z.enum([
  'available',
  'sold_out',
  'limited',
]);
export type Availability = z.infer<typeof AvailabilitySchema>;

/** One selected option on a line (matches admin / client cart). */
const WrapOrderItemOptionSnapshotSchema = z.object({
  optionId: z.string().optional(),
  label: z.string(),
  priceAdjust: z.number().nonnegative().optional(),
});

/**
 * Per–line-item modifier snapshot. **Only** dynamic `optionGroups` (admin group names + options)
 * and optional free-text `notes`. No fixed “base/protein/toppings” keys — those were removed.
 */
export const WrapOrderLineModifiersSchema = z.object({
  optionGroups: z
    .array(
      z.object({
        groupId: z.string().optional(),
        groupName: z.string().optional(),
        name: z.string().optional(),
        options: z.array(WrapOrderItemOptionSnapshotSchema),
      }),
    )
    .default([]),
  notes: z.string().max(200).optional(),
});

export type WrapOrderLineModifiers = z.infer<typeof WrapOrderLineModifiersSchema>;

// ─── WrapOrder Canonical Schema ───────────────────────────────────────────────
export const WrapOrderSchema = z.object({
  orderId:   z.string().uuid(),
  status:    OrderStatusSchema,
  source:    z.enum(ORDER_SOURCES),
  placedAt:  z.string().datetime(),
  updatedAt: z.string().datetime(),

  // ── Customer (single-branch; no branchId) ──────────────────────────────────
  customer: z.object({
    customerId: z.string().uuid().optional(), // null for walk-in / guest / POS
    name:       z.string(),
    phone:      z.string().optional(),
    /** Storefront sign-in / checkout — stored on Customer when creating/linking guest */
    email:      z.string().max(320).optional(),
  }),

  // ── Line Items ─────────────────────────────────────────────────────────────
  items: z.array(z.object({
    lineItemId: z.string().uuid(),
    wrapId:     z.string().uuid(),           // FK → MenuItem
    name:       z.string(),                  // Denormalized for receipt/KDS printing

    // 📦 Item-level availability — UX flag, managed in apps/admin (Sprint S5)
    // Broadcast via Supabase Realtime to client + cashier
    availability: AvailabilitySchema.default('available'),

    quantity:  z.number().int().min(1),
    unitPrice: z.number().nonnegative(),     // LKR

    modifiers: WrapOrderLineModifiersSchema,

    lineTotal: z.number().nonnegative(),  // (unitPrice + extras) × quantity — LKR
  })),

  // ── Pricing ────────────────────────────────────────────────────────────────
  pricing: z.object({
    subtotal:       z.number().nonnegative(),                 // LKR
    discountCode:   z.string().optional(),
    discountAmount: z.number().nonnegative().default(0),      // LKR
    /** POS only: extra discount (LKR); requires supervisor elevation on create (server-enforced). */
    manualDiscountAmount: z.preprocess(
      (val) => {
        if (val === null || val === undefined || val === '') return undefined;
        const n =
          typeof val === 'number'
            ? val
            : parseFloat(String(val).trim().replace(',', '.'));
        return Number.isFinite(n) ? n : undefined;
      },
      z.number().nonnegative().optional(),
    ),
    tax:            z.number().nonnegative(),                 // LKR
    deliveryFee:    z.number().nonnegative().default(0),      // LKR
    total:          z.number().nonnegative(),                 // LKR
  }),

  // ── Payment ────────────────────────────────────────────────────────────────
  // Offline constraint: method MUST be "cash" when source = "cashier_pos_offline"
  // Enforced in apps/cashier Zustand store (NOT in this schema — contracts are gateway-agnostic)
  payment: z.object({
    method:        z.enum(PAYMENT_METHODS),
    status:        z.enum(PAYMENT_STATUSES),
    transactionId: z.string().optional(),
    /** POS Pay now / till audit — persisted on `cash_collected` payment event; amounts also surfaced on receipts when parsed. */
    posCashTenderNote: z.string().max(400).optional(),
  }),

  // ── Fulfillment ────────────────────────────────────────────────────────────
  fulfillment: z.object({
    type:               z.enum(FULFILLMENT_TYPES),
    tableNumber:        z.string().optional(),           // dine_in only
    deliveryAddress:    z.string().optional(),           // delivery only
    /** Drop-off coordinates for distance-based delivery fees (client_web). */
    deliveryLatitude:   z.number().min(-90).max(90).optional(),
    deliveryLongitude:  z.number().min(-180).max(180).optional(),
    courierId:          z.string().uuid().optional(),    // in-house courier assigned
    estimatedReadyTime: z.string().datetime().optional(),
  }),

  // ── Kitchen ────────────────────────────────────────────────────────────────
  kitchen: z.object({
    priority:  z.enum(['normal', 'rush']).default('normal'),
    printedAt: z.string().datetime().optional(),         // ESC/POS KDS ticket timestamp
    readyAt:   z.string().datetime().optional(),
  }),
});

export type WrapOrder    = z.infer<typeof WrapOrderSchema>;
export type WrapOrderItem = WrapOrder['items'][number];

/** POS / admin: replace all lines on an existing order (server recalculates totals). */
export const ReplaceOrderLineItemsBodySchema = z.object({
  items: WrapOrderSchema.pick({ items: true }).shape.items,
  note: z.string().max(500).optional(),
  /** Required for ADMIN only when overriding a policy block (e.g. paid + in kitchen). */
  adminOverrideReason: z.string().max(500).optional(),
});

export type ReplaceOrderLineItemsBody = z.infer<typeof ReplaceOrderLineItemsBodySchema>;

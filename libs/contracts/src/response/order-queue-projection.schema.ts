import { z } from 'zod';
import {
  FULFILLMENT_TYPES,
  ORDER_SOURCES,
  OrderStatusSchema,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
} from '../order.schema';

const ApiNumericSchema = z.union([z.number(), z.string(), z.custom<{ toString(): string }>()]);

const KitchenQueueOrderItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  quantity: z.number(),
  modifiersJson: z.unknown().optional(),
  menuItemId: z.string().optional(),
});

const QueueMoveBlockedReasonSchema = z.enum([
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
export const KitchenQueueOrderSchema = z
  .object({
    id: z.string(),
    status: OrderStatusSchema,
    source: z.enum(ORDER_SOURCES).optional(),
    fulfillmentType: z.enum(FULFILLMENT_TYPES).optional(),
    tableNumber: z.string().nullable().optional(),
    itemCount: z.number().optional(),
    items: z.array(KitchenQueueOrderItemSchema).optional(),
    estimatedReadyTime: z.union([z.string(), z.date()]).nullable().optional(),
    customer: z
      .object({
        name: z.string().nullable().optional(),
      })
      .nullable()
      .optional(),
    placedAt: z.union([z.string(), z.date()]).optional(),
    updatedAt: z.union([z.string(), z.date()]).optional(),
    kitchenPriority: z.enum(['normal', 'rush']).optional(),
    printedAt: z.union([z.string(), z.date()]).nullable().optional(),
    readyAt: z.union([z.string(), z.date()]).nullable().optional(),
    kitchenEligible: z.boolean().optional(),
    releaseReason: z
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
    kitchenReleaseAt: z.union([z.string(), z.date()]).nullable().optional(),
    priorityDeadlineAt: z.union([z.string(), z.date()]).optional(),
    slaBucket: z.enum(['overdue', 'due_soon', 'ok']).optional(),
    allowedNextStatuses: z.array(OrderStatusSchema).optional(),
    actions: z
      .object({
        canMove: z.boolean(),
        canAssignCourier: z.boolean(),
        canCollectPayment: z.boolean(),
        canMarkDelivered: z.boolean(),
        canVoid: z.boolean(),
        canRefund: z.boolean(),
      })
      .optional(),
    blockedReasonsByStatus: z
      .record(z.string(), QueueMoveBlockedReasonSchema.nullable())
      .optional(),
  })
  .strict();

const CourierQueueOrderItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  quantity: z.number(),
  modifiersJson: z.unknown().optional(),
});

export const CourierQueueOrderSchema = z
  .object({
    id: z.string(),
    status: OrderStatusSchema,
    source: z.enum(ORDER_SOURCES).optional(),
    paymentStatus: z.enum(PAYMENT_STATUSES),
    paymentMethod: z.enum(PAYMENT_METHODS),
    paymentCollection: z.unknown().nullable().optional(),
    fulfillmentType: z.enum(FULFILLMENT_TYPES).optional(),
    customer: z
      .object({
        id: z.string().nullable().optional(),
        name: z.string().nullable().optional(),
        phone: z.string().nullable().optional(),
      })
      .nullable()
      .optional(),
    subtotal: ApiNumericSchema.optional(),
    tax: ApiNumericSchema.optional(),
    deliveryFee: ApiNumericSchema.optional(),
    total: ApiNumericSchema,
    itemCount: z.number().optional(),
    items: z.array(CourierQueueOrderItemSchema).optional(),
    deliveryAddress: z.string().nullable().optional(),
    deliveryLatitude: ApiNumericSchema.nullable().optional(),
    deliveryLongitude: ApiNumericSchema.nullable().optional(),
    deliveryDistanceKm: ApiNumericSchema.nullable().optional(),
    deliveryGeoSource: z.string().nullable().optional(),
    estimatedReadyTime: z.union([z.string(), z.date()]).nullable().optional(),
    courierId: z.string().nullable().optional(),
    placedAt: z.union([z.string(), z.date()]).optional(),
    updatedAt: z.union([z.string(), z.date()]).optional(),
    kitchenPriority: z.enum(['normal', 'rush']).optional(),
    paymentRisk: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
    allowedNextStatuses: z.array(OrderStatusSchema).optional(),
    actions: z
      .object({
        canMove: z.boolean(),
        canAssignCourier: z.boolean(),
        canCollectPayment: z.boolean(),
        canMarkDelivered: z.boolean(),
        canVoid: z.boolean(),
        canRefund: z.boolean(),
      })
      .optional(),
    blockedReasonsByStatus: z
      .record(z.string(), QueueMoveBlockedReasonSchema.nullable())
      .optional(),
  })
  .strict();

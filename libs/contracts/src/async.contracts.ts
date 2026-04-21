import { z } from 'zod';

export const BULLMQ_QUEUE = {
  paymentsOrchestration: 'payments.orchestration',
  notificationsSms: 'notifications.sms',
  printReceipts: 'print.receipts',
  inventoryMovements: 'inventory.movements',
  activityEvents: 'activity.events',
} as const;

export const BULLMQ_QUEUE_NAMES = Object.values(BULLMQ_QUEUE);

export type BullMqQueueName = (typeof BULLMQ_QUEUE)[keyof typeof BULLMQ_QUEUE];

export const OUTBOX_STATUS = {
  pending: 'pending',
  processing: 'processing',
  published: 'published',
  failed: 'failed',
  deadLetter: 'dead_letter',
} as const;

export type OutboxStatus = (typeof OUTBOX_STATUS)[keyof typeof OUTBOX_STATUS];

export const NotificationJobPayloadSchema = z.object({
  orderId: z.string().min(1),
  correlationId: z.string().nullable().optional(),
  retryAttempt: z.number().int().nonnegative().optional(),
});

export type NotificationJobPayload = z.infer<typeof NotificationJobPayloadSchema>;

export const NOTIFICATION_JOB = {
  orderPaid: 'notification.order_paid',
  orderReady: 'notification.order_ready',
  orderInTransit: 'notification.order_in_transit',
} as const;

export type NotificationJobName = (typeof NOTIFICATION_JOB)[keyof typeof NOTIFICATION_JOB];

export const PRINT_JOB = {
  cashierReceipt: 'print.cashier_receipt',
  kitchenTicket: 'print.kitchen_ticket',
  orderReadyNote: 'print.order_ready_note',
} as const;

export type PrintJobName = (typeof PRINT_JOB)[keyof typeof PRINT_JOB];

export const PrintJobPayloadSchema = z.object({
  orderId: z.string().min(1),
  correlationId: z.string().nullable().optional(),
  retryAttempt: z.number().int().nonnegative().optional(),
});

export type PrintJobPayload = z.infer<typeof PrintJobPayloadSchema>;

export const ACTIVITY_JOB = {
  orderStatusChanged: 'activity.order_status_changed',
  orderCreated: 'activity.order_created',
  paymentConfirmed: 'activity.payment_confirmed',
} as const;

export type ActivityJobName = (typeof ACTIVITY_JOB)[keyof typeof ACTIVITY_JOB];

export const ActivityJobPayloadSchema = z.object({
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  eventType: z.string().min(1),
  correlationId: z.string().nullable().optional(),
  payload: z.unknown().optional(),
});

export type ActivityJobPayload = z.infer<typeof ActivityJobPayloadSchema>;

export const INVENTORY_JOB = {
  orderInKitchen: 'inventory.order_in_kitchen',
  orderReversal: 'inventory.order_reversal',
} as const;

export type InventoryJobName = (typeof INVENTORY_JOB)[keyof typeof INVENTORY_JOB];

export const InventoryJobPayloadSchema = z.object({
  orderId: z.string().min(1),
  correlationId: z.string().nullable().optional(),
  retryAttempt: z.number().int().nonnegative().optional(),
});

export type InventoryJobPayload = z.infer<typeof InventoryJobPayloadSchema>;

export const PAYMENT_JOB = {
  webhookPaid: 'payment.webhook.paid',
  webhookFailed: 'payment.webhook.failed',
  reconcilePaid: 'payment.reconcile.paid',
} as const;

export type PaymentJobName = (typeof PAYMENT_JOB)[keyof typeof PAYMENT_JOB];

export const PaymentJobPayloadSchema = z.object({
  orderId: z.string().min(1),
  paymentId: z.string().nullable().optional(),
  statusCode: z.string().nullable().optional(),
  correlationId: z.string().nullable().optional(),
  retryAttempt: z.number().int().nonnegative().optional(),
});

export type PaymentJobPayload = z.infer<typeof PaymentJobPayloadSchema>;

export const OutboxRelayJobPayloadSchema = z.object({
  outboxId: z.string().min(1),
  eventType: z.string().min(1),
  eventVersion: z.number().int().positive(),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  correlationId: z.string().nullable().optional(),
  payload: z.unknown().optional(),
  createdAt: z.string().min(1),
});

export type OutboxRelayJobPayload = z.infer<typeof OutboxRelayJobPayloadSchema>;

export const OUTBOX_EVENT_PREFIX = {
  notification: 'notification.',
  print: 'print.',
  inventory: 'inventory.',
  activity: 'activity.',
  payment: 'payment.',
  order: 'order.',
} as const;

export type OutboxEventPrefix = (typeof OUTBOX_EVENT_PREFIX)[keyof typeof OUTBOX_EVENT_PREFIX];

export function outboxEventStartsWith(eventType: string, prefix: OutboxEventPrefix): boolean {
  return String(eventType).startsWith(prefix);
}

export const OutboxEnvelopeSchema = z.object({
  eventType: z.string().min(1),
  eventVersion: z.number().int().positive().optional(),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  correlationId: z.string().nullable().optional(),
  idempotencyKey: z.string().nullable().optional(),
  payloadJson: z.unknown(),
  publishAfter: z.union([z.date(), z.string()]).optional(),
});

export type OutboxEnvelope = z.infer<typeof OutboxEnvelopeSchema>;

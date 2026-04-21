import type { QueueOrder } from '../order.api.contracts';
import type { ResponsePersona } from './response-persona';

/** Full queue row — same shape as today’s `QueueOrder` (admin / cashier / support tooling). */
export type OpsQueueOrder = QueueOrder;

/** KDS: prep + SLA + actions; no pricing rails, minimal customer (name only), no geo/phone/id. */
export type KitchenQueueOrderItem = {
  id: string;
  name: string;
  quantity: number;
  modifiersJson?: unknown;
  menuItemId?: string;
};

export type KitchenQueueOrder = {
  id: string;
  status: QueueOrder['status'];
  source?: QueueOrder['source'];
  fulfillmentType?: QueueOrder['fulfillmentType'];
  tableNumber?: string | null;
  itemCount?: number;
  items?: KitchenQueueOrderItem[];
  estimatedReadyTime?: QueueOrder['estimatedReadyTime'];
  /** Display name only — no customer id or phone on KDS. */
  customer?: { name?: string | null } | null;
  placedAt?: QueueOrder['placedAt'];
  updatedAt?: QueueOrder['updatedAt'];
  kitchenPriority?: QueueOrder['kitchenPriority'];
  printedAt?: QueueOrder['printedAt'];
  readyAt?: QueueOrder['readyAt'];
  kitchenEligible?: boolean;
  releaseReason?: QueueOrder['releaseReason'];
  kitchenReleaseAt?: QueueOrder['kitchenReleaseAt'];
  priorityDeadlineAt?: QueueOrder['priorityDeadlineAt'];
  slaBucket?: QueueOrder['slaBucket'];
  allowedNextStatuses?: QueueOrder['allowedNextStatuses'];
  actions?: QueueOrder['actions'];
  blockedReasonsByStatus?: QueueOrder['blockedReasonsByStatus'];
};

/** Courier app: navigation + COD handoff; no internal discount codes or payment gateway ids. */
export type CourierQueueOrderItem = {
  id: string;
  name: string;
  quantity: number;
  modifiersJson?: unknown;
};

export type CourierQueueOrder = {
  id: string;
  status: QueueOrder['status'];
  source?: QueueOrder['source'];
  paymentStatus: QueueOrder['paymentStatus'];
  paymentMethod: QueueOrder['paymentMethod'];
  paymentCollection?: QueueOrder['paymentCollection'];
  fulfillmentType?: QueueOrder['fulfillmentType'];
  customer?: { id?: string | null; name?: string | null; phone?: string | null } | null;
  subtotal?: QueueOrder['subtotal'];
  tax?: QueueOrder['tax'];
  deliveryFee?: QueueOrder['deliveryFee'];
  total: QueueOrder['total'];
  itemCount?: number;
  items?: CourierQueueOrderItem[];
  deliveryAddress?: string | null;
  deliveryLatitude?: QueueOrder['deliveryLatitude'];
  deliveryLongitude?: QueueOrder['deliveryLongitude'];
  deliveryDistanceKm?: QueueOrder['deliveryDistanceKm'];
  deliveryGeoSource?: QueueOrder['deliveryGeoSource'];
  estimatedReadyTime?: QueueOrder['estimatedReadyTime'];
  courierId?: string | null;
  placedAt?: QueueOrder['placedAt'];
  updatedAt?: QueueOrder['updatedAt'];
  kitchenPriority?: QueueOrder['kitchenPriority'];
  paymentRisk?: QueueOrder['paymentRisk'];
  allowedNextStatuses?: QueueOrder['allowedNextStatuses'];
  actions?: QueueOrder['actions'];
  blockedReasonsByStatus?: QueueOrder['blockedReasonsByStatus'];
};

function projectKitchen(order: QueueOrder): KitchenQueueOrder {
  return {
    id: order.id,
    status: order.status,
    source: order.source,
    fulfillmentType: order.fulfillmentType,
    tableNumber: order.tableNumber,
    itemCount: order.itemCount,
    items: order.items?.map((i) => ({
      id: i.id,
      name: i.name,
      quantity: i.quantity,
      modifiersJson: i.modifiersJson,
      menuItemId: i.menuItemId,
    })),
    estimatedReadyTime: order.estimatedReadyTime,
    customer: order.customer ? { name: order.customer.name } : null,
    placedAt: order.placedAt,
    updatedAt: order.updatedAt,
    kitchenPriority: order.kitchenPriority,
    printedAt: order.printedAt,
    readyAt: order.readyAt,
    kitchenEligible: order.kitchenEligible,
    releaseReason: order.releaseReason,
    kitchenReleaseAt: order.kitchenReleaseAt,
    priorityDeadlineAt: order.priorityDeadlineAt,
    slaBucket: order.slaBucket,
    allowedNextStatuses: order.allowedNextStatuses,
    actions: order.actions,
    blockedReasonsByStatus: order.blockedReasonsByStatus,
  };
}

function projectCourier(order: QueueOrder): CourierQueueOrder {
  return {
    id: order.id,
    status: order.status,
    source: order.source,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    paymentCollection: order.paymentCollection,
    fulfillmentType: order.fulfillmentType,
    customer: order.customer,
    subtotal: order.subtotal,
    tax: order.tax,
    deliveryFee: order.deliveryFee,
    total: order.total,
    itemCount: order.itemCount,
    items: order.items?.map((i) => ({
      id: i.id,
      name: i.name,
      quantity: i.quantity,
      modifiersJson: i.modifiersJson,
    })),
    deliveryAddress: order.deliveryAddress,
    deliveryLatitude: order.deliveryLatitude,
    deliveryLongitude: order.deliveryLongitude,
    deliveryDistanceKm: order.deliveryDistanceKm,
    deliveryGeoSource: order.deliveryGeoSource,
    estimatedReadyTime: order.estimatedReadyTime,
    courierId: order.courierId,
    placedAt: order.placedAt,
    updatedAt: order.updatedAt,
    kitchenPriority: order.kitchenPriority,
    paymentRisk: order.paymentRisk,
    allowedNextStatuses: order.allowedNextStatuses,
    actions: order.actions,
    blockedReasonsByStatus: order.blockedReasonsByStatus,
  };
}

/**
 * Returns a role-appropriate queue order JSON. Input is the internal `QueueOrder` (ops superset).
 */
export function projectQueueOrderForPersona(
  persona: ResponsePersona,
  order: QueueOrder,
): OpsQueueOrder | KitchenQueueOrder | CourierQueueOrder {
  if (persona === 'kitchen') return projectKitchen(order);
  if (persona === 'courier') return projectCourier(order);
  return order;
}

/** Keys that must not appear in serialized kitchen queue payloads (for tests / audits). */
export const KITCHEN_QUEUE_FORBIDDEN_KEYS = [
  'total',
  'subtotal',
  'tax',
  'deliveryFee',
  'discountCode',
  'discountAmount',
  'transactionId',
  'paymentCollection',
  'paymentMethod',
  'paymentStatus',
  'paymentRisk',
  'staffScheduleOverride',
  'deliveryLatitude',
  'deliveryLongitude',
  'deliveryDistanceKm',
  'deliveryGeoSource',
  'courierId',
] as const;

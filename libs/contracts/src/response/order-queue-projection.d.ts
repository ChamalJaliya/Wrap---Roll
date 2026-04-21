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
    customer?: {
        name?: string | null;
    } | null;
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
    customer?: {
        id?: string | null;
        name?: string | null;
        phone?: string | null;
    } | null;
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
/**
 * Returns a role-appropriate queue order JSON. Input is the internal `QueueOrder` (ops superset).
 */
export declare function projectQueueOrderForPersona(persona: ResponsePersona, order: QueueOrder): OpsQueueOrder | KitchenQueueOrder | CourierQueueOrder;
/** Keys that must not appear in serialized kitchen queue payloads (for tests / audits). */
export declare const KITCHEN_QUEUE_FORBIDDEN_KEYS: readonly ["total", "subtotal", "tax", "deliveryFee", "discountCode", "discountAmount", "transactionId", "paymentCollection", "paymentMethod", "paymentStatus", "paymentRisk", "staffScheduleOverride", "deliveryLatitude", "deliveryLongitude", "deliveryDistanceKm", "deliveryGeoSource", "courierId"];
//# sourceMappingURL=order-queue-projection.d.ts.map
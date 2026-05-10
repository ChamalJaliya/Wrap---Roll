import type { FULFILLMENT_TYPES, ORDER_SOURCES, ORDER_STATUSES, PAYMENT_METHODS, PAYMENT_STATUSES } from './order.schema';
export type ApiDateTime = string | Date;
export type ApiNumeric = number | string | {
    toString(): string;
};
export type QueueOrderStatus = (typeof ORDER_STATUSES)[number];
export declare const ORDER_FLOW_BOARD_STATUSES: readonly ["placed", "paid", "in_kitchen", "ready", "in_transit", "delivered", "cancelled", "voided", "refunded"];
export declare const PAYMENT_FLOW_BOARD_STATUSES: readonly ["pending", "completed", "failed", "refunded"];
export type QueueMoveBlockedReason = 'ROLE_FORBIDDEN' | 'INVALID_TRANSITION' | 'PAYMENT_NOT_COMPLETED' | 'COURIER_NOT_ASSIGNED' | 'NOT_DELIVERY_ORDER' | 'KITCHEN_POLICY_BLOCK' | 'SCHEDULE_GATE' | 'TERMINAL_STATE' | 'UNKNOWN';
export type QueueOrderActions = {
    canMove: boolean;
    canAssignCourier: boolean;
    canCollectPayment: boolean;
    canMarkDelivered: boolean;
    canVoid: boolean;
    canRefund: boolean;
    canReplaceLineItems?: boolean;
    lineReplaceBlockedMessage?: string | null;
    canEditSupportDetails?: boolean;
    supportEditBlockedMessage?: string | null;
};
export type QueueOrder = {
    id: string;
    status: (typeof ORDER_STATUSES)[number];
    source?: (typeof ORDER_SOURCES)[number];
    paymentStatus: (typeof PAYMENT_STATUSES)[number];
    paymentMethod: (typeof PAYMENT_METHODS)[number];
    paymentCollection?: CashierPaymentCollection | null;
    fulfillmentType?: (typeof FULFILLMENT_TYPES)[number];
    customer?: {
        id?: string | null;
        name?: string | null;
        phone?: string | null;
    } | null;
    customerName?: string | null;
    customerPhone?: string | null;
    subtotal?: ApiNumeric;
    discountCode?: string | null;
    discountAmount?: ApiNumeric;
    tax?: ApiNumeric;
    deliveryFee?: ApiNumeric;
    total: ApiNumeric;
    transactionId?: string | null;
    itemCount?: number;
    items?: Array<{
        id: string;
        menuItemId?: string;
        name: string;
        quantity: number;
        unitPrice: ApiNumeric;
        lineTotal: ApiNumeric;
        modifiersJson?: unknown;
    }>;
    estimatedReadyTime?: ApiDateTime | null;
    deliveryAddress?: string | null;
    deliveryLatitude?: ApiNumeric | null;
    deliveryLongitude?: ApiNumeric | null;
    deliveryDistanceKm?: ApiNumeric | null;
    deliveryGeoSource?: string | null;
    tableNumber?: string | null;
    placedAt?: ApiDateTime | null;
    updatedAt?: ApiDateTime | null;
    courierId?: string | null;
    kitchenPriority?: 'normal' | 'rush';
    printedAt?: ApiDateTime | null;
    readyAt?: ApiDateTime | null;
    kitchenEligible?: boolean;
    releaseReason?: 'PREPAID' | 'TAKEAWAY_PAY_LATER' | 'DINE_IN_POSTPAY' | 'DELIVERY_PAY_LATER' | 'STAFF_PAY_LATER' | 'MANUAL_OVERRIDE' | 'SCHEDULED_PENDING' | null;
    /** When set, kitchen prep should not start until `now` is past this instant (ISO). */
    kitchenReleaseAt?: ApiDateTime | null;
    /** Deadline for sort + SLA: scheduled `estimatedReadyTime`, or ASAP `placedAt + minLead`. */
    priorityDeadlineAt?: ApiDateTime | null;
    slaBucket?: 'overdue' | 'due_soon' | 'ok';
    paymentRisk?: 'LOW' | 'MEDIUM' | 'HIGH';
    /** True when POS accepted the order outside public schedule/cutoff (in-store only). */
    staffScheduleOverride?: boolean;
    allowedNextStatuses?: QueueOrderStatus[];
    actions?: QueueOrderActions;
    blockedReasonsByStatus?: Partial<Record<QueueOrderStatus, QueueMoveBlockedReason>>;
};
export type SupportOrderItem = {
    id: string;
    menuItemId?: string;
    name: string;
    quantity: number;
    unitPrice?: ApiNumeric;
    lineTotal: ApiNumeric;
    modifiers?: unknown;
};
export type SupportOrderDetails = {
    id: string;
    status: (typeof ORDER_STATUSES)[number];
    paymentStatus: (typeof PAYMENT_STATUSES)[number];
    paymentMethod: (typeof PAYMENT_METHODS)[number];
    paymentCollection?: CashierPaymentCollection | null;
    source: (typeof ORDER_SOURCES)[number];
    fulfillmentType: (typeof FULFILLMENT_TYPES)[number];
    tableNumber?: string | null;
    deliveryAddress?: string | null;
    deliveryLatitude?: ApiNumeric | null;
    deliveryLongitude?: ApiNumeric | null;
    deliveryDistanceKm?: ApiNumeric | null;
    deliveryGeoSource?: string | null;
    estimatedReadyTime?: ApiDateTime | null;
    placedAt: ApiDateTime;
    updatedAt?: ApiDateTime;
    subtotal?: ApiNumeric;
    discountAmount?: ApiNumeric;
    tax?: ApiNumeric;
    deliveryFee?: ApiNumeric;
    total: ApiNumeric;
    customer?: {
        id?: string | null;
        name?: string | null;
        phone?: string | null;
    } | null;
    courierName?: string | null;
    cashierName?: string | null;
    kitchenName?: string | null;
    /** POS schedule override (outside public hours/cutoff; not used for delivery). */
    staffScheduleOverride?: boolean;
    /** From latest `cash_collected` payment event note with till audit (LKR). Omitted when absent. */
    cashReceivedLkr?: ApiNumeric | null;
    changeReturnedLkr?: ApiNumeric | null;
    items: SupportOrderItem[];
};
export type PaymentEventRow = {
    id: string;
    eventType: string;
    paymentMethod?: (typeof PAYMENT_METHODS)[number] | null;
    actorRole?: string | null;
    actorUserId?: string | null;
    note?: string | null;
    metadataJson?: unknown;
    createdAt: ApiDateTime;
};
export type OpsActorRef = {
    userId?: string | null;
    name?: string | null;
    role?: string | null;
    email?: string | null;
};
export type OpsActivityEventRow = {
    id: string;
    app: 'client' | 'cashier' | 'kitchen' | 'delivery' | 'admin' | 'system';
    entityType: string;
    entityId: string;
    eventType: string;
    summary: string;
    actor?: OpsActorRef | null;
    metadataJson?: unknown;
    createdAt: ApiDateTime;
};
/** Surfaces for `OpsActivityEventRow.app` (where the action happened — not the same as actor role). */
export declare const OPS_ACTIVITY_APP_FILTERS: readonly ["client", "cashier", "kitchen", "delivery", "admin", "system"];
/** Stored `actorRole` values for activity filters (staff roles + shopper). */
export declare const OPS_ACTIVITY_ACTOR_ROLE_FILTERS: readonly ["ADMIN", "CASHIER", "KITCHEN", "COURIER", "CLIENT", "SYSTEM"];
/** Paginated global activity (`GET /activity`). */
export type OpsActivityFeedPage = {
    items: OpsActivityEventRow[];
    nextCursor: string | null;
};
/** SMS/email delivery audit row (`GET /notifications/deliveries`). */
export type NotificationDeliveryRow = {
    id: string;
    channel: string;
    orderId: string | null;
    templateKey: string | null;
    toMasked: string | null;
    bodyPreview: string | null;
    status: string;
    error: string | null;
    metadataJson?: unknown;
    createdAt: ApiDateTime;
};
export type NotificationDeliveryFeedPage = {
    items: NotificationDeliveryRow[];
    nextCursor: string | null;
};
/** Staff in-app inbox (`GET /notifications/inbox`). */
export type StaffNotificationRow = {
    id: string;
    title: string;
    body: string;
    linkUrl: string | null;
    readAt: ApiDateTime | null;
    kind: string;
    createdAt: ApiDateTime;
};
export type StaffNotificationFeedPage = {
    items: StaffNotificationRow[];
    nextCursor: string | null;
    unreadCount: number;
};
export type CashierOrderLineOption = {
    groupName: string;
    label: string;
    priceAdjust: number;
};
export type CashierOrderLineInput = {
    cartId?: string;
    id: string;
    name: string;
    unitPrice: number;
    quantity: number;
    notes?: string;
    selectedOptions?: CashierOrderLineOption[];
};
export type CashierPaymentMethod = 'CASH' | 'CARD';
export type CashierOrderSource = 'cashier_pos' | 'cashier_pos_offline';
export type CashierPaymentCollection = 'immediate' | 'on_delivery' | 'on_pickup';
export type DeliveryPaymentCollectionMethod = 'cash' | 'card';
export declare function formatPaymentCollectionLabel(paymentCollection: CashierPaymentCollection | string | null | undefined): string;
export type MarkPaymentReceivedPayload = {
    method: DeliveryPaymentCollectionMethod;
    note?: string;
};
export type CashierOrderSyncPayload = {
    items: CashierOrderLineInput[];
    total: number;
    paymentMethod: CashierPaymentMethod;
    customerName?: string;
    customerPhone?: string;
    fulfillmentType?: 'takeaway' | 'dine_in' | 'delivery';
    paymentCollection?: CashierPaymentCollection;
    tableNumber?: string;
    deliveryAddress?: string;
    /** Optional drop-off pin (e.g. from address book); server still validates distance fees. */
    deliveryLatitude?: number;
    deliveryLongitude?: number;
    orderSource?: CashierOrderSource;
    /** Admin-defined coupon code; discount amount is validated only on the server. */
    discountCode?: string;
    createdAt: string;
};
//# sourceMappingURL=order.api.contracts.d.ts.map
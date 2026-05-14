import type {
  FULFILLMENT_TYPES,
  ORDER_SOURCES,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
} from './order.schema';
import { SHOPPER_ROLE } from './staff.contracts';

export type ApiDateTime = string | Date;
export type ApiNumeric = number | string | { toString(): string };
export type QueueOrderStatus = (typeof ORDER_STATUSES)[number];
export const ORDER_FLOW_BOARD_STATUSES = [
  'placed',
  'paid',
  'in_kitchen',
  'ready',
  'in_transit',
  'delivered',
  'cancelled',
  'voided',
  'refunded',
] as const satisfies readonly QueueOrderStatus[];
export const PAYMENT_FLOW_BOARD_STATUSES = [
  'pending',
  'completed',
  'failed',
  'refunded',
] as const;
export type QueueMoveBlockedReason =
  | 'ROLE_FORBIDDEN'
  | 'INVALID_TRANSITION'
  | 'PAYMENT_NOT_COMPLETED'
  | 'COURIER_NOT_ASSIGNED'
  | 'NOT_DELIVERY_ORDER'
  | 'KITCHEN_POLICY_BLOCK'
  | 'SCHEDULE_GATE'
  | 'TERMINAL_STATE'
  | 'UNKNOWN';

export type QueueOrderActions = {
  canMove: boolean;
  canAssignCourier: boolean;
  canCollectPayment: boolean;
  canMarkDelivered: boolean;
  canVoid: boolean;
  canRefund: boolean;
  /** Replace cart lines on the order (policy-gated on payment + fulfillment). */
  canReplaceLineItems: boolean;
  /** Human-readable reason when line replacement is blocked for this actor. */
  lineReplaceBlockedMessage?: string | null;
  /** PATCH support/customer/delivery fields (stricter than lines for delivery-ready paid). */
  canEditSupportDetails: boolean;
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
  customer?: { id?: string | null; name?: string | null; phone?: string | null } | null;
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
  releaseReason?:
    | 'PREPAID'
    | 'TAKEAWAY_PAY_LATER'
    | 'DINE_IN_POSTPAY'
    | 'DELIVERY_PAY_LATER'
    | 'STAFF_PAY_LATER'
    | 'MANUAL_OVERRIDE'
    | 'SCHEDULED_PENDING'
    | null;
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
  /** Menu catalog id — required for POS amend cart hydration when queue row is missing. */
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
  /** Coupon code when present; manual-only discounts may have no code but still have discountAmount. */
  discountCode?: string | null;
  discountAmount?: ApiNumeric;
  tax?: ApiNumeric;
  deliveryFee?: ApiNumeric;
  total: ApiNumeric;
  customer?: { id?: string | null; name?: string | null; phone?: string | null } | null;
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
export const OPS_ACTIVITY_APP_FILTERS = [
  'client',
  'cashier',
  'kitchen',
  'delivery',
  'admin',
  'system',
] as const satisfies readonly OpsActivityEventRow['app'][];

/** Stored `actorRole` values for activity filters (staff roles + shopper). */
export const OPS_ACTIVITY_ACTOR_ROLE_FILTERS = [
  'ADMIN',
  'CASHIER',
  'KITCHEN',
  'COURIER',
  SHOPPER_ROLE,
  'SYSTEM',
] as const;

/** Paginated global activity (`GET /activity`). */
export type OpsActivityFeedPage = {
  items: OpsActivityEventRow[];
  nextCursor: string | null;
};

/** `POST /activity/purge` — bulk-delete ops activity older than a cutoff (admin only). */
export type ActivityPurgeResult = {
  deleted: number;
};

/** `GET /activity/count-before` — rows that would be removed by purge with the same `before` cutoff. */
export type ActivityCountBeforeResult = {
  count: number;
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
export type CashierPaymentCollection =
  | 'immediate'
  | 'on_delivery'
  | 'on_pickup'
  /** Counter pay-later / dine-in settle at collection — order-kit uses AT_COLLECTION_ tx prefix for dine-in. */
  | 'at_collection';
export type DeliveryPaymentCollectionMethod = 'cash' | 'card';

export function formatPaymentCollectionLabel(
  paymentCollection: CashierPaymentCollection | string | null | undefined,
): string {
  if (!paymentCollection) return 'Immediate';
  switch (paymentCollection) {
    case 'on_delivery':
      return 'Pay on delivery';
    case 'on_pickup':
      return 'Pay on pickup';
    case 'at_collection':
      return 'Pay at collection';
    case 'immediate':
      return 'Immediate';
    default:
      return String(paymentCollection).replace(/_/g, ' ');
  }
}

/**
 * Human-readable payment timing for queue cards and ops UIs.
 * Uses fulfillment so counter takeaway “pay later” reads as handoff, not only “pickup”.
 */
/** Avoid showing raw DB value `completed` — reads like the whole order is finished (kitchen/delivery). */
export function formatPaymentStatusDisplayLabel(
  paymentStatus: string | null | undefined,
): string {
  const s = String(paymentStatus ?? '').toLowerCase();
  switch (s) {
    case 'completed':
      return 'Paid';
    case 'pending':
      return 'Payment pending';
    case 'failed':
      return 'Payment failed';
    case 'refunded':
      return 'Refunded';
    default:
      return paymentStatus ? String(paymentStatus) : '—';
  }
}

/**
 * Staff-facing payment method label.
 * `card` means card captured on a physical terminal (not client online checkout).
 */
export function formatStaffPaymentMethodLabel(
  paymentMethod: string | null | undefined,
): string {
  const s = String(paymentMethod ?? '').toLowerCase();
  switch (s) {
    case 'card':
      return 'Card (terminal)';
    case 'cash':
      return 'Cash';
    case 'payhere':
      return 'PayHere online';
    case 'online':
      return 'Online';
    default:
      return paymentMethod ? String(paymentMethod) : '—';
  }
}

export function formatPaymentCollectionDisplayLabel(
  paymentCollection: CashierPaymentCollection | string | null | undefined,
  fulfillmentType?: 'takeaway' | 'dine_in' | 'delivery' | string | null,
): string {
  const raw = String(paymentCollection ?? 'immediate').toLowerCase();
  const ft = String(fulfillmentType ?? '').toLowerCase();
  if (raw === 'on_pickup' && ft === 'takeaway') return 'Pay at handoff';
  if (raw === 'at_collection' && ft === 'dine_in') return 'Pay at table or exit';
  return formatPaymentCollectionLabel(paymentCollection);
}

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
  /** Admin-defined coupon code; amount is validated only on the server at order creation. */
  discountCode?: string;
  /** Extra LKR discount after supervisor unlock; capped server-side with coupon total ≤ 50% subtotal. */
  manualDiscountAmount?: number;
  /**
   * Short-lived token from `POST /supervisor/challenge` — sent only as `x-supervisor-elevation` by the cashier
   * API route, never forwarded in the Nest JSON body.
   */
  supervisorElevationToken?: string;
  /**
   * Counter Pay now (cash): till audit line appended to placement `cash_collected` event.
   * Built client-side e.g. `appendCashTenderAuditToNote('POS Pay now cash', detail)`.
   */
  cashTenderAuditNote?: string;
  createdAt: string;
};

import { type OrderStatus } from '@wrap-roll/contracts';

export type TrackableStepStatus = Extract<
  OrderStatus,
  'placed' | 'paid' | 'in_kitchen' | 'ready' | 'in_transit' | 'delivered'
>;

export type FulfillmentUi = 'delivery' | 'dine_in' | 'pickup';

export const STATUS_STEP_CONTENT: Record<TrackableStepStatus, { label: string; description: string }> = {
  placed: {
    label: 'Order Received',
    description: 'Your order has been received and is waiting for preparation',
  },
  paid: {
    label: 'Paid & Confirmed',
    description: 'Payment verified! Our kitchen is notified',
  },
  in_kitchen: {
    label: 'In the Kitchen',
    description: 'Our chefs are rolling your wrap now',
  },
  ready: {
    label: 'Ready!',
    description: 'Great news! Your order is ready',
  },
  in_transit: {
    label: 'On the Way',
    description: 'Your rider is on the way with your order',
  },
  delivered: {
    label: 'Delivered',
    description: 'Enjoy your meal! See you again soon',
  },
};

const CANONICAL_FLOW: OrderStatus[] = ['placed', 'paid', 'in_kitchen', 'ready', 'in_transit', 'delivered'];

export function normalizeFulfillmentType(value: string): FulfillmentUi {
  if (value === 'delivery') return 'delivery';
  if (value === 'dine_in') return 'dine_in';
  return 'pickup';
}

export function isDeferredPaymentCollection(params: {
  paymentCollection: string;
  paymentMethod: string;
  paymentStatus: string;
}): boolean {
  const { paymentCollection, paymentMethod, paymentStatus } = params;
  if (paymentCollection === 'on_delivery' || paymentCollection === 'on_pickup') return true;
  return paymentMethod.toLowerCase() === 'cash' && paymentStatus.toLowerCase() !== 'completed';
}

export function getPaymentCollectionLabel(paymentCollection: string, isDeferredCollection: boolean): string {
  if (paymentCollection === 'on_delivery') return 'Pay on delivery';
  if (paymentCollection === 'on_pickup') return 'Pay on pickup';
  if (isDeferredCollection) return 'Pay later';
  return 'Immediate';
}

export function getFulfillmentLabel(fulfillmentType: FulfillmentUi): string {
  if (fulfillmentType === 'delivery') return 'Delivery';
  if (fulfillmentType === 'dine_in') return 'Dine-in';
  return 'Pickup';
}

export function buildStatusFlow(params: {
  fulfillmentType: FulfillmentUi;
  isDeferredCollection: boolean;
  currentStatus: OrderStatus;
}): OrderStatus[] {
  const { fulfillmentType, isDeferredCollection, currentStatus } = params;
  const baseFlow: OrderStatus[] =
    fulfillmentType === 'delivery'
      ? ['placed', 'in_kitchen', 'ready', 'in_transit', 'delivered']
      : ['placed', 'in_kitchen', 'ready', 'delivered'];
  const flowWithPayment: OrderStatus[] = isDeferredCollection ? baseFlow : ['placed', 'paid', ...baseFlow.slice(1)];
  if (flowWithPayment.includes(currentStatus)) return flowWithPayment;
  return [
    ...new Set(
      [...flowWithPayment, currentStatus].sort((a, b) => CANONICAL_FLOW.indexOf(a) - CANONICAL_FLOW.indexOf(b)),
    ),
  ] as OrderStatus[];
}

export function getOrderStateSummary(currentStatus: OrderStatus, fulfillmentType: FulfillmentUi): string {
  if (currentStatus === 'delivered') {
    if (fulfillmentType === 'delivery') return 'has been delivered.';
    if (fulfillmentType === 'dine_in') return 'has been served.';
    return 'has been collected successfully.';
  }
  if (currentStatus === 'in_transit') return 'is on the way.';
  if (currentStatus === 'ready') {
    if (fulfillmentType === 'delivery') return 'is ready for dispatch.';
    if (fulfillmentType === 'dine_in') return 'is ready to serve.';
    return 'is ready for pickup.';
  }
  if (currentStatus === 'cancelled' || currentStatus === 'voided' || currentStatus === 'refunded') {
    return `is ${currentStatus}.`;
  }
  return 'is being prepared.';
}

export function getStepDescription(params: {
  stepStatus: TrackableStepStatus;
  isDeferredCollection: boolean;
  paymentCollection: string;
  fulfillmentType: FulfillmentUi;
  estimatedReadyTime: string;
  currentStatus: OrderStatus;
}): string {
  const {
    stepStatus,
    isDeferredCollection,
    paymentCollection,
    fulfillmentType,
    estimatedReadyTime,
    currentStatus,
  } = params;

  if (stepStatus === 'placed' && isDeferredCollection) {
    if (paymentCollection === 'on_delivery') return 'Order received. Payment will be collected on delivery';
    if (paymentCollection === 'on_pickup') return 'Order received. Payment will be collected on pickup';
    return fulfillmentType === 'delivery'
      ? 'Order received. Payment will be collected on delivery'
      : 'Order received. Payment will be collected on pickup';
  }

  if (
    stepStatus === 'placed' &&
    estimatedReadyTime &&
    currentStatus === 'placed' &&
    new Date(estimatedReadyTime).getTime() > Date.now()
  ) {
    return `Scheduled order confirmed for ${new Date(estimatedReadyTime).toLocaleString()}`;
  }

  if (stepStatus === 'ready') {
    if (fulfillmentType === 'delivery') return 'Great news! Your order is packed and ready for dispatch';
    if (fulfillmentType === 'dine_in') return 'Great news! Your order is ready to be served';
    return 'Great news! Your order is ready for pickup';
  }

  if (stepStatus === 'delivered') {
    if (fulfillmentType === 'delivery') return 'Enjoy your meal! See you again soon';
    if (fulfillmentType === 'dine_in') return 'Your meal has been served. Enjoy!';
    return 'Order collected successfully. Enjoy your meal!';
  }

  return STATUS_STEP_CONTENT[stepStatus].description;
}

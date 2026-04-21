import { Prisma } from '@prisma/client';
import type { ResponsePersona } from '@wrap-roll/contracts';

/** DB ordering for getQueue (matches in-memory priority tie-break). */
export const QUEUE_ORDER_BY: Prisma.OrderOrderByWithRelationInput[] = [
  { placedAt: 'desc' },
  { estimatedReadyTime: 'asc' },
];

/** Line items: KITCHEN/COURIER responses omit prices; skipping columns reduces I/O on large tickets. */
const ITEM_LEAN_SELECT = {
  id: true,
  menuItemId: true,
  name: true,
  quantity: true,
  modifiersJson: true,
} satisfies Prisma.OrderItemSelect;

const linkedCustomerFull: Prisma.CustomerSelect = {
  id: true,
  name: true,
  phone: true,
};

const linkedCustomerKitchen: Prisma.CustomerSelect = {
  id: true,
  name: true,
};

/** Scalars needed by transition policy + mapper (before persona projection). */
function orderScalarsKitchen(): Prisma.OrderSelect {
  return {
    id: true,
    status: true,
    source: true,
    placedAt: true,
    updatedAt: true,
    placedByUserId: true,
    customerId: true,
    customerName: true,
    customerPhone: true,
    subtotal: true,
    discountCode: true,
    discountAmount: true,
    tax: true,
    deliveryFee: true,
    total: true,
    paymentMethod: true,
    paymentStatus: true,
    transactionId: true,
    fulfillmentType: true,
    tableNumber: true,
    deliveryAddress: true,
    // deliveryLatitude/Longitude/DistanceKm/GeoSource/CalcJson omitted for KDS — not in KitchenQueueOrder.
    estimatedReadyTime: true,
    kitchenPriority: true,
    printedAt: true,
    readyAt: true,
    courierId: true,
    staffScheduleOverride: true,
    items: { select: ITEM_LEAN_SELECT },
    customer: { select: linkedCustomerKitchen },
  };
}

function orderScalarsCourier(): Prisma.OrderSelect {
  return {
    id: true,
    status: true,
    source: true,
    placedAt: true,
    updatedAt: true,
    placedByUserId: true,
    customerId: true,
    customerName: true,
    customerPhone: true,
    subtotal: true,
    discountCode: true,
    discountAmount: true,
    tax: true,
    deliveryFee: true,
    total: true,
    paymentMethod: true,
    paymentStatus: true,
    transactionId: true,
    fulfillmentType: true,
    tableNumber: true,
    deliveryAddress: true,
    deliveryLatitude: true,
    deliveryLongitude: true,
    deliveryDistanceKm: true,
    deliveryGeoSource: true,
    deliveryCalcJson: true,
    estimatedReadyTime: true,
    kitchenPriority: true,
    printedAt: true,
    readyAt: true,
    courierId: true,
    staffScheduleOverride: true,
    items: { select: ITEM_LEAN_SELECT },
    customer: { select: linkedCustomerFull },
  };
}

/**
 * Ops loads full line prices for reconciliation-style queue; kitchen/courier use lean items (+ kitchen omits geo JSON).
 */
export function buildQueueOrderFindManyArgs(
  persona: ResponsePersona,
  where: Prisma.OrderWhereInput,
): Prisma.OrderFindManyArgs {
  if (persona === 'ops') {
    return {
      where,
      include: { customer: true, items: true },
      orderBy: QUEUE_ORDER_BY,
    };
  }
  if (persona === 'kitchen') {
    return {
      where,
      select: orderScalarsKitchen(),
      orderBy: QUEUE_ORDER_BY,
    };
  }
  return {
    where,
    select: orderScalarsCourier(),
    orderBy: QUEUE_ORDER_BY,
  };
}

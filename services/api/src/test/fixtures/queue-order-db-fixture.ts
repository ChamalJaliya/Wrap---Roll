/**
 * Minimal Prisma-shaped order row for `OrderService.getQueue` tests (include items + customer).
 * Matches queue `findMany` ordering (array `orderBy`) detection in test Prisma mock.
 */
export const QUEUE_TEST_ORDER_ID = '550e8400-e29b-41d4-a716-446655440099';

export const queueOrderDbFixture = {
  id: QUEUE_TEST_ORDER_ID,
  status: 'paid' as const,
  source: 'cashier_pos' as const,
  placedAt: new Date('2026-04-11T10:00:00.000Z'),
  updatedAt: new Date('2026-04-11T10:05:00.000Z'),
  placedByUserId: null as string | null,
  customerId: 'cust-queue-fixture',
  customerName: 'Queue Test',
  customerPhone: '+94777111222',
  subtotal: 500,
  discountCode: 'INTERNAL10',
  discountAmount: 0,
  tax: 50,
  deliveryFee: 0,
  total: 550,
  paymentMethod: 'cash' as const,
  paymentStatus: 'completed' as const,
  transactionId: 'txn_secret',
  fulfillmentType: 'takeaway' as const,
  tableNumber: null as string | null,
  deliveryAddress: null as string | null,
  deliveryLatitude: null as number | null,
  deliveryLongitude: null as number | null,
  deliveryDistanceKm: null as number | null,
  deliveryGeoSource: null as string | null,
  deliveryCalcJson: null,
  estimatedReadyTime: new Date('2026-04-11T10:40:00.000Z'),
  kitchenPriority: 'normal' as const,
  printedAt: null as Date | null,
  readyAt: null as Date | null,
  courierId: null as string | null,
  staffScheduleOverride: false,
  customer: {
    id: 'cust-queue-fixture',
    name: 'Queue Test',
    phone: '+94777111222',
  },
  items: [
    {
      id: 'line-queue-1',
      orderId: QUEUE_TEST_ORDER_ID,
      menuItemId: 'menu-item-1',
      name: 'Test Wrap',
      quantity: 1,
      unitPrice: 500,
      lineTotal: 500,
      modifiersJson: [] as unknown[],
    },
  ],
};

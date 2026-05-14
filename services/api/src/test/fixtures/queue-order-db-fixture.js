"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.queueOrderDbFixture = exports.QUEUE_TEST_ORDER_ID = void 0;
/**
 * Minimal Prisma-shaped order row for `OrderService.getQueue` tests (include items + customer).
 * Matches queue `findMany` ordering (array `orderBy`) detection in test Prisma mock.
 */
exports.QUEUE_TEST_ORDER_ID = '550e8400-e29b-41d4-a716-446655440099';
exports.queueOrderDbFixture = {
    id: exports.QUEUE_TEST_ORDER_ID,
    status: 'paid',
    source: 'cashier_pos',
    placedAt: new Date('2026-04-11T10:00:00.000Z'),
    updatedAt: new Date('2026-04-11T10:05:00.000Z'),
    placedByUserId: null,
    customerId: 'cust-queue-fixture',
    customerName: 'Queue Test',
    customerPhone: '+94777111222',
    subtotal: 500,
    discountCode: 'INTERNAL10',
    discountAmount: 0,
    tax: 50,
    deliveryFee: 0,
    total: 550,
    paymentMethod: 'cash',
    paymentStatus: 'completed',
    transactionId: 'txn_secret',
    fulfillmentType: 'takeaway',
    tableNumber: null,
    deliveryAddress: null,
    deliveryLatitude: null,
    deliveryLongitude: null,
    deliveryDistanceKm: null,
    deliveryGeoSource: null,
    deliveryCalcJson: null,
    estimatedReadyTime: new Date('2026-04-11T10:40:00.000Z'),
    kitchenPriority: 'normal',
    printedAt: null,
    readyAt: null,
    courierId: null,
    staffScheduleOverride: false,
    customer: {
        id: 'cust-queue-fixture',
        name: 'Queue Test',
        phone: '+94777111222',
    },
    items: [
        {
            id: 'line-queue-1',
            orderId: exports.QUEUE_TEST_ORDER_ID,
            menuItemId: 'menu-item-1',
            name: 'Test Wrap',
            quantity: 1,
            unitPrice: 500,
            lineTotal: 500,
            modifiersJson: [],
        },
    ],
};
//# sourceMappingURL=queue-order-db-fixture.js.map
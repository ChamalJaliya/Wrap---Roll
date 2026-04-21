import type { QueueOrder } from '@wrap-roll/contracts';
import {
  COURIER_QUEUE_FORBIDDEN_KEYS,
  KITCHEN_QUEUE_FORBIDDEN_KEYS,
  projectQueueOrderForPersona,
} from '@wrap-roll/contracts';

function sampleQueueOrder(): QueueOrder {
  return {
    id: '550e8400-e29b-41d4-a716-446655440000',
    status: 'ready',
    paymentStatus: 'pending',
    paymentMethod: 'cash',
    paymentCollection: null,
    source: 'cashier_pos',
    subtotal: 100,
    discountCode: 'SECRET',
    discountAmount: 0,
    tax: 10,
    deliveryFee: 50,
    fulfillmentType: 'delivery',
    customer: { id: 'c1', name: 'A', phone: '+94777' },
    deliveryAddress: 'Colombo',
    deliveryLatitude: 6.9,
    deliveryLongitude: 79.8,
    deliveryDistanceKm: 2,
    deliveryGeoSource: 'geocode',
    itemCount: 1,
    items: [
      {
        id: 'i1',
        menuItemId: 'm1',
        name: 'Wrap',
        quantity: 1,
        unitPrice: 100,
        lineTotal: 100,
        modifiersJson: [],
      },
    ],
    total: 160,
    transactionId: 'txn_1',
    courierId: null,
    allowedNextStatuses: ['in_transit'],
    actions: {
      canMove: true,
      canAssignCourier: true,
      canCollectPayment: true,
      canMarkDelivered: true,
      canVoid: false,
      canRefund: false,
    },
  };
}

describe('projectQueueOrderForPersona', () => {
  it('strips forbidden keys from kitchen projection', () => {
    const row = sampleQueueOrder();
    const k = projectQueueOrderForPersona('kitchen', row) as Record<string, unknown>;
    for (const key of KITCHEN_QUEUE_FORBIDDEN_KEYS) {
      expect(k).not.toHaveProperty(key);
    }
    expect(k.customer).toEqual({ name: 'A' });
    expect(k.items?.[0]).not.toHaveProperty('unitPrice');
  });

  it('returns full row for ops', () => {
    const row = sampleQueueOrder();
    const o = projectQueueOrderForPersona('ops', row);
    expect(o).toBe(row);
  });

  it('omits pricing fields from courier items', () => {
    const row = sampleQueueOrder();
    const c = projectQueueOrderForPersona('courier', row) as {
      items?: Array<Record<string, unknown>>;
    };
    expect(c.items?.[0]).not.toHaveProperty('unitPrice');
    expect(c.items?.[0]).not.toHaveProperty('lineTotal');
    expect(c.items?.[0]).toHaveProperty('name', 'Wrap');
  });

  it('strips courier forbidden keys from courier projection', () => {
    const row = sampleQueueOrder();
    const c = projectQueueOrderForPersona('courier', row) as Record<string, unknown>;
    for (const key of COURIER_QUEUE_FORBIDDEN_KEYS) {
      expect(c).not.toHaveProperty(key);
    }
  });
});

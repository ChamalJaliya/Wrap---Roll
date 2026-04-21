import { v4 as uuidv4 } from 'uuid';
import {
  ORDER_SOURCES,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  FULFILLMENT_TYPES,
  type WrapOrder,
} from '@wrap-roll/contracts';

export const ORDER_VALUES = {
  status: {
    placed: ORDER_STATUSES[0],
    paid: ORDER_STATUSES[1],
    ready: ORDER_STATUSES[3],
  },
  source: {
    clientWeb: ORDER_SOURCES[0],
    cashierOffline: ORDER_SOURCES[3],
  },
  paymentMethod: {
    cash: PAYMENT_METHODS[0],
    online: PAYMENT_METHODS[3],
  },
  paymentStatus: {
    pending: PAYMENT_STATUSES[0],
    completed: PAYMENT_STATUSES[1],
  },
  fulfillment: {
    dineIn: FULFILLMENT_TYPES[0],
    takeaway: FULFILLMENT_TYPES[1],
    delivery: FULFILLMENT_TYPES[2],
  },
} as const;

export function buildWrapOrderFixture(overrides: Partial<WrapOrder> = {}): WrapOrder {
  const now = new Date().toISOString();
  return {
    orderId: uuidv4(),
    status: ORDER_VALUES.status.placed,
    source: ORDER_VALUES.source.clientWeb,
    placedAt: now,
    updatedAt: now,
    customer: {
      name: 'John Doe',
      phone: '0771234567',
    },
    items: [
      {
        lineItemId: uuidv4(),
        wrapId: uuidv4(),
        name: 'Classic Wrap',
        quantity: 1,
        unitPrice: 500,
        availability: 'available',
        modifiers: {
          optionGroups: [
            {
              groupName: 'Build',
              options: [
                { label: 'Whole Wheat' },
                { label: 'Grilled Chicken' },
                { label: 'Lettuce' },
                { label: 'Garlic Aioli' },
              ],
            },
          ],
        },
        lineTotal: 500,
      },
    ],
    pricing: {
      subtotal: 500,
      discountAmount: 0,
      tax: 50,
      deliveryFee: 100,
      total: 650,
    },
    payment: {
      method: ORDER_VALUES.paymentMethod.cash,
      status: ORDER_VALUES.paymentStatus.pending,
    },
    fulfillment: {
      type: ORDER_VALUES.fulfillment.delivery,
      deliveryAddress: '123 Main St, Colombo',
    },
    kitchen: {
      priority: 'normal',
    },
    ...overrides,
  };
}

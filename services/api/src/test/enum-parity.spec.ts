import { OrderSource, OrderStatus, PaymentMethod, PaymentStatus, FulfillmentType } from '@prisma/client';
import {
  ORDER_SOURCES,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  FULFILLMENT_TYPES,
} from '@wrap-roll/contracts';

describe('Contract enum parity', () => {
  it('matches Prisma order/payment/fulfillment enums', () => {
    expect([...ORDER_STATUSES]).toEqual(Object.values(OrderStatus));
    expect([...ORDER_SOURCES]).toEqual(Object.values(OrderSource));
    expect([...PAYMENT_METHODS]).toEqual(Object.values(PaymentMethod));
    expect([...PAYMENT_STATUSES]).toEqual(Object.values(PaymentStatus));
    expect([...FULFILLMENT_TYPES]).toEqual(Object.values(FulfillmentType));
  });
});

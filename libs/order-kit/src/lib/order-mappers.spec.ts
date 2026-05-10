import type { CashierOrderSyncPayload } from '@wrap-roll/contracts';
import {
  cashierPayloadToWrapOrder,
  parseModifiersJson,
  queueOrderLineToCashierLineInput,
  queueOrderToWrapOrder,
} from './order-mappers';
import { formatPaymentCollectionDisplayLabel, type QueueOrder } from '@wrap-roll/contracts';

describe('order-mappers', () => {
  it('formatPaymentCollectionDisplayLabel uses handoff wording for takeaway on_pickup', () => {
    expect(formatPaymentCollectionDisplayLabel('on_pickup', 'takeaway')).toBe('Pay at handoff');
    expect(formatPaymentCollectionDisplayLabel('on_pickup', 'dine_in')).toBe('Pay on pickup');
    expect(formatPaymentCollectionDisplayLabel('at_collection', 'dine_in')).toBe('Pay at table or exit');
  });

  it('falls back to safe defaults for invalid modifiers json', () => {
    expect(parseModifiersJson('nope')).toEqual({
      optionGroups: [],
    });
  });

  it('parseModifiersJson ignores flat legacy keys and only uses optionGroups + notes', () => {
    expect(
      parseModifiersJson({
        base: 'Extra Sauce',
        protein: 'Chicken',
        toppings: ['Onion'],
        notes: 'Light salt',
      }),
    ).toEqual({ optionGroups: [], notes: 'Light salt' });
  });

  it('handles decimal-like string prices from API payloads', () => {
    const queueOrder: QueueOrder = {
      id: '8f9ec849-6a84-4d0c-a072-c2f79e884980',
      status: 'paid',
      paymentStatus: 'completed',
      paymentMethod: 'cash',
      source: 'cashier_pos',
      total: '1500.50',
      subtotal: '1300.00',
      tax: '200.50',
      placedAt: new Date().toISOString(),
      items: [
        {
          id: 'cf06cb9f-d722-443f-b86e-77e153d0e1dc',
          menuItemId: '269f6f68-0cf1-4916-a56d-a0af25058316',
          name: 'Spicy Chicken Wrap',
          quantity: 2,
          unitPrice: '650.25',
          lineTotal: '1300.50',
          modifiersJson:
            '{"optionGroups":[{"groupName":"Build","options":[{"label":"Whole Wheat"},{"label":"Chicken"},{"label":"Onion"}]}]}',
        },
      ],
    };

    const wrapOrder = queueOrderToWrapOrder(queueOrder);
    expect(wrapOrder.pricing.total).toBe(1500.5);
    expect(wrapOrder.items[0].unitPrice).toBe(650.25);
    expect(wrapOrder.items[0].modifiers.optionGroups[0]?.options[0]?.label).toBe('Whole Wheat');
  });

  it('rejects lines without a real menu UUID (avoids fake FKs that break sync)', () => {
    const payload = {
      items: [{ id: 'not-a-uuid', name: 'Wrap', unitPrice: 1000, quantity: 1 }],
      total: 1000,
      paymentMethod: 'CASH' as const,
      fulfillmentType: 'takeaway' as const,
      paymentCollection: 'immediate' as const,
      orderSource: 'cashier_pos' as const,
      createdAt: new Date().toISOString(),
    };
    expect(() => cashierPayloadToWrapOrder(payload, () => '11111111-1111-4111-8111-111111111111')).toThrow(
      /menu product id/i,
    );
  });

  it('keeps phone delivery card orders as deferred pending', () => {
    const payload = {
      items: [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Wrap', unitPrice: 1000, quantity: 1 }],
      total: 1000,
      paymentMethod: 'CARD' as const,
      fulfillmentType: 'delivery' as const,
      paymentCollection: 'on_delivery' as const,
      orderSource: 'cashier_pos_offline' as const,
      createdAt: new Date().toISOString(),
    };
    const wrap = cashierPayloadToWrapOrder(payload, () => '11111111-1111-1111-1111-111111111111');
    expect(wrap.payment.method).toBe('card');
    expect(wrap.payment.status).toBe('pending');
    expect(wrap.payment.transactionId?.startsWith('ON_DELIVERY_')).toBe(true);
    expect(wrap.status).toBe('placed');
  });

  it('maps counter pay-later dine-in (at_collection) to pending with AT_COLLECTION tx prefix', () => {
    const payload = {
      items: [{ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: 'Wrap', unitPrice: 800, quantity: 1 }],
      total: 800,
      paymentMethod: 'CASH' as const,
      fulfillmentType: 'dine_in' as const,
      paymentCollection: 'at_collection' as const,
      orderSource: 'cashier_pos' as const,
      createdAt: new Date().toISOString(),
    };
    const wrap = cashierPayloadToWrapOrder(payload, () => '33333333-3333-3333-3333-333333333333');
    expect(wrap.payment.status).toBe('pending');
    expect(wrap.status).toBe('placed');
    expect(wrap.payment.transactionId?.startsWith('AT_COLLECTION_')).toBe(true);
  });

  it('hydrates amend cart unit price from lineTotal / qty when it diverges from stored unitPrice', () => {
    const line = {
      id: 'cf06cb9f-d722-443f-b86e-77e153d0e1dc',
      menuItemId: '269f6f68-0cf1-4916-a56d-a0af25058316',
      name: 'Bowl',
      quantity: 2,
      unitPrice: 1000,
      lineTotal: 2810,
      modifiersJson: null,
    };
    const input = queueOrderLineToCashierLineInput(line);
    expect(input.unitPrice).toBe(1405);
    expect(input.quantity).toBe(2);
  });

  it('passes normalized discountCode through pricing for server validation', () => {
    const payload = {
      items: [{ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', name: 'Bowl', unitPrice: 1500, quantity: 1 }],
      total: 1500,
      discountCode: 'launch10',
      paymentMethod: 'CASH' as const,
      fulfillmentType: 'takeaway' as const,
      paymentCollection: 'immediate' as const,
      orderSource: 'cashier_pos' as const,
      createdAt: new Date().toISOString(),
    };
    const wrap = cashierPayloadToWrapOrder(payload, () => '22222222-2222-2222-2222-222222222222');
    expect(wrap.pricing.discountCode).toBe('LAUNCH10');
    expect(wrap.pricing.subtotal).toBe(1500);
  });

  it('maps manualDiscountAmount into pricing for supervisor-gated POS discounts', () => {
    const payload = {
      items: [{ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', name: 'Bowl', unitPrice: 1000, quantity: 1 }],
      total: 1000,
      manualDiscountAmount: 50.25,
      paymentMethod: 'CASH' as const,
      fulfillmentType: 'takeaway' as const,
      paymentCollection: 'immediate' as const,
      orderSource: 'cashier_pos' as const,
      createdAt: new Date().toISOString(),
    };
    const wrap = cashierPayloadToWrapOrder(payload, () => '22222222-2222-2222-2222-222222222222');
    expect(wrap.pricing.manualDiscountAmount).toBe(50.25);
  });

  it('coerces string manualDiscountAmount from queued payloads into pricing', () => {
    const payload = {
      items: [{ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', name: 'Bowl', unitPrice: 1000, quantity: 1 }],
      total: 1000,
      manualDiscountAmount: '200,50',
      paymentMethod: 'CASH' as const,
      fulfillmentType: 'takeaway' as const,
      paymentCollection: 'immediate' as const,
      orderSource: 'cashier_pos_offline' as const,
      createdAt: new Date().toISOString(),
    } as unknown as CashierOrderSyncPayload;
    const wrap = cashierPayloadToWrapOrder(payload, () => '22222222-2222-2222-2222-222222222222');
    expect(wrap.pricing.manualDiscountAmount).toBe(200.5);
  });

  it('marks immediate counter card as completed', () => {
    const payload = {
      items: [{ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', name: 'Bowl', unitPrice: 1500, quantity: 1 }],
      total: 1500,
      paymentMethod: 'CARD' as const,
      fulfillmentType: 'dine_in' as const,
      paymentCollection: 'immediate' as const,
      orderSource: 'cashier_pos' as const,
      createdAt: new Date().toISOString(),
    };
    const wrap = cashierPayloadToWrapOrder(payload, () => '22222222-2222-2222-2222-222222222222');
    expect(wrap.payment.status).toBe('completed');
    expect(wrap.status).toBe('paid');
  });

  it('maps cashTenderAuditNote onto payment.posCashTenderNote', () => {
    const payload = {
      items: [{ id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', name: 'Bowl', unitPrice: 1500, quantity: 1 }],
      total: 1500,
      paymentMethod: 'CASH' as const,
      fulfillmentType: 'takeaway' as const,
      paymentCollection: 'immediate' as const,
      orderSource: 'cashier_pos' as const,
      cashTenderAuditNote: 'POS Pay now cash · Tender Rs 1500.00 · Change Rs 0.00',
      createdAt: new Date().toISOString(),
    };
    const wrap = cashierPayloadToWrapOrder(payload, () => '22222222-2222-2222-2222-222222222222');
    expect(wrap.payment.posCashTenderNote).toBe('POS Pay now cash · Tender Rs 1500.00 · Change Rs 0.00');
  });
});

import { cashierPayloadToWrapOrder, parseModifiersJson, queueOrderToWrapOrder } from './order-mappers';
import type { QueueOrder } from '@wrap-roll/contracts';

describe('order-mappers', () => {
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

  it('keeps phone delivery card orders as deferred pending', () => {
    const payload = {
      items: [{ id: 'p1', name: 'Wrap', unitPrice: 1000, quantity: 1 }],
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

  it('marks immediate counter card as completed', () => {
    const payload = {
      items: [{ id: 'p2', name: 'Bowl', unitPrice: 1500, quantity: 1 }],
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
});

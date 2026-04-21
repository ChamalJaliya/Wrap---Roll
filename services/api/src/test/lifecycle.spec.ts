import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from './test-utils';
import { v4 as uuidv4 } from 'uuid';
import { ORDER_VALUES, buildWrapOrderFixture } from './fixtures/order-fixtures';

describe('Order Lifecycle Integration (Mocked)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should complete lifecycle: placed -> paid webhook accepted', async () => {
    // 1. Place Order
    const orderId = uuidv4();
    const orderPayload = buildWrapOrderFixture({
      orderId,
      customer: { name: 'Lifecycle Test' },
      payment: { method: ORDER_VALUES.paymentMethod.cash, status: ORDER_VALUES.paymentStatus.completed },
      fulfillment: { type: ORDER_VALUES.fulfillment.takeaway },
      pricing: { subtotal: 1000, tax: 0, total: 1000, discountAmount: 0, deliveryFee: 0 },
      items: [
        {
          lineItemId: uuidv4(),
          wrapId: uuidv4(),
          name: 'Integration Wrap',
          quantity: 1,
          unitPrice: 1000,
          availability: 'available',
          modifiers: {
            optionGroups: [
              { groupName: 'Test group', options: [{ label: 'Test' }, { label: 'Test' }] },
            ],
          },
          lineTotal: 1000,
        },
      ],
    });
    const placeRes = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', 'Bearer token')
      .send(orderPayload);
    
    expect(placeRes.status).toBe(201);
    const createdId = placeRes.body.id;

    // 2. Mock Payment via Webhook (Simulates 'paid')
    const webhookRes = await request(app.getHttpServer())
      .post('/api/payment/webhook')
      .send({
        merchant_id: 'dummy_merchant_id',
        order_id: createdId,
        payhere_amount: '1000.00',
        payhere_currency: 'LKR',
        status_code: '2',
        payment_id: 'PAY-LC-001',
        md5sig: '674E6F74D38EC0A92C92E87CD3E97F1D' 
      });
    
    expect(webhookRes.status).toBe(200);

    // Status progression is tested in order.service.spec; here we focus on API wiring.
  });
});

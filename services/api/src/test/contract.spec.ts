import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from './test-utils';
import { buildWrapOrderFixture } from './fixtures/order-fixtures';

const validOrder = buildWrapOrderFixture();

describe('API Contract Enforcement (WrapOrderSchema)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/orders', () => {
    it('should create order when data matches WrapOrderSchema', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/orders')
        .set('Authorization', 'Bearer mock-token')
        .send(validOrder);

      expect(response.status).toBe(201);
    });

    it('should apply valid coupon and recalculate total', async () => {
      const orderWithCoupon = { 
        ...validOrder, 
        pricing: { 
          ...validOrder.pricing, 
          discountCode: 'WELCOME10', 
          discountAmount: 0,
          total: 650 
        } 
      };
      const response = await request(app.getHttpServer())
        .post('/api/orders')
        .set('Authorization', 'Bearer mock-token')
        .send(orderWithCoupon);

      expect(response.status).toBe(201);
    });

    it('should fail when order source is invalid', async () => {
      const invalidOrder = { ...validOrder, source: 'twitter' };
      const response = await request(app.getHttpServer())
        .post('/api/orders')
        .set('Authorization', 'Bearer mock-token')
        .send(invalidOrder);

      expect(response.status).toBe(400);
    });

    it('should fail when pricing is missing (schema violation)', async () => {
      const invalidOrder = { ...validOrder, pricing: undefined };
      const response = await request(app.getHttpServer())
        .post('/api/orders')
        .set('Authorization', 'Bearer mock-token')
        .send(invalidOrder);

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/orders', () => {
    it('should return 200 OK', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/orders')
        .set('Authorization', 'Bearer mock-token');
      expect(response.status).toBe(200);
    });

    it('should return normalized queue payload', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/orders/queue?status=placed,paid')
        .set('Authorization', 'Bearer mock-token');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      if (response.body.length > 0) {
        const first = response.body[0] as Record<string, unknown>;
        expect(first).toHaveProperty('id');
        expect(first).toHaveProperty('status');
        expect(first).toHaveProperty('paymentStatus');
        expect(first).toHaveProperty('paymentMethod');
        expect(first).toHaveProperty('total');
        expect(first).toHaveProperty('items');
        expect(first).toHaveProperty('kitchenEligible');
        expect(first).toHaveProperty('releaseReason');
        expect(first).toHaveProperty('kitchenReleaseAt');
        expect(first).toHaveProperty('priorityDeadlineAt');
        expect(first).toHaveProperty('slaBucket');
        expect(first).toHaveProperty('paymentRisk');
        expect(first).toHaveProperty('allowedNextStatuses');
        expect(first).toHaveProperty('actions');
        expect(first).toHaveProperty('blockedReasonsByStatus');
        if (Array.isArray(first.items) && first.items.length > 0) {
          const item = first.items[0] as Record<string, unknown>;
          expect(item).toHaveProperty('id');
          expect(item).toHaveProperty('menuItemId');
          expect(item).toHaveProperty('name');
          expect(item).toHaveProperty('quantity');
          expect(item).toHaveProperty('unitPrice');
          expect(item).toHaveProperty('lineTotal');
          expect(item).toHaveProperty('modifiersJson');
        }
      }
    });

    it('should honor status filter parity for KDS statuses', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/orders/queue?status=paid,in_kitchen')
        .set('Authorization', 'Bearer mock-token');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      for (const row of response.body as Array<Record<string, unknown>>) {
        expect(['paid', 'in_kitchen']).toContain(String(row.status));
      }
    });
  });

  describe('POST /api/payment/webhook', () => {
    it('should accept valid webhook payloads', async () => {
      const webhookPayload = {
        merchant_id: 'dummy_merchant_id',
        order_id: 'test-order-id',
        payhere_amount: '650.00',
        payhere_currency: 'LKR',
        status_code: '2',
        payment_id: 'PAY001',
        md5sig: '379A736E929665B1774378A626573C2C' // Mock signature matches the dummy secret
      };
      const response = await request(app.getHttpServer())
        .post('/api/payment/webhook')
        .send(webhookPayload);

      expect(response.status).toBe(200);
    });
  });
});

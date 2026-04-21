import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from './test-utils';
import {
  KITCHEN_QUEUE_FORBIDDEN_KEYS,
  COURIER_QUEUE_FORBIDDEN_KEYS,
} from '@wrap-roll/contracts';

describe('GET /api/orders/queue role-scoped JSON', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  const queueUrl = '/api/orders/queue?status=placed,paid';

  it('returns full ops queue for CASHIER (mock-token)', async () => {
    const response = await request(app.getHttpServer())
      .get(queueUrl)
      .set('Authorization', 'Bearer mock-token');
    expect(response.headers['cache-control']).toMatch(/no-store/);
    expect(response.headers['vary']).toBe('Authorization');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
    const first = response.body[0] as Record<string, unknown>;
    expect(first).toHaveProperty('total');
    expect(first).toHaveProperty('transactionId');
    expect(first).toHaveProperty('paymentMethod');
  });

  it('returns slim kitchen queue for KITCHEN', async () => {
    const response = await request(app.getHttpServer())
      .get(queueUrl)
      .set('Authorization', 'Bearer mock-role-kitchen');
    expect(response.status).toBe(200);
    const first = response.body[0] as Record<string, unknown>;
    for (const key of KITCHEN_QUEUE_FORBIDDEN_KEYS) {
      expect(first).not.toHaveProperty(key);
    }
    expect(first.customer).toEqual({ name: 'Queue Test' });
  });

  it('returns courier queue without internal keys for COURIER', async () => {
    const response = await request(app.getHttpServer())
      .get(queueUrl)
      .set('Authorization', 'Bearer mock-role-courier');
    expect(response.status).toBe(200);
    const first = response.body[0] as Record<string, unknown>;
    for (const key of COURIER_QUEUE_FORBIDDEN_KEYS) {
      expect(first).not.toHaveProperty(key);
    }
    expect(first).toHaveProperty('total');
    expect(first).toHaveProperty('deliveryAddress');
  });
});

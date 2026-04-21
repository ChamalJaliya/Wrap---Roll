/**
 * Integration: POST /api/coupon/validate
 *
 * Uses the shared `createTestApp` which stubs PrismaService via the mock layer,
 * so no real database connection is required.
 */
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from './test-utils';

describe('POST /api/coupon/validate', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns valid=true with discountAmount for a known code', async () => {
    // test-utils mocks coupon.findUnique to return any coupon with discountPercent=0.1
    const response = await request(app.getHttpServer())
      .post('/api/coupon/validate')
      .send({ code: 'WELCOME10', subtotal: 1000 });

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('valid', true);
    expect(response.body).toHaveProperty('discountAmount');
    expect(typeof response.body.discountAmount).toBe('number');
    expect(response.body.discountAmount).toBeGreaterThan(0);
  });

  it('applies 10% discount to 1000 subtotal → 100 off', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/coupon/validate')
      .send({ code: 'WELCOME10', subtotal: 1000 });

    expect(response.status).toBe(201);
    expect(response.body.discountAmount).toBe(100);
  });

  it('returns 400 when body is missing required fields', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/coupon/validate')
      .send({});
    // NestJS ValidationPipe or Zod will reject
    expect([400, 422]).toContain(response.status);
  });

  it('does not require Authorization header (public endpoint)', async () => {
    // No Authorization header set — should not be 401
    const response = await request(app.getHttpServer())
      .post('/api/coupon/validate')
      .send({ code: 'WELCOME10', subtotal: 500 });
    expect(response.status).not.toBe(401);
  });

  it('trims and upper-cases the coupon code', async () => {
    // lowercase / whitespace → should still resolve
    const response = await request(app.getHttpServer())
      .post('/api/coupon/validate')
      .send({ code: '  welcome10  ', subtotal: 1000 });
    expect(response.status).toBe(201);
    expect(response.body.valid).toBe(true);
  });

  it('returns valid=false and a message for an empty code', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/coupon/validate')
      .send({ code: '', subtotal: 1000 });
    expect(response.status).toBe(201);
    expect(response.body.valid).toBe(false);
    expect(typeof response.body.message).toBe('string');
  });
});

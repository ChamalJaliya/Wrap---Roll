import request from 'supertest';
import { createTestApp } from './test-utils';

/** Regression: PATCH .../line-items must be registered (not 404). */
describe('PATCH orders/:id/line-items', () => {
  it('hits the handler (not Nest 404)', async () => {
    const app = await createTestApp();
    try {
      const res = await request(app.getHttpServer())
        .patch('/api/orders/00000000-0000-4000-8000-000000000001/line-items')
        .set('Authorization', 'Bearer mock-token')
        .send({
          items: [],
          note: 'test',
        });
      expect(res.status).not.toBe(404);
      expect(res.body?.message).not.toMatch(/^Cannot PATCH /);
    } finally {
      await app.close();
    }
  });
});

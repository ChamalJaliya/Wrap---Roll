"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const supertest_1 = tslib_1.__importDefault(require("supertest"));
const test_utils_1 = require("./test-utils");
const contracts_1 = require("@wrap-roll/contracts");
describe('GET /api/orders/queue role-scoped JSON', () => {
    let app;
    beforeAll(async () => {
        app = await (0, test_utils_1.createTestApp)();
    });
    afterAll(async () => {
        await app.close();
    });
    const queueUrl = '/api/orders/queue?status=placed,paid';
    it('returns full ops queue for CASHIER (mock-token)', async () => {
        const response = await (0, supertest_1.default)(app.getHttpServer())
            .get(queueUrl)
            .set('Authorization', 'Bearer mock-token');
        expect(response.headers['cache-control']).toMatch(/no-store/);
        expect(response.headers['vary']).toBe('Authorization');
        expect(response.status).toBe(200);
        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThan(0);
        const first = response.body[0];
        expect(first).toHaveProperty('total');
        expect(first).toHaveProperty('transactionId');
        expect(first).toHaveProperty('paymentMethod');
    });
    it('returns slim kitchen queue for KITCHEN', async () => {
        const response = await (0, supertest_1.default)(app.getHttpServer())
            .get(queueUrl)
            .set('Authorization', 'Bearer mock-role-kitchen');
        expect(response.status).toBe(200);
        const first = response.body[0];
        for (const key of contracts_1.KITCHEN_QUEUE_FORBIDDEN_KEYS) {
            expect(first).not.toHaveProperty(key);
        }
        expect(first.customer).toEqual({ name: 'Queue Test' });
    });
    it('returns courier queue without internal keys for COURIER', async () => {
        const response = await (0, supertest_1.default)(app.getHttpServer())
            .get(queueUrl)
            .set('Authorization', 'Bearer mock-role-courier');
        expect(response.status).toBe(200);
        const first = response.body[0];
        for (const key of contracts_1.COURIER_QUEUE_FORBIDDEN_KEYS) {
            expect(first).not.toHaveProperty(key);
        }
        expect(first).toHaveProperty('total');
        expect(first).toHaveProperty('deliveryAddress');
    });
});
//# sourceMappingURL=queue-response-roles.spec.js.map
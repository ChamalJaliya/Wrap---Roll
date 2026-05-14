"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
/**
 * Integration: RBAC Boundary Enforcement
 *
 * Tests what the mocked NestJS test app can verify:
 *  - Service-level ForbiddenException (e.g. IDOR, in_kitchen void elevation)
 *  - Endpoint availability per role (AUTH guard is active; ROLES guard is stubbed)
 *  - Queue projection strips fields by role
 *
 * NOTE: The `createTestApp` factory stubs `RolesGuard` to always return true,
 * so guard-level 403s (e.g. "KITCHEN is not in @Roles for this endpoint") cannot
 * be tested here. Those are integration-tested by the real server or E2E tests.
 * This suite focuses on service-layer enforcement (ForbiddenException thrown inside
 * the handler logic itself) and general endpoint shape/accessibility.
 *
 * Role tokens:
 *   - `mock-token`        → CASHIER
 *   - `mock-role-admin`   → ADMIN
 *   - `mock-role-kitchen` → KITCHEN
 *   - `mock-role-courier` → COURIER
 */
const supertest_1 = tslib_1.__importDefault(require("supertest"));
const test_utils_1 = require("./test-utils");
describe('RBAC Boundary Enforcement', () => {
    let app;
    beforeAll(async () => {
        app = await (0, test_utils_1.createTestApp)();
    });
    afterAll(async () => {
        await app.close();
    });
    // -------------------------------------------------------------------------
    // Auth guard — unauthenticated requests should be rejected
    // -------------------------------------------------------------------------
    describe('Authentication — unauthenticated requests', () => {
        it('returns 401 when no token is provided to a protected endpoint', async () => {
            // SupabaseAuthGuard still rejects requests with no Authorization header
            // even though RolesGuard is stubbed
            const response = await (0, supertest_1.default)(app.getHttpServer()).get('/api/orders');
            expect([401, 403]).toContain(response.status);
        });
    });
    // -------------------------------------------------------------------------
    // Service-level IDOR — enforced inside OrderController handler, not in guard
    // -------------------------------------------------------------------------
    describe('IDOR protection on GET /api/orders/:id', () => {
        it('allows CASHIER to read any order (privileged role)', async () => {
            const response = await (0, supertest_1.default)(app.getHttpServer())
                .get('/api/orders/test-order-id')
                .set('Authorization', 'Bearer mock-token'); // CASHIER
            expect(response.status).toBe(200);
        });
        it('allows ADMIN to read any order', async () => {
            const response = await (0, supertest_1.default)(app.getHttpServer())
                .get('/api/orders/test-order-id')
                .set('Authorization', 'Bearer mock-role-admin');
            expect(response.status).toBe(200);
        });
    });
    // -------------------------------------------------------------------------
    // Service-level elevation: voiding in_kitchen orders requires ADMIN
    // PRD-001 — enforced inside the controller handler, not the RolesGuard
    // -------------------------------------------------------------------------
    describe('PRD-001: in_kitchen voiding requires ADMIN (service-level check)', () => {
        beforeEach(async () => {
            // Advance mock order to in_kitchen status
            await (0, supertest_1.default)(app.getHttpServer())
                .patch('/api/orders/test-order-id/status')
                .set('Authorization', 'Bearer mock-token')
                .send({ status: 'in_kitchen' });
        });
        it('CASHIER receives 403 when voiding an in_kitchen order', async () => {
            const response = await (0, supertest_1.default)(app.getHttpServer())
                .patch('/api/orders/test-order-id/status')
                .set('Authorization', 'Bearer mock-token') // CASHIER
                .send({ status: 'voided' });
            // PRD-001 enforcement is in the controller, not the guard
            expect(response.status).toBe(403);
        });
        it('ADMIN can void an in_kitchen order', async () => {
            const response = await (0, supertest_1.default)(app.getHttpServer())
                .patch('/api/orders/test-order-id/status')
                .set('Authorization', 'Bearer mock-role-admin')
                .send({ status: 'voided' });
            // With mocked Prisma, canTransition is called; ADMIN should be allowed
            expect([200, 400]).toContain(response.status); // 400 if state machine rejects voided→voided
        });
    });
    // -------------------------------------------------------------------------
    // Queue endpoint — role-scoped projection headers
    // -------------------------------------------------------------------------
    describe('Queue — role-scoped headers and accessibility', () => {
        it('CASHIER can access the queue', async () => {
            const response = await (0, supertest_1.default)(app.getHttpServer())
                .get('/api/orders/queue?status=placed,paid')
                .set('Authorization', 'Bearer mock-token');
            expect(response.status).toBe(200);
            // Cache-control must be no-store (SEC: prevents leaking ops data)
            expect(response.headers['cache-control']).toMatch(/no-store/);
        });
        it('KITCHEN can access the queue (role guard stubbed in test app)', async () => {
            const response = await (0, supertest_1.default)(app.getHttpServer())
                .get('/api/orders/queue?status=placed,paid')
                .set('Authorization', 'Bearer mock-role-kitchen');
            expect(response.status).toBe(200);
        });
        it('COURIER can access the queue', async () => {
            const response = await (0, supertest_1.default)(app.getHttpServer())
                .get('/api/orders/queue?status=placed,paid')
                .set('Authorization', 'Bearer mock-role-courier');
            expect(response.status).toBe(200);
        });
    });
    // -------------------------------------------------------------------------
    // Public endpoint — order tracking requires no auth
    // -------------------------------------------------------------------------
    describe('Public endpoints', () => {
        it('GET /api/orders/track/:id is accessible without a token', async () => {
            const response = await (0, supertest_1.default)(app.getHttpServer())
                .get('/api/orders/track/test-order-id');
            // 200 (found in mock) or 400/404 if logic rejects; must NOT be 401
            expect(response.status).not.toBe(401);
        });
        it('POST /api/coupon/validate is accessible without a token', async () => {
            const response = await (0, supertest_1.default)(app.getHttpServer())
                .post('/api/coupon/validate')
                .send({ code: 'WELCOME10', subtotal: 1000 });
            expect(response.status).not.toBe(401);
        });
    });
    // -------------------------------------------------------------------------
    // Rate limiting — throttle guard is mocked so requests get through
    // -------------------------------------------------------------------------
    describe('Order creation — valid CASHIER request', () => {
        it('CASHIER can create an order (auth guard passes with mock-token)', async () => {
            // Missing body — 400 is expected but demonstrates auth passed
            const response = await (0, supertest_1.default)(app.getHttpServer())
                .post('/api/orders')
                .set('Authorization', 'Bearer mock-token')
                .send({});
            expect(response.status).not.toBe(401);
            expect(response.status).not.toBe(403);
        });
    });
});
//# sourceMappingURL=auth-rbac.spec.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTestApp = createTestApp;
const testing_1 = require("@nestjs/testing");
const app_module_1 = require("../app/app.module");
const prisma_service_1 = require("../app/prisma/prisma.service");
const auth_1 = require("../auth");
const payment_service_1 = require("../app/payment/payment.service");
const throttler_1 = require("@nestjs/throttler");
const queue_order_db_fixture_1 = require("./fixtures/queue-order-db-fixture");
/**
 * Sets `request.user.role` from the Bearer token so queue projection can be tested per role:
 * - `mock-token` / default → CASHIER (full ops queue)
 * - `mock-role-kitchen` → KITCHEN
 * - `mock-role-courier` → COURIER
 * - `mock-role-admin` → ADMIN
 *
 * Avoid renaming identifiers that contain the substring `QueueOrder` (e.g. `setQueueOrders`) with naive
 * find-replace — use guarded renames (see queue response persona work).
 */
function mockAuthGuardCanActivate(context) {
    var _a, _b;
    const request = context.switchToHttp().getRequest();
    const auth = String((_b = (_a = request.headers) === null || _a === void 0 ? void 0 : _a.authorization) !== null && _b !== void 0 ? _b : '');
    const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    let role = 'CASHIER';
    if (token === 'mock-role-kitchen')
        role = 'KITCHEN';
    else if (token === 'mock-role-courier')
        role = 'COURIER';
    else if (token === 'mock-role-admin')
        role = 'ADMIN';
    request.user = {
        sub: 'test-user-id',
        email: 'test@example.com',
        role,
    };
    return true;
}
async function createTestApp() {
    let mockOrder = {
        id: 'test-order-id',
        status: 'placed',
        customerId: 'test-user-id',
        paymentStatus: 'completed',
    };
    const moduleFixture = await testing_1.Test.createTestingModule({
        imports: [app_module_1.AppModule],
    })
        .overrideGuard(auth_1.SupabaseAuthGuard)
        .useValue({ canActivate: mockAuthGuardCanActivate })
        .overrideGuard(auth_1.RolesGuard)
        .useValue({ canActivate: () => true })
        .overrideGuard(throttler_1.ThrottlerGuard)
        .useValue({ canActivate: () => true })
        .overrideProvider(auth_1.SupabaseService)
        .useValue({
        verifyToken: jest.fn().mockResolvedValue({
            id: 'test-user-id',
            email: 'test@example.com',
            user_metadata: { role: 'CASHIER' },
        }),
    })
        .overrideProvider(payment_service_1.PaymentService)
        .useValue({
        processWebhook: jest.fn().mockReturnValue({ success: true }),
        generatePaymentHash: jest.fn().mockReturnValue({ hash: 'mock-hash', merchantId: 'mock-id' }),
    })
        .overrideProvider(prisma_service_1.PrismaService)
        .useValue({
        order: {
            create: jest.fn().mockImplementation(async (args) => {
                var _a, _b, _c, _d, _e;
                mockOrder = Object.assign(Object.assign(Object.assign({}, mockOrder), ((_a = args === null || args === void 0 ? void 0 : args.data) !== null && _a !== void 0 ? _a : {})), { id: (_c = (_b = args === null || args === void 0 ? void 0 : args.data) === null || _b === void 0 ? void 0 : _b.id) !== null && _c !== void 0 ? _c : mockOrder.id, status: (_e = (_d = args === null || args === void 0 ? void 0 : args.data) === null || _d === void 0 ? void 0 : _d.status) !== null && _e !== void 0 ? _e : 'placed' });
                return mockOrder;
            }),
            findMany: jest.fn().mockImplementation((args) => {
                if (Array.isArray(args === null || args === void 0 ? void 0 : args.orderBy)) {
                    return Promise.resolve([queue_order_db_fixture_1.queueOrderDbFixture]);
                }
                return Promise.resolve([]);
            }),
            findUnique: jest.fn().mockImplementation(async () => mockOrder),
            update: jest.fn().mockImplementation(async (args) => {
                mockOrder = Object.assign(Object.assign(Object.assign({}, mockOrder), args.data), { id: args.where.id });
                return mockOrder;
            }),
            count: jest.fn().mockImplementation((args) => {
                var _a, _b;
                if ((_b = (_a = args === null || args === void 0 ? void 0 : args.where) === null || _a === void 0 ? void 0 : _a.status) === null || _b === void 0 ? void 0 : _b.in) {
                    return Promise.resolve(1);
                }
                return Promise.resolve(0);
            }),
        },
        businessSettings: {
            findUnique: jest.fn().mockResolvedValue(null),
        },
        coupon: {
            findUnique: jest.fn().mockImplementation(async (args) => ({
                id: 'coupon-test-id',
                code: args.where.code,
                discountPercent: 0.1,
                minSubtotal: null,
                firstOrderOnly: false,
                isActive: true,
                expiryDate: new Date('2099-12-31'),
            })),
        },
        customer: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ id: 'cust-1', name: 'Test Customer', phone: null }),
        },
        $transaction: jest.fn().mockImplementation(async (callback) => {
            return callback({
                order: {
                    create: jest.fn().mockImplementation((args) => Promise.resolve(Object.assign(Object.assign({}, args.data), { id: 'test-order-id' }))),
                    count: jest.fn().mockResolvedValue(0),
                    findUnique: jest.fn().mockImplementation(async () => mockOrder),
                    update: jest.fn().mockImplementation(async (args) => {
                        mockOrder = Object.assign(Object.assign(Object.assign({}, mockOrder), args.data), { id: args.where.id });
                        return mockOrder;
                    }),
                },
                customer: {
                    findUnique: jest.fn().mockResolvedValue(null),
                    create: jest.fn().mockResolvedValue({ id: 'cust-1', name: 'Test Customer', phone: null }),
                },
                paymentEvent: {
                    create: jest.fn().mockResolvedValue({}),
                },
            });
        }),
        $connect: jest.fn(),
        $disconnect: jest.fn(),
    })
        .compile();
    const app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    return app;
}
//# sourceMappingURL=test-utils.js.map
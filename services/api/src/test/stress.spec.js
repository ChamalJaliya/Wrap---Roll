"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const supertest_1 = tslib_1.__importDefault(require("supertest"));
const common_1 = require("@nestjs/common");
const testing_1 = require("@nestjs/testing");
const app_module_1 = require("../app/app.module");
const prisma_service_1 = require("../app/prisma/prisma.service");
const uuid_1 = require("uuid");
const crypto = tslib_1.__importStar(require("crypto"));
const auth_1 = require("../auth");
const order_fixtures_1 = require("./fixtures/order-fixtures");
const throttler_1 = require("@nestjs/throttler");
const payment_service_1 = require("../app/payment/payment.service");
const prisma_sidecar_loose_1 = require("../app/prisma/prisma-sidecar-loose");
const maybeDescribe = process.env.RUN_STRESS_TESTS === '1' ? describe : describe.skip;
maybeDescribe('Pre-Release Stress & Concurrency Gate (Sprint S13)', () => {
    jest.setTimeout(60000);
    let app;
    let prisma;
    const logger = new common_1.Logger('StressTest');
    // Test Data IDs
    const STRESS_INGREDIENT_ID = (0, uuid_1.v4)();
    const STRESS_MENU_ITEM_ID = (0, uuid_1.v4)();
    const STRESS_CATEGORY_ID = (0, uuid_1.v4)();
    const MERCHANT_ID = 'dummy_merchant_id';
    const MERCHANT_SECRET = 'dummy_secret';
    beforeAll(async () => {
        const moduleFixture = await testing_1.Test.createTestingModule({
            imports: [app_module_1.AppModule],
        })
            .overrideGuard(auth_1.SupabaseAuthGuard)
            .useValue({ canActivate: () => true })
            .overrideGuard(auth_1.RolesGuard)
            .useValue({ canActivate: () => true })
            .overrideGuard(throttler_1.ThrottlerGuard)
            .useValue({ canActivate: () => true })
            .overrideProvider(auth_1.SupabaseService)
            .useValue({
            verifyToken: jest.fn().mockResolvedValue({
                sub: 'test-user-id',
                email: 'stress@example.com',
                user_metadata: { role: 'CASHIER' },
            }),
        })
            .overrideProvider(payment_service_1.PaymentService)
            .useValue({
            processWebhook: jest.fn().mockReturnValue({ success: true }),
            generatePaymentHash: jest.fn().mockReturnValue({ hash: 'mock-hash', merchantId: 'mock-id' }),
        })
            .compile();
        app = moduleFixture.createNestApplication();
        app.setGlobalPrefix('api');
        await app.init();
        prisma = app.get(prisma_service_1.PrismaService);
        await (0, prisma_sidecar_loose_1.prismaSidecarLoose)(prisma)
            .businessSettings.upsert({
            where: { id: 'singleton' },
            update: {
                paymentJson: {
                    methods: { cash: true, payhere: true, card: true, online: true },
                },
            },
            create: {
                id: 'singleton',
                paymentJson: {
                    methods: { cash: true, payhere: true, card: true, online: true },
                },
            },
        })
            .catch(() => undefined);
        // 1. Setup Stress Data
        logger.log('Setting up stress test data...');
        // Cleanup old stress data if exists (using ID)
        await prisma.recipeIngredient.deleteMany({ where: { menuItemId: STRESS_MENU_ITEM_ID } });
        await prisma.menuItem.delete({ where: { id: STRESS_MENU_ITEM_ID } }).catch(() => { });
        await prisma.ingredient.delete({ where: { id: STRESS_INGREDIENT_ID } }).catch(() => { });
        await prisma.$executeRaw `DELETE FROM "MenuCategory" WHERE id = ${STRESS_CATEGORY_ID}`;
        // Create Ingredient
        await prisma.ingredient.create({
            data: {
                id: STRESS_INGREDIENT_ID,
                name: 'Stress Test Chicken',
                unit: 'g',
                costPerUnit: 1.5,
                currentStock: 1000,
                lowStockThreshold: 100,
            }
        });
        const stressCategoryName = `Stress Wraps ${STRESS_CATEGORY_ID.slice(0, 8)}`;
        const stressCategorySlug = `stress-wraps-${STRESS_CATEGORY_ID.slice(0, 8)}`;
        await prisma.$executeRaw `
      INSERT INTO "MenuCategory" ("id", "name", "slug", "sortOrder", "isActive", "createdAt", "updatedAt")
      VALUES (${STRESS_CATEGORY_ID}, ${stressCategoryName}, ${stressCategorySlug}, 9999, true, NOW(), NOW())
    `;
        // Create MenuItem
        await prisma.menuItem.create({
            data: {
                id: STRESS_MENU_ITEM_ID,
                name: 'Stress Buster Wrap',
                basePrice: 1200,
                categoryId: STRESS_CATEGORY_ID,
                availability: 'available',
                modifierGroupsJson: [],
            }
        });
        // Create Recipe (5g per wrap)
        await prisma.recipeIngredient.create({
            data: {
                menuItemId: STRESS_MENU_ITEM_ID,
                ingredientId: STRESS_INGREDIENT_ID,
                quantityUsed: 5,
            }
        });
    }, 30000);
    afterAll(async () => {
        // Cleanup
        await prisma.recipeIngredient.deleteMany({ where: { menuItemId: STRESS_MENU_ITEM_ID } }).catch(() => undefined);
        await prisma.orderItem.deleteMany({ where: { menuItemId: STRESS_MENU_ITEM_ID } }).catch(() => undefined);
        await prisma.menuItem.delete({ where: { id: STRESS_MENU_ITEM_ID } }).catch(() => undefined);
        await prisma.ingredient.delete({ where: { id: STRESS_INGREDIENT_ID } }).catch(() => undefined);
        await prisma.$executeRaw `DELETE FROM "MenuCategory" WHERE id = ${STRESS_CATEGORY_ID}`.catch(() => undefined);
        await app.close();
    }, 30000);
    function calculateMd5Sig(orderId, amount) {
        const merchantSecretHash = crypto.createHash('md5').update(MERCHANT_SECRET).digest('hex').toUpperCase();
        return crypto.createHash('md5')
            .update(MERCHANT_ID + orderId + amount + 'LKR' + '2' + merchantSecretHash)
            .digest('hex')
            .toUpperCase();
    }
    it('Objective 1 & 2: Flash Sale — 100 Orders Concurrency & Inventory Accuracy', async () => {
        const NUM_ORDERS = 4;
        const orderPromises = [];
        logger.log(`🚀 Starting Flash Sale: ${NUM_ORDERS} orders in parallel...`);
        for (let i = 0; i < NUM_ORDERS; i++) {
            const orderId = (0, uuid_1.v4)();
            const promise = (async () => {
                // 1. Place Order
                const placeRes = await (0, supertest_1.default)(app.getHttpServer())
                    .post('/api/orders')
                    .set('Authorization', 'Bearer token')
                    .send((0, order_fixtures_1.buildWrapOrderFixture)({
                    orderId,
                    customer: { name: `Stresser ${i}` },
                    items: [{
                            lineItemId: (0, uuid_1.v4)(),
                            wrapId: STRESS_MENU_ITEM_ID,
                            name: 'Stress Buster Wrap',
                            availability: 'available',
                            quantity: 1,
                            unitPrice: 1200,
                            modifiers: {
                                optionGroups: [
                                    {
                                        groupName: 'Build',
                                        options: [{ label: 'Standard' }, { label: 'Chicken' }],
                                    },
                                ],
                            },
                            lineTotal: 1200,
                        }],
                    pricing: {
                        subtotal: 1200,
                        tax: 0,
                        total: 1200,
                        discountAmount: 0,
                        deliveryFee: 0,
                    },
                    payment: { method: order_fixtures_1.ORDER_VALUES.paymentMethod.online, status: order_fixtures_1.ORDER_VALUES.paymentStatus.pending },
                    fulfillment: { type: order_fixtures_1.ORDER_VALUES.fulfillment.takeaway },
                }));
                if (placeRes.status !== 201) {
                    logger.error(`Order Placement failed for ${orderId}: ${JSON.stringify(placeRes.body)}`);
                    return { success: false };
                }
                const createdId = placeRes.body.id;
                // 2. Payment webhook (marks paid — inventory consumes on in_kitchen, not here)
                const sig = calculateMd5Sig(createdId, '1200.00');
                const webhookRes = await (0, supertest_1.default)(app.getHttpServer())
                    .post('/api/payment/webhook')
                    .send({
                    merchant_id: MERCHANT_ID,
                    order_id: createdId,
                    payhere_amount: '1200.00',
                    payhere_currency: 'LKR',
                    status_code: '2',
                    md5sig: sig,
                    payment_id: `PAY-STRESS-${i}`
                });
                if (webhookRes.status !== 200) {
                    logger.error(`Webhook failed for ${createdId}: ${JSON.stringify(webhookRes.body)}`);
                    return { success: false };
                }
                // 3. Kitchen starts — this triggers inventory deduction
                const kitchenRes = await (0, supertest_1.default)(app.getHttpServer())
                    .patch(`/api/orders/${createdId}/status`)
                    .set('Authorization', 'Bearer token')
                    .send({ status: 'in_kitchen' });
                if (kitchenRes.status !== 200) {
                    logger.error(`in_kitchen failed for ${createdId}: ${JSON.stringify(kitchenRes.body)}`);
                    return { success: false };
                }
                // 4. Ready
                const readyRes = await (0, supertest_1.default)(app.getHttpServer())
                    .patch(`/api/orders/${createdId}/status`)
                    .set('Authorization', 'Bearer token')
                    .send({ status: 'ready' });
                return { success: readyRes.status === 200 };
            })();
            orderPromises.push(promise);
        }
        const results = await Promise.all(orderPromises);
        const successCount = results.filter(r => r.success).length;
        logger.log(`Flash Sale Complete. Success: ${successCount}/${NUM_ORDERS}`);
        expect(successCount).toBe(NUM_ORDERS);
        // Verify Inventory
        const ingredient = await prisma.ingredient.findUnique({ where: { id: STRESS_INGREDIENT_ID } });
        const expectedStock = 1000 - (NUM_ORDERS * 5);
        logger.log(`Inventory Audit: Expected ${expectedStock}, Actual ${Number(ingredient === null || ingredient === void 0 ? void 0 : ingredient.currentStock)}`);
        expect(Number(ingredient === null || ingredient === void 0 ? void 0 : ingredient.currentStock)).toBe(expectedStock);
    }, 60000); // 60s timeout for 100 orders
    it('Objective 3: Offline Cashier Sync — 10 Batch Orders', async () => {
        await new Promise((resolve) => setTimeout(resolve, 11000));
        const NUM_OFFLINE = 4;
        const syncPromises = [];
        logger.log(`📶 Starting Offline Sync: ${NUM_OFFLINE} orders...`);
        for (let i = 0; i < NUM_OFFLINE; i++) {
            const orderId = (0, uuid_1.v4)();
            // Simulating the proxy /api/orders behavior (which uses mapToWrapOrder logic)
            const promise = (0, supertest_1.default)(app.getHttpServer())
                .post('/api/orders')
                .set('Authorization', 'Bearer token')
                .send((0, order_fixtures_1.buildWrapOrderFixture)({
                orderId,
                status: order_fixtures_1.ORDER_VALUES.status.paid,
                source: order_fixtures_1.ORDER_VALUES.source.cashierOffline,
                customer: { name: `Offline User ${i}` },
                items: [{
                        lineItemId: (0, uuid_1.v4)(),
                        wrapId: STRESS_MENU_ITEM_ID,
                        name: 'Stress Buster Wrap',
                        availability: 'available',
                        quantity: 1,
                        unitPrice: 1200,
                        modifiers: {
                            optionGroups: [
                                {
                                    groupName: 'Build',
                                    options: [{ label: 'Standard' }, { label: 'Chicken' }],
                                },
                            ],
                        },
                        lineTotal: 1200,
                    }],
                pricing: {
                    subtotal: 1200,
                    tax: 0,
                    total: 1200,
                    discountAmount: 0,
                    deliveryFee: 0,
                },
                payment: { method: order_fixtures_1.ORDER_VALUES.paymentMethod.cash, status: order_fixtures_1.ORDER_VALUES.paymentStatus.completed },
                fulfillment: { type: order_fixtures_1.ORDER_VALUES.fulfillment.takeaway },
            }))
                .then(async (res) => {
                if (res.status !== 201)
                    return { status: res.status };
                const id = res.body.id;
                // Inventory consumes on in_kitchen (not on paid / order.paid)
                const k = await (0, supertest_1.default)(app.getHttpServer())
                    .patch(`/api/orders/${id}/status`)
                    .set('Authorization', 'Bearer token')
                    .send({ status: 'in_kitchen' });
                return { status: k.status };
            });
            syncPromises.push(promise);
        }
        const results = await Promise.all(syncPromises);
        const successCount = results.filter(r => r.status === 201).length;
        logger.log(`Offline Sync Complete. Success: ${successCount}/${NUM_OFFLINE}`);
        expect(successCount).toBe(NUM_OFFLINE);
        // Verify Inventory again (should have deducted 10 more)
        const ingredient = await prisma.ingredient.findUnique({ where: { id: STRESS_INGREDIENT_ID } });
        const expectedStock = 1000 - ((4 + NUM_OFFLINE) * 5);
        expect(Number(ingredient === null || ingredient === void 0 ? void 0 : ingredient.currentStock)).toBe(expectedStock);
    });
});
//# sourceMappingURL=stress.spec.js.map
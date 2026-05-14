"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const supertest_1 = tslib_1.__importDefault(require("supertest"));
const test_utils_1 = require("./test-utils");
const uuid_1 = require("uuid");
const order_fixtures_1 = require("./fixtures/order-fixtures");
describe('Order Lifecycle Integration (Mocked)', () => {
    let app;
    beforeAll(async () => {
        app = await (0, test_utils_1.createTestApp)();
    });
    afterAll(async () => {
        await app.close();
    });
    it('should complete lifecycle: placed -> paid webhook accepted', async () => {
        // 1. Place Order
        const orderId = (0, uuid_1.v4)();
        const orderPayload = (0, order_fixtures_1.buildWrapOrderFixture)({
            orderId,
            customer: { name: 'Lifecycle Test' },
            payment: { method: order_fixtures_1.ORDER_VALUES.paymentMethod.cash, status: order_fixtures_1.ORDER_VALUES.paymentStatus.completed },
            fulfillment: { type: order_fixtures_1.ORDER_VALUES.fulfillment.takeaway },
            pricing: { subtotal: 1000, tax: 0, total: 1000, discountAmount: 0, deliveryFee: 0 },
            items: [
                {
                    lineItemId: (0, uuid_1.v4)(),
                    wrapId: (0, uuid_1.v4)(),
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
        const placeRes = await (0, supertest_1.default)(app.getHttpServer())
            .post('/api/orders')
            .set('Authorization', 'Bearer token')
            .send(orderPayload);
        expect(placeRes.status).toBe(201);
        const createdId = placeRes.body.id;
        // 2. Mock Payment via Webhook (Simulates 'paid')
        const webhookRes = await (0, supertest_1.default)(app.getHttpServer())
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
//# sourceMappingURL=lifecycle.spec.js.map
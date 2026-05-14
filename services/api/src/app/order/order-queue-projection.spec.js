"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const contracts_1 = require("@wrap-roll/contracts");
function sampleQueueOrder() {
    return {
        id: '550e8400-e29b-41d4-a716-446655440000',
        status: 'ready',
        paymentStatus: 'pending',
        paymentMethod: 'cash',
        paymentCollection: null,
        source: 'cashier_pos',
        subtotal: 100,
        discountCode: 'SECRET',
        discountAmount: 0,
        tax: 10,
        deliveryFee: 50,
        fulfillmentType: 'delivery',
        customer: { id: 'c1', name: 'A', phone: '+94777' },
        deliveryAddress: 'Colombo',
        deliveryLatitude: 6.9,
        deliveryLongitude: 79.8,
        deliveryDistanceKm: 2,
        deliveryGeoSource: 'geocode',
        itemCount: 1,
        items: [
            {
                id: 'i1',
                menuItemId: 'm1',
                name: 'Wrap',
                quantity: 1,
                unitPrice: 100,
                lineTotal: 100,
                modifiersJson: [],
            },
        ],
        total: 160,
        transactionId: 'txn_1',
        courierId: null,
        allowedNextStatuses: ['in_transit'],
        actions: {
            canMove: true,
            canAssignCourier: true,
            canCollectPayment: true,
            canMarkDelivered: true,
            canVoid: false,
            canRefund: false,
        },
    };
}
describe('projectQueueOrderForPersona', () => {
    it('strips forbidden keys from kitchen projection', () => {
        var _a;
        const row = sampleQueueOrder();
        const k = (0, contracts_1.projectQueueOrderForPersona)('kitchen', row);
        for (const key of contracts_1.KITCHEN_QUEUE_FORBIDDEN_KEYS) {
            expect(k).not.toHaveProperty(key);
        }
        expect(k.customer).toEqual({ name: 'A' });
        expect((_a = k.items) === null || _a === void 0 ? void 0 : _a[0]).not.toHaveProperty('unitPrice');
    });
    it('returns full row for ops', () => {
        const row = sampleQueueOrder();
        const o = (0, contracts_1.projectQueueOrderForPersona)('ops', row);
        expect(o).toBe(row);
    });
    it('omits pricing fields from courier items', () => {
        var _a, _b, _c;
        const row = sampleQueueOrder();
        const c = (0, contracts_1.projectQueueOrderForPersona)('courier', row);
        expect((_a = c.items) === null || _a === void 0 ? void 0 : _a[0]).not.toHaveProperty('unitPrice');
        expect((_b = c.items) === null || _b === void 0 ? void 0 : _b[0]).not.toHaveProperty('lineTotal');
        expect((_c = c.items) === null || _c === void 0 ? void 0 : _c[0]).toHaveProperty('name', 'Wrap');
    });
    it('strips courier forbidden keys from courier projection', () => {
        const row = sampleQueueOrder();
        const c = (0, contracts_1.projectQueueOrderForPersona)('courier', row);
        for (const key of contracts_1.COURIER_QUEUE_FORBIDDEN_KEYS) {
            expect(c).not.toHaveProperty(key);
        }
    });
});
//# sourceMappingURL=order-queue-projection.spec.js.map
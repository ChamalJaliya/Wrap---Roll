"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ORDER_VALUES = void 0;
exports.buildWrapOrderFixture = buildWrapOrderFixture;
const uuid_1 = require("uuid");
const contracts_1 = require("@wrap-roll/contracts");
exports.ORDER_VALUES = {
    status: {
        placed: contracts_1.ORDER_STATUSES[0],
        paid: contracts_1.ORDER_STATUSES[1],
        ready: contracts_1.ORDER_STATUSES[3],
    },
    source: {
        clientWeb: contracts_1.ORDER_SOURCES[0],
        cashierOffline: contracts_1.ORDER_SOURCES[3],
    },
    paymentMethod: {
        cash: contracts_1.PAYMENT_METHODS[0],
        online: contracts_1.PAYMENT_METHODS[3],
    },
    paymentStatus: {
        pending: contracts_1.PAYMENT_STATUSES[0],
        completed: contracts_1.PAYMENT_STATUSES[1],
    },
    fulfillment: {
        dineIn: contracts_1.FULFILLMENT_TYPES[0],
        takeaway: contracts_1.FULFILLMENT_TYPES[1],
        delivery: contracts_1.FULFILLMENT_TYPES[2],
    },
};
function buildWrapOrderFixture(overrides = {}) {
    const now = new Date().toISOString();
    return Object.assign({ orderId: (0, uuid_1.v4)(), status: exports.ORDER_VALUES.status.placed, source: exports.ORDER_VALUES.source.clientWeb, placedAt: now, updatedAt: now, customer: {
            name: 'John Doe',
            phone: '0771234567',
        }, items: [
            {
                lineItemId: (0, uuid_1.v4)(),
                wrapId: (0, uuid_1.v4)(),
                name: 'Classic Wrap',
                quantity: 1,
                unitPrice: 500,
                availability: 'available',
                modifiers: {
                    optionGroups: [
                        {
                            groupName: 'Build',
                            options: [
                                { label: 'Whole Wheat' },
                                { label: 'Grilled Chicken' },
                                { label: 'Lettuce' },
                                { label: 'Garlic Aioli' },
                            ],
                        },
                    ],
                },
                lineTotal: 500,
            },
        ], pricing: {
            subtotal: 500,
            discountAmount: 0,
            tax: 50,
            deliveryFee: 100,
            total: 650,
        }, payment: {
            method: exports.ORDER_VALUES.paymentMethod.cash,
            status: exports.ORDER_VALUES.paymentStatus.pending,
        }, fulfillment: {
            type: exports.ORDER_VALUES.fulfillment.delivery,
            deliveryAddress: '123 Main St, Colombo',
        }, kitchen: {
            priority: 'normal',
        } }, overrides);
}
//# sourceMappingURL=order-fixtures.js.map
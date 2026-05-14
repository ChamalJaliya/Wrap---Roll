"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const contracts_1 = require("@wrap-roll/contracts");
describe('Contract enum parity', () => {
    it('matches Prisma order/payment/fulfillment enums', () => {
        expect([...contracts_1.ORDER_STATUSES]).toEqual(Object.values(client_1.OrderStatus));
        expect([...contracts_1.ORDER_SOURCES]).toEqual(Object.values(client_1.OrderSource));
        expect([...contracts_1.PAYMENT_METHODS]).toEqual(Object.values(client_1.PaymentMethod));
        expect([...contracts_1.PAYMENT_STATUSES]).toEqual(Object.values(client_1.PaymentStatus));
        expect([...contracts_1.FULFILLMENT_TYPES]).toEqual(Object.values(client_1.FulfillmentType));
    });
});
//# sourceMappingURL=enum-parity.spec.js.map
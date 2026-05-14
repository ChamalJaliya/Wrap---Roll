"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const contracts_1 = require("@wrap-roll/contracts");
describe('order-amendment.policy (contracts)', () => {
    it('allows cashier when payment is pending at delivery ready', () => {
        expect((0, contracts_1.evaluateLineItemReplacementPolicy)({ status: 'ready', paymentStatus: 'pending', fulfillmentType: 'delivery' }, 'CASHIER').allowed).toBe(true);
    });
    it('blocks cashier when paid delivery is ready', () => {
        const r = (0, contracts_1.evaluateLineItemReplacementPolicy)({ status: 'ready', paymentStatus: 'completed', fulfillmentType: 'delivery' }, 'CASHIER');
        expect(r.allowed).toBe(false);
    });
    it('blocks cashier line edits once payment is recorded even if workflow status is still placed/paid', () => {
        expect((0, contracts_1.evaluateLineItemReplacementPolicy)({ status: 'paid', paymentStatus: 'completed', fulfillmentType: 'dine_in' }, 'CASHIER').allowed).toBe(false);
        expect((0, contracts_1.evaluateLineItemReplacementPolicy)({ status: 'placed', paymentStatus: 'completed', fulfillmentType: 'takeaway' }, 'CASHIER').allowed).toBe(false);
    });
    it('lets ADMIN see amend affordance when cashier would be blocked (UI gate)', () => {
        expect((0, contracts_1.evaluateLineItemReplacementPolicy)({ status: 'in_kitchen', paymentStatus: 'completed', fulfillmentType: 'takeaway' }, 'ADMIN').allowed).toBe(true);
    });
    it('requires admin override reason on save when cashier would be blocked', () => {
        const snap = {
            status: 'in_kitchen',
            paymentStatus: 'completed',
            fulfillmentType: 'takeaway',
        };
        expect((0, contracts_1.validateLineItemsReplacementSave)(snap, 'ADMIN', '').allowed).toBe(false);
        expect((0, contracts_1.validateLineItemsReplacementSave)(snap, 'ADMIN', '86 chicken — swap to veg').allowed).toBe(true);
    });
    it('support edit blocked for paid delivery ready (cashier)', () => {
        expect((0, contracts_1.evaluateSupportDetailsEditPolicy)({ status: 'ready', paymentStatus: 'completed', fulfillmentType: 'delivery' }, 'CASHIER').allowed).toBe(false);
    });
});
//# sourceMappingURL=order-amendment.policy.spec.js.map
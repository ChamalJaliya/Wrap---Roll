"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const payment_config_1 = require("./payment-config");
describe('normalizePaymentConfig', () => {
    it('returns defaults for empty payload', () => {
        const cfg = (0, payment_config_1.normalizePaymentConfig)(null);
        expect(cfg.methods.cash).toBe(true);
        expect(cfg.methods.payhere).toBe(true);
    });
    it('supports legacy provider format', () => {
        const cfg = (0, payment_config_1.normalizePaymentConfig)({ provider: 'payhere' });
        expect(cfg.methods.payhere).toBe(true);
        expect(cfg.methods.cash).toBe(true);
    });
    it('supports methods object', () => {
        const cfg = (0, payment_config_1.normalizePaymentConfig)({
            methods: { cash: true, payhere: false, card: false, online: false },
        });
        expect(cfg.methods.cash).toBe(true);
        expect(cfg.methods.payhere).toBe(false);
    });
    it('parses pos.requireSupervisorForCardCollection', () => {
        var _a;
        const cfg = (0, payment_config_1.normalizePaymentConfig)({
            methods: { cash: true, payhere: false, card: true, online: false },
            pos: { requireSupervisorForCardCollection: true },
        });
        expect((_a = cfg.pos) === null || _a === void 0 ? void 0 : _a.requireSupervisorForCardCollection).toBe(true);
    });
});
//# sourceMappingURL=payment-config.spec.js.map
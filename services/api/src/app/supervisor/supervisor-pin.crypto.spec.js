"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const supervisor_pin_crypto_1 = require("./supervisor-pin.crypto");
describe('supervisor-pin.crypto', () => {
    it('round-trips hash and verify', async () => {
        const h = await (0, supervisor_pin_crypto_1.hashSupervisorPin)('secret-pin-123');
        expect(h.startsWith('scrypt$')).toBe(true);
        expect(await (0, supervisor_pin_crypto_1.verifySupervisorPin)('secret-pin-123', h)).toBe(true);
        expect(await (0, supervisor_pin_crypto_1.verifySupervisorPin)('wrong', h)).toBe(false);
    });
});
//# sourceMappingURL=supervisor-pin.crypto.spec.js.map
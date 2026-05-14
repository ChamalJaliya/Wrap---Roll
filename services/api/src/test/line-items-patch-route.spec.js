"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const supertest_1 = tslib_1.__importDefault(require("supertest"));
const test_utils_1 = require("./test-utils");
/** Regression: PATCH .../line-items must be registered (not 404). */
describe('PATCH orders/:id/line-items', () => {
    it('hits the handler (not Nest 404)', async () => {
        var _a;
        const app = await (0, test_utils_1.createTestApp)();
        try {
            const res = await (0, supertest_1.default)(app.getHttpServer())
                .patch('/api/orders/00000000-0000-4000-8000-000000000001/line-items')
                .set('Authorization', 'Bearer mock-token')
                .send({
                items: [],
                note: 'test',
            });
            expect(res.status).not.toBe(404);
            expect((_a = res.body) === null || _a === void 0 ? void 0 : _a.message).not.toMatch(/^Cannot PATCH /);
        }
        finally {
            await app.close();
        }
    });
});
//# sourceMappingURL=line-items-patch-route.spec.js.map
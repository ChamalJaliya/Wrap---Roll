"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const roles_guard_1 = require("./roles.guard");
const roles_decorator_1 = require("./roles.decorator");
describe('RolesGuard', () => {
    let guard;
    let reflector;
    const ctx = (user) => ({
        switchToHttp: () => ({
            getRequest: () => ({ user }),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
    });
    beforeEach(() => {
        reflector = new core_1.Reflector();
        guard = new roles_guard_1.RolesGuard(reflector);
    });
    it('allows when no @Roles() metadata is present', () => {
        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
        expect(guard.canActivate(ctx({ role: 'CLIENT' }))).toBe(true);
    });
    it('allows when user role is in required list', () => {
        jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => key === roles_decorator_1.ROLES_KEY ? ['CASHIER', 'ADMIN'] : undefined);
        expect(guard.canActivate(ctx({ role: 'CASHIER' }))).toBe(true);
    });
    it('throws when user role is not in required list', () => {
        jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => key === roles_decorator_1.ROLES_KEY ? ['CASHIER', 'ADMIN'] : undefined);
        expect(() => guard.canActivate(ctx({ role: 'CLIENT' }))).toThrow(common_1.ForbiddenException);
    });
    it('throws when user is missing', () => {
        jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => key === roles_decorator_1.ROLES_KEY ? ['CASHIER'] : undefined);
        expect(() => guard.canActivate(ctx(null))).toThrow(common_1.ForbiddenException);
    });
    it('throws when user has no role', () => {
        jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) => key === roles_decorator_1.ROLES_KEY ? ['CASHIER'] : undefined);
        expect(() => guard.canActivate(ctx({}))).toThrow(common_1.ForbiddenException);
    });
});
//# sourceMappingURL=roles.guard.spec.js.map
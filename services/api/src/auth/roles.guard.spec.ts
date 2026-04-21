import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from './roles.decorator';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  const ctx = (user: { role?: string } | null) =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    }) as Parameters<RolesGuard['canActivate']>[0];

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  it('allows when no @Roles() metadata is present', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(ctx({ role: 'CLIENT' }))).toBe(true);
  });

  it('allows when user role is in required list', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) =>
      key === ROLES_KEY ? ['CASHIER', 'ADMIN'] : undefined,
    );
    expect(guard.canActivate(ctx({ role: 'CASHIER' }))).toBe(true);
  });

  it('throws when user role is not in required list', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) =>
      key === ROLES_KEY ? ['CASHIER', 'ADMIN'] : undefined,
    );
    expect(() => guard.canActivate(ctx({ role: 'CLIENT' }))).toThrow(ForbiddenException);
  });

  it('throws when user is missing', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) =>
      key === ROLES_KEY ? ['CASHIER'] : undefined,
    );
    expect(() => guard.canActivate(ctx(null))).toThrow(ForbiddenException);
  });

  it('throws when user has no role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key) =>
      key === ROLES_KEY ? ['CASHIER'] : undefined,
    );
    expect(() => guard.canActivate(ctx({}))).toThrow(ForbiddenException);
  });
});

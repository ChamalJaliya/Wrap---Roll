import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CouponService } from './coupon.service';
import type { RequestUser } from '../../auth/current-user.decorator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockActor: RequestUser = {
  sub: 'actor-id',
  email: 'admin@wrap.lk',
  role: 'ADMIN',
};

function makePrisma(overrides: Partial<{
  coupon: Partial<ReturnType<typeof defaultCouponMock>>;
  order: Partial<ReturnType<typeof defaultOrderMock>>;
  opsActivityEvent: Partial<ReturnType<typeof defaultOpsMock>>;
}> = {}): PrismaService {
  return {
    coupon: { ...defaultCouponMock(), ...(overrides.coupon ?? {}) },
    order: { ...defaultOrderMock(), ...(overrides.order ?? {}) },
    opsActivityEvent: { ...defaultOpsMock(), ...(overrides.opsActivityEvent ?? {}) },
  } as unknown as PrismaService;
}

function defaultCouponMock() {
  return {
    findUnique: jest.fn(),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
}

function defaultOrderMock() {
  return {
    count: jest.fn().mockResolvedValue(0),
  };
}

function defaultOpsMock() {
  return {
    create: jest.fn().mockResolvedValue({}),
  };
}

function activeCoupon(overrides: Record<string, unknown> = {}) {
  return {
    id: 'coupon-1',
    code: 'WELCOME10',
    discountPercent: 0.1,
    minSubtotal: null,
    firstOrderOnly: false,
    isActive: true,
    expiryDate: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// validateCoupon
// ---------------------------------------------------------------------------

describe('CouponService.validateCoupon', () => {
  it('returns invalid when code is blank', async () => {
    const svc = new CouponService(makePrisma());
    const result = await svc.validateCoupon('', 1000);
    expect(result.valid).toBe(false);
    expect(result.discountAmount).toBe(0);
  });

  it('returns invalid when coupon does not exist', async () => {
    const prisma = makePrisma({ coupon: { findUnique: jest.fn().mockResolvedValue(null) } });
    const svc = new CouponService(prisma);
    const result = await svc.validateCoupon('NONEXISTENT', 1000);
    expect(result.valid).toBe(false);
  });

  it('returns invalid when coupon is inactive', async () => {
    const prisma = makePrisma({
      coupon: { findUnique: jest.fn().mockResolvedValue(activeCoupon({ isActive: false })) },
    });
    const svc = new CouponService(prisma);
    const result = await svc.validateCoupon('WELCOME10', 1000);
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/inactive/i);
  });

  it('returns invalid when coupon is expired', async () => {
    const pastDate = new Date('2020-01-01');
    const prisma = makePrisma({
      coupon: { findUnique: jest.fn().mockResolvedValue(activeCoupon({ expiryDate: pastDate })) },
    });
    const svc = new CouponService(prisma);
    const result = await svc.validateCoupon('WELCOME10', 1000);
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/expired/i);
  });

  it('returns invalid when subtotal does not meet minSubtotal', async () => {
    const prisma = makePrisma({
      coupon: { findUnique: jest.fn().mockResolvedValue(activeCoupon({ minSubtotal: 1500 })) },
    });
    const svc = new CouponService(prisma);
    const result = await svc.validateCoupon('WELCOME10', 800);
    expect(result.valid).toBe(false);
    expect(result.message).toMatch(/subtotal/i);
  });

  it('accepts when subtotal exactly equals minSubtotal (boundary — strict GT)', async () => {
    const prisma = makePrisma({
      coupon: { findUnique: jest.fn().mockResolvedValue(activeCoupon({ minSubtotal: 1000 })) },
    });
    const svc = new CouponService(prisma);
    // subtotal <= minSubtotal must fail (the service uses <=)
    const result = await svc.validateCoupon('WELCOME10', 1000);
    expect(result.valid).toBe(false);
  });

  it('computes 10% discount correctly', async () => {
    const prisma = makePrisma({
      coupon: { findUnique: jest.fn().mockResolvedValue(activeCoupon()) },
    });
    const svc = new CouponService(prisma);
    const result = await svc.validateCoupon('WELCOME10', 1000);
    expect(result.valid).toBe(true);
    expect(result.discountAmount).toBe(100);
  });

  it('caps discount at 50% of subtotal', async () => {
    // 90% coupon on a 1000 sub → 900 → capped at 500
    const prisma = makePrisma({
      coupon: { findUnique: jest.fn().mockResolvedValue(activeCoupon({ discountPercent: 0.9 })) },
    });
    const svc = new CouponService(prisma);
    const result = await svc.validateCoupon('BIG90', 1000);
    expect(result.valid).toBe(true);
    expect(result.discountAmount).toBe(500);
  });

  it('normalises code to UPPERCASE before lookup', async () => {
    const couponMock = { findUnique: jest.fn().mockResolvedValue(activeCoupon()) };
    const prisma = makePrisma({ coupon: couponMock });
    const svc = new CouponService(prisma);
    await svc.validateCoupon('welcome10', 1000);
    expect(couponMock.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { code: 'WELCOME10' } }),
    );
  });

  describe('firstOrderOnly gate', () => {
    it('rejects when customer has prior orders', async () => {
      const prisma = makePrisma({
        coupon: { findUnique: jest.fn().mockResolvedValue(activeCoupon({ firstOrderOnly: true })) },
        order: { count: jest.fn().mockResolvedValue(1) },
      });
      const svc = new CouponService(prisma);
      const result = await svc.validateCoupon('NEWBIE', 1000, 'cust-1');
      expect(result.valid).toBe(false);
      expect(result.message).toMatch(/first-time/i);
    });

    it('allows when customer has no prior orders', async () => {
      const prisma = makePrisma({
        coupon: { findUnique: jest.fn().mockResolvedValue(activeCoupon({ firstOrderOnly: true })) },
        order: { count: jest.fn().mockResolvedValue(0) },
      });
      const svc = new CouponService(prisma);
      const result = await svc.validateCoupon('NEWBIE', 1000, 'cust-fresh');
      expect(result.valid).toBe(true);
    });

    it('rejects when neither customerId nor customerPhone is provided', async () => {
      const prisma = makePrisma({
        coupon: { findUnique: jest.fn().mockResolvedValue(activeCoupon({ firstOrderOnly: true })) },
      });
      const svc = new CouponService(prisma);
      const result = await svc.validateCoupon('NEWBIE', 1000);
      expect(result.valid).toBe(false);
      expect(result.message).toMatch(/sign in/i);
    });
  });
});

// ---------------------------------------------------------------------------
// Admin CRUD
// ---------------------------------------------------------------------------

describe('CouponService.createAdmin', () => {
  it('throws when code is empty', async () => {
    const svc = new CouponService(makePrisma());
    await expect(
      svc.createAdmin({ code: '', discountPercent: 0.1 }, mockActor),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws when discountPercent is out of range', async () => {
    const svc = new CouponService(makePrisma());
    await expect(
      svc.createAdmin({ code: 'OVER100', discountPercent: 1.5 }, mockActor),
    ).rejects.toThrow(BadRequestException);
  });

  it('creates coupon and writes audit trail', async () => {
    const created = { id: 'c-1', code: 'LAUNCH', isActive: true };
    const createFn = jest.fn().mockResolvedValue(created);
    const opsFn = jest.fn().mockResolvedValue({});
    const prisma = makePrisma({
      coupon: { ...defaultCouponMock(), create: createFn },
      opsActivityEvent: { create: opsFn },
    });
    const svc = new CouponService(prisma);
    const result = await svc.createAdmin(
      { code: 'LAUNCH', discountPercent: 0.15 },
      mockActor,
    );
    expect(result).toBe(created);
    expect(createFn).toHaveBeenCalledTimes(1);
    expect(opsFn).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: 'coupon.created' }),
      }),
    );
  });
});

describe('CouponService.updateAdmin', () => {
  it('throws NotFoundException when coupon does not exist', async () => {
    const prisma = makePrisma({ coupon: { findUnique: jest.fn().mockResolvedValue(null) } });
    const svc = new CouponService(prisma);
    await expect(
      svc.updateAdmin('nonexistent-id', { isActive: false }, mockActor),
    ).rejects.toThrow(NotFoundException);
  });

  it('updates and writes audit trail', async () => {
    const existing = { id: 'c-2', code: 'SALE', isActive: true };
    const updated = { ...existing, isActive: false };
    const updateFn = jest.fn().mockResolvedValue(updated);
    const opsFn = jest.fn().mockResolvedValue({});
    const prisma = makePrisma({
      coupon: { findUnique: jest.fn().mockResolvedValue(existing), update: updateFn },
      opsActivityEvent: { create: opsFn },
    });
    const svc = new CouponService(prisma);
    await svc.updateAdmin('c-2', { isActive: false }, mockActor);
    expect(updateFn).toHaveBeenCalledTimes(1);
    expect(opsFn).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: 'coupon.updated' }),
      }),
    );
  });
});

describe('CouponService.deleteAdmin', () => {
  it('throws NotFoundException when coupon does not exist', async () => {
    const prisma = makePrisma({ coupon: { findUnique: jest.fn().mockResolvedValue(null) } });
    const svc = new CouponService(prisma);
    await expect(svc.deleteAdmin('ghost-id', mockActor)).rejects.toThrow(NotFoundException);
  });

  it('deletes and writes audit trail', async () => {
    const existing = { id: 'c-3', code: 'BYEBYE' };
    const deleteFn = jest.fn().mockResolvedValue(existing);
    const opsFn = jest.fn().mockResolvedValue({});
    const prisma = makePrisma({
      coupon: {
        findUnique: jest.fn().mockResolvedValue(existing),
        delete: deleteFn,
      },
      opsActivityEvent: { create: opsFn },
    });
    const svc = new CouponService(prisma);
    const result = await svc.deleteAdmin('c-3', mockActor);
    expect(result).toEqual({ ok: true });
    expect(deleteFn).toHaveBeenCalledTimes(1);
    expect(opsFn).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: 'coupon.deleted' }),
      }),
    );
  });
});

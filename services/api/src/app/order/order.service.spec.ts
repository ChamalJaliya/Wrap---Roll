import { OrderStatus } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { CouponService } from '../coupon/coupon.service';
import { CustomerService } from '../customer/customer.service';
import { StaffService } from '../staff/staff.service';
import { LocationService } from '../location/location.service';
import type { ActivityService } from '../activity/activity.service';
import type { OutboxService } from '../outbox/outbox.service';
import { OrderService } from './order.service';
import type { RequestUser } from '../../auth/current-user.decorator';
import type { QueueResponseCacheService } from './queue-response-cache.service';

type TransitionFn = (
  from: OrderStatus,
  to: OrderStatus,
  role: string,
  context?: {
    paymentStatus?: 'pending' | 'completed' | 'failed' | 'refunded';
    fulfillmentType?: 'takeaway' | 'dine_in' | 'delivery';
    paymentMethod?: 'cash' | 'card' | 'payhere' | 'online';
    source?: 'client_web' | 'client_mobile' | 'cashier_pos' | 'cashier_pos_offline';
    transactionId?: string | null;
    estimatedReadyTime?: Date | string | null;
    placedAt?: Date | string | null;
    minLeadMinutes?: number;
  },
) => boolean;

type ReleaseReasonFn = (input: {
  status: OrderStatus;
  paymentStatus: 'pending' | 'completed' | 'failed' | 'refunded';
  fulfillmentType: 'takeaway' | 'dine_in' | 'delivery';
  paymentMethod: 'cash' | 'card' | 'payhere' | 'online';
  source: 'client_web' | 'client_mobile' | 'cashier_pos' | 'cashier_pos_offline';
  transactionId?: string | null;
}) => string | null;

function canTransition(
  svc: OrderService,
  from: OrderStatus,
  to: OrderStatus,
  role: string,
  context?: Parameters<TransitionFn>[3],
): boolean {
  return (svc as unknown as { canTransition: TransitionFn }).canTransition(from, to, role, context);
}

function paymentPolicyKitchenReleaseReason(
  svc: OrderService,
  input: Parameters<ReleaseReasonFn>[0],
): string | null {
  return (svc as unknown as { getPaymentPolicyKitchenReleaseReason: ReleaseReasonFn }).getPaymentPolicyKitchenReleaseReason(
    input,
  );
}

function noopQueueCache(): QueueResponseCacheService {
  return {
    getGlobalRevForCache: jest.fn().mockResolvedValue(0),
    bumpGlobalRevAndPublish: jest.fn().mockResolvedValue(undefined),
  } as unknown as QueueResponseCacheService;
}

function noopOutboxService(): OutboxService {
  return {
    append: jest.fn().mockResolvedValue(undefined),
    appendUsingTx: jest.fn().mockResolvedValue(undefined),
  } as unknown as OutboxService;
}

function emptyDeps(): [
  PrismaService,
  null,
  QueueResponseCacheService,
  StaffService,
  CouponService,
  CustomerService,
  LocationService,
  ActivityService,
  OutboxService,
] {
  const x = {} as unknown;
  return [
    x as PrismaService,
    null,
    noopQueueCache(),
    x as StaffService,
    x as CouponService,
    x as CustomerService,
    x as LocationService,
    x as ActivityService,
    noopOutboxService(),
  ];
}

describe('OrderService transition policy', () => {
  const service = new OrderService(...emptyDeps());

  it('allows kitchen progression for kitchen role', () => {
    expect(
      canTransition(service, 'paid', 'in_kitchen', 'KITCHEN', {
        paymentStatus: 'completed',
        fulfillmentType: 'takeaway',
        paymentMethod: 'cash',
        source: 'cashier_pos',
        minLeadMinutes: 20,
      }),
    ).toBe(true);
    expect(canTransition(service, 'in_kitchen', 'ready', 'KITCHEN')).toBe(true);
  });

  it('allows policy-approved unpaid release from placed', () => {
    expect(
      canTransition(service, 'placed', 'in_kitchen', 'KITCHEN', {
        paymentStatus: 'pending',
        fulfillmentType: 'delivery',
        paymentMethod: 'cash',
        source: 'client_web',
        minLeadMinutes: 20,
      }),
    ).toBe(true);
    expect(
      canTransition(service, 'placed', 'in_kitchen', 'KITCHEN', {
        paymentStatus: 'pending',
        fulfillmentType: 'takeaway',
        paymentMethod: 'online',
        source: 'client_web',
        minLeadMinutes: 20,
      }),
    ).toBe(false);
  });

  it('blocks placed -> in_kitchen until kitchen release for scheduled prepaid orders', () => {
    const farFuture = new Date(Date.now() + 4 * 60 * 60_000);
    expect(
      canTransition(service, 'placed', 'in_kitchen', 'KITCHEN', {
        paymentStatus: 'completed',
        fulfillmentType: 'takeaway',
        paymentMethod: 'online',
        source: 'client_web',
        estimatedReadyTime: farFuture,
        minLeadMinutes: 20,
      }),
    ).toBe(false);
    const readyEnough = new Date(Date.now() - 60_000);
    expect(
      canTransition(service, 'placed', 'in_kitchen', 'KITCHEN', {
        paymentStatus: 'completed',
        fulfillmentType: 'takeaway',
        paymentMethod: 'online',
        source: 'client_web',
        estimatedReadyTime: readyEnough,
        minLeadMinutes: 20,
      }),
    ).toBe(true);
  });

  it('allows cashier phone deferred card orders into kitchen flow', () => {
    expect(
      canTransition(service, 'placed', 'in_kitchen', 'CASHIER', {
        paymentStatus: 'pending',
        fulfillmentType: 'delivery',
        paymentMethod: 'card',
        source: 'cashier_pos_offline',
        minLeadMinutes: 20,
      }),
    ).toBe(true);
    expect(
      paymentPolicyKitchenReleaseReason(service, {
        status: 'placed',
        paymentStatus: 'pending',
        fulfillmentType: 'delivery',
        paymentMethod: 'card',
        source: 'cashier_pos_offline',
      }),
    ).toBe('STAFF_PAY_LATER');
  });

  it('allows client takeaway cash pay-on-pickup orders into kitchen flow', () => {
    expect(
      canTransition(service, 'placed', 'in_kitchen', 'KITCHEN', {
        paymentStatus: 'pending',
        fulfillmentType: 'takeaway',
        paymentMethod: 'cash',
        source: 'client_web',
        transactionId: 'ON_PICKUP_TEST_01',
        minLeadMinutes: 20,
      }),
    ).toBe(true);
    expect(
      paymentPolicyKitchenReleaseReason(service, {
        status: 'placed',
        paymentStatus: 'pending',
        fulfillmentType: 'takeaway',
        paymentMethod: 'cash',
        source: 'client_web',
        transactionId: 'ON_PICKUP_TEST_01',
      }),
    ).toBe('TAKEAWAY_PAY_LATER');
  });

  it('blocks client takeaway cash without on-pickup marker', () => {
    expect(
      canTransition(service, 'placed', 'in_kitchen', 'KITCHEN', {
        paymentStatus: 'pending',
        fulfillmentType: 'takeaway',
        paymentMethod: 'cash',
        source: 'client_web',
        minLeadMinutes: 20,
      }),
    ).toBe(false);
    expect(
      paymentPolicyKitchenReleaseReason(service, {
        status: 'placed',
        paymentStatus: 'pending',
        fulfillmentType: 'takeaway',
        paymentMethod: 'cash',
        source: 'client_web',
      }),
    ).toBeNull();
  });

  it('blocks takeaway cash without marker for non-client sources', () => {
    expect(
      canTransition(service, 'placed', 'in_kitchen', 'KITCHEN', {
        paymentStatus: 'pending',
        fulfillmentType: 'takeaway',
        paymentMethod: 'cash',
        source: 'cashier_pos',
        minLeadMinutes: 20,
      }),
    ).toBe(false);
  });

  it('blocks invalid jumps and protected statuses', () => {
    expect(canTransition(service, 'placed', 'delivered', 'ADMIN')).toBe(false);
    expect(canTransition(service, 'paid', 'refunded', 'CASHIER')).toBe(false);
  });

  it('enforces role restrictions for board-style moves', () => {
    expect(canTransition(service, 'ready', 'in_transit', 'CASHIER')).toBe(false);
    expect(canTransition(service, 'in_transit', 'delivered', 'CASHIER')).toBe(false);
    expect(
      canTransition(service, 'ready', 'delivered', 'CASHIER', {
        paymentStatus: 'pending',
        fulfillmentType: 'takeaway',
        paymentMethod: 'cash',
        source: 'cashier_pos',
      }),
    ).toBe(false);
    expect(
      canTransition(service, 'ready', 'delivered', 'CASHIER', {
        paymentStatus: 'completed',
        fulfillmentType: 'takeaway',
        paymentMethod: 'cash',
        source: 'cashier_pos',
      }),
    ).toBe(true);
    expect(canTransition(service, 'placed', 'paid', 'COURIER')).toBe(false);
    expect(canTransition(service, 'placed', 'cancelled', 'KITCHEN')).toBe(false);
    expect(canTransition(service, 'ready', 'in_transit', 'COURIER')).toBe(true);
  });

  it('blocks placed -> paid while payment is pending', async () => {
    const prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'o1',
          status: 'placed',
          paymentStatus: 'pending',
          fulfillmentType: 'takeaway',
          courierId: null,
        }),
      },
    };
    const svc = new OrderService(
      prisma as unknown as PrismaService,
      null,
      noopQueueCache(),
      {} as StaffService,
      {} as CouponService,
      {} as CustomerService,
      {} as LocationService,
      {} as ActivityService,
      noopOutboxService(),
    );
    await expect(
      svc.updateOrderStatus('o1', 'paid', {
        role: 'ADMIN',
        sub: 'u1',
        email: '',
      } as RequestUser),
    ).rejects.toThrow('payment status is completed');
  });

  it('forces paymentStatus=refunded on refunded transition', async () => {
    const tx = {
      order: {
        update: jest.fn().mockResolvedValue({
          id: 'o2',
          status: 'refunded',
          paymentStatus: 'refunded',
          items: [],
          fulfillmentType: 'takeaway',
          courierId: null,
        }),
      },
      paymentEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'o2',
          status: 'paid',
          paymentStatus: 'completed',
          paymentMethod: 'cash',
          fulfillmentType: 'takeaway',
          courierId: null,
        }),
      },
      $transaction: jest.fn().mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    };
    const svc = new OrderService(
      prisma as unknown as PrismaService,
      null,
      noopQueueCache(),
      {} as StaffService,
      {} as CouponService,
      {} as CustomerService,
      {} as LocationService,
      {} as ActivityService,
      noopOutboxService(),
    );
    await svc.updateOrderStatus('o2', 'refunded', {
      role: 'ADMIN',
      sub: 'u1',
      email: '',
    } as RequestUser);
    expect(tx.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'refunded',
          paymentStatus: 'refunded',
        }),
      }),
    );
  });

  it('auto-completes ready pickup orders when payment is collected', async () => {
    const tx = {
      order: {
        update: jest.fn().mockResolvedValue({
          id: 'o3',
          status: 'delivered',
          paymentStatus: 'completed',
          items: [],
          customer: null,
        }),
      },
      paymentEvent: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'o3',
          status: 'ready',
          paymentStatus: 'pending',
          paymentMethod: 'cash',
          fulfillmentType: 'takeaway',
          courierId: null,
        }),
      },
      $transaction: jest.fn().mockImplementation(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    };
    const svc = new OrderService(
      prisma as unknown as PrismaService,
      null,
      noopQueueCache(),
      {} as StaffService,
      {} as CouponService,
      {} as CustomerService,
      {} as LocationService,
      {} as ActivityService,
      noopOutboxService(),
    );
    await svc.markPaymentReceived(
      'o3',
      { role: 'CASHIER', sub: 'u1', email: '' } as RequestUser,
      'card',
    );
    expect(tx.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentStatus: 'completed',
          status: 'delivered',
        }),
      }),
    );
  });
});

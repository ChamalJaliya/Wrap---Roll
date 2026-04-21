import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, INestApplication } from '@nestjs/common';
import { AppModule } from '../app/app.module';
import { PrismaService } from '../app/prisma/prisma.service';
import { RolesGuard, SupabaseAuthGuard, SupabaseService } from '../auth';
import { PaymentService } from '../app/payment/payment.service';
import { ThrottlerGuard } from '@nestjs/throttler';
import { queueOrderDbFixture } from './fixtures/queue-order-db-fixture';

/**
 * Sets `request.user.role` from the Bearer token so queue projection can be tested per role:
 * - `mock-token` / default → CASHIER (full ops queue)
 * - `mock-role-kitchen` → KITCHEN
 * - `mock-role-courier` → COURIER
 * - `mock-role-admin` → ADMIN
 *
 * Avoid renaming identifiers that contain the substring `QueueOrder` (e.g. `setQueueOrders`) with naive
 * find-replace — use guarded renames (see queue response persona work).
 */
function mockAuthGuardCanActivate(context: ExecutionContext): boolean {
  const request = context.switchToHttp().getRequest<{ headers?: { authorization?: string }; user?: unknown }>();
  const auth = String(request.headers?.authorization ?? '');
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  let role = 'CASHIER';
  if (token === 'mock-role-kitchen') role = 'KITCHEN';
  else if (token === 'mock-role-courier') role = 'COURIER';
  else if (token === 'mock-role-admin') role = 'ADMIN';
  request.user = {
    sub: 'test-user-id',
    email: 'test@example.com',
    role,
  };
  return true;
}

export async function createTestApp(): Promise<INestApplication> {
  let mockOrder = {
    id: 'test-order-id',
    status: 'placed',
    customerId: 'test-user-id',
    paymentStatus: 'completed',
  };
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideGuard(SupabaseAuthGuard)
    .useValue({ canActivate: mockAuthGuardCanActivate })
    .overrideGuard(RolesGuard)
    .useValue({ canActivate: () => true })
    .overrideGuard(ThrottlerGuard)
    .useValue({ canActivate: () => true })
    .overrideProvider(SupabaseService)
    .useValue({
      verifyToken: jest.fn().mockResolvedValue({
        id: 'test-user-id',
        email: 'test@example.com',
        user_metadata: { role: 'CASHIER' },
      }),
    })
    .overrideProvider(PaymentService)
    .useValue({
      processWebhook: jest.fn().mockReturnValue({ success: true }),
      generatePaymentHash: jest.fn().mockReturnValue({ hash: 'mock-hash', merchantId: 'mock-id' }),
    })
    .overrideProvider(PrismaService)
    .useValue({
      order: {
        create: jest.fn().mockImplementation(async (args: { data?: Record<string, unknown> }) => {
          mockOrder = {
            ...mockOrder,
            ...(args?.data ?? {}),
            id: (args?.data?.id as string) ?? mockOrder.id,
            status: (args?.data?.status as string) ?? 'placed',
          };
          return mockOrder;
        }),
        findMany: jest.fn().mockImplementation((args: { orderBy?: unknown }) => {
          if (Array.isArray(args?.orderBy)) {
            return Promise.resolve([queueOrderDbFixture]);
          }
          return Promise.resolve([]);
        }),
        findUnique: jest.fn().mockImplementation(async () => mockOrder),
        update: jest.fn().mockImplementation(async (args: { data: Record<string, unknown>; where: { id: string } }) => {
          mockOrder = { ...mockOrder, ...args.data, id: args.where.id };
          return mockOrder;
        }),
        count: jest.fn().mockImplementation((args: { where?: { status?: { in?: unknown[] } } }) => {
          if (args?.where?.status?.in) {
            return Promise.resolve(1);
          }
          return Promise.resolve(0);
        }),
      },
      businessSettings: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      coupon: {
        findUnique: jest.fn().mockImplementation(
          async (args: { where: { code: string } }) => ({
            id: 'coupon-test-id',
            code: args.where.code,
            discountPercent: 0.1,
            minSubtotal: null,
            firstOrderOnly: false,
            isActive: true,
            expiryDate: new Date('2099-12-31'),
          }),
        ),
      },
      customer: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'cust-1', name: 'Test Customer', phone: null }),
      },
      $transaction: jest.fn().mockImplementation(async (callback) => {
        return callback({
          order: {
            create: jest.fn().mockImplementation((args) => Promise.resolve({ ...args.data, id: 'test-order-id' })),
            count: jest.fn().mockResolvedValue(0),
            findUnique: jest.fn().mockImplementation(async () => mockOrder),
            update: jest.fn().mockImplementation(async (args: { data: Record<string, unknown>; where: { id: string } }) => {
              mockOrder = { ...mockOrder, ...args.data, id: args.where.id };
              return mockOrder;
            }),
          },
          customer: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ id: 'cust-1', name: 'Test Customer', phone: null }),
          },
          paymentEvent: {
            create: jest.fn().mockResolvedValue({}),
          },
        });
      }),
      $connect: jest.fn(),
      $disconnect: jest.fn(),
    })
    .compile();

  const app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api');
  await app.init();
  return app;
}

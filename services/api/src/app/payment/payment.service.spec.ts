import * as crypto from 'crypto';
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentService } from './payment.service';
import type { QueueResponseCacheService } from '../order/queue-response-cache.service';
import type { RequestUser } from '../../auth/current-user.decorator';
import type { OutboxService } from '../outbox/outbox.service';
import type { OrderService } from '../order/order.service';

// ---------------------------------------------------------------------------
// Test environment setup — PayHere creds must be set before module load so the
// service constructor does not throw ("ALLOW_INSECURE_PAYMENT_DEFAULTS" guard).
// ---------------------------------------------------------------------------

const TEST_MERCHANT_ID = 'dummy_merchant_id';
const TEST_MERCHANT_SECRET = 'dummy_secret';

beforeAll(() => {
  process.env.PAYHERE_MERCHANT_ID = TEST_MERCHANT_ID;
  process.env.PAYHERE_MERCHANT_SECRET = TEST_MERCHANT_SECRET;
  process.env.NODE_ENV = 'test';
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNoopQueueCache(): QueueResponseCacheService {
  return {
    bumpGlobalRevAndPublish: jest.fn().mockResolvedValue(undefined),
    getGlobalRevForCache: jest.fn().mockResolvedValue(0),
  } as unknown as QueueResponseCacheService;
}

function makePrisma(overrides: Record<string, unknown> = {}): PrismaService {
  return {
    paymentEvent: {
      create: jest.fn().mockResolvedValue({}),
    },
    order: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    ...overrides,
  } as unknown as PrismaService;
}

function makeService(prismaOverrides: Record<string, unknown> = {}): PaymentService {
  const outbox = {
    append: jest.fn().mockResolvedValue(undefined),
  } as unknown as OutboxService;
  const orderService = {
    handleOrderPaid: jest.fn().mockResolvedValue(undefined),
  } as unknown as OrderService;
  return new PaymentService(
    makePrisma(prismaOverrides),
    makeNoopQueueCache(),
    outbox,
    orderService,
  );
}

// ---------------------------------------------------------------------------
// MD5 signature generation
// ---------------------------------------------------------------------------

describe('PaymentService.generatePaymentHash', () => {
  it('generates a deterministic uppercase MD5 hash', () => {
    const svc = makeService();
    const { hash } = svc.generatePaymentHash('order-1', 650.0);

    // Re-compute expected hash with same algorithm
    const secretHash = crypto.createHash('md5').update(TEST_MERCHANT_SECRET, 'utf8').digest('hex').toUpperCase();
    const expected = crypto
      .createHash('md5')
      .update(`${TEST_MERCHANT_ID}order-1650.00LKR${secretHash}`, 'utf8')
      .digest('hex')
      .toUpperCase();

    expect(hash).toBe(expected);
    expect(hash).toMatch(/^[A-F0-9]{32}$/);
  });

  it('returns merchantId alongside hash', () => {
    const svc = makeService();
    const result = svc.generatePaymentHash('order-x', 100.0);
    expect(result.merchantId).toBe(TEST_MERCHANT_ID);
    expect(result.merchant_id).toBe(TEST_MERCHANT_ID);
  });

  it('throws BadRequestException when amount is NaN', () => {
    const svc = makeService();
    expect(() => svc.generatePaymentHash('order-x', NaN)).toThrow(BadRequestException);
  });

  it('rounds amount to 2 decimal places in payload', () => {
    const svc = makeService();
    // 100.999 should be hashed as 101.00
    const { hash: h1 } = svc.generatePaymentHash('o', 101.0);
    const { hash: h2 } = svc.generatePaymentHash('o', 100.999);
    expect(h1).toBe(h2);
  });
});

// ---------------------------------------------------------------------------
// processWebhook — signature verification
// ---------------------------------------------------------------------------

function buildValidWebhookPayload(orderId: string, amount = '650.00') {
  const secretHash = crypto.createHash('md5').update(TEST_MERCHANT_SECRET, 'utf8').digest('hex').toUpperCase();
  const md5sig = crypto
    .createHash('md5')
    .update(`${TEST_MERCHANT_ID}${orderId}${amount}LKR2${secretHash}`, 'utf8')
    .digest('hex')
    .toUpperCase();
  return {
    merchant_id: TEST_MERCHANT_ID,
    order_id: orderId,
    payhere_amount: amount,
    payhere_currency: 'LKR',
    status_code: '2',
    payment_id: 'PAY-TEST-001',
    md5sig,
  };
}

describe('PaymentService.processWebhook', () => {
  it('throws BadRequestException on invalid signature', async () => {
    const order = { id: 'ord-1', total: new Prisma.Decimal('650.00'), paymentMethod: 'payhere', paymentStatus: 'pending', transactionId: null };
    const svc = makeService({
      order: { findUnique: jest.fn().mockResolvedValue(order) },
    });
    const payload = buildValidWebhookPayload('ord-1');
    await expect(
      svc.processWebhook({ ...payload, md5sig: 'BADHASH' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException on merchant mismatch', async () => {
    const svc = makeService();
    const payload = buildValidWebhookPayload('ord-2');
    await expect(
      svc.processWebhook({ ...payload, merchant_id: 'evil-merchant' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when payload fields are missing', async () => {
    const svc = makeService();
    await expect(
      svc.processWebhook({
        merchant_id: TEST_MERCHANT_ID,
        order_id: 'ord-3',
        payhere_amount: '100.00',
        // missing currency, status_code, md5sig
      } as never),
    ).rejects.toThrow(BadRequestException);
  });

  it('writes webhook-paid outbox event on successful status_code=2', async () => {
    const orderId = 'ord-success';
    const order = {
      id: orderId,
      total: new Prisma.Decimal('650.00'),
      paymentMethod: 'payhere',
      paymentStatus: 'pending',
      transactionId: null,
    };
    const paymentEventCreate = jest.fn().mockResolvedValue({});
    // Idempotency claim returns true (unique constraint passes)
    const prismaWithOrder = makePrisma({
      order: { findUnique: jest.fn().mockResolvedValue(order) },
      paymentEvent: { create: paymentEventCreate },
    });
    const outbox = { append: jest.fn().mockResolvedValue(undefined) } as unknown as OutboxService;
    const svc = new PaymentService(
      prismaWithOrder,
      makeNoopQueueCache(),
      outbox,
      { handleOrderPaid: jest.fn().mockResolvedValue(undefined) } as unknown as OrderService,
    );

    const payload = buildValidWebhookPayload(orderId, '650.00');
    await svc.processWebhook(payload);

    expect((outbox.append as jest.Mock).mock.calls).toEqual(
      expect.arrayContaining([
        [
          expect.objectContaining({
            eventType: 'payment.webhook.paid',
            entityId: orderId,
          }),
        ],
      ]),
    );
  });

  it('returns success silently if order paymentStatus already completed for same payment_id', async () => {
    const orderId = 'ord-idempotent';
    const order = {
      id: orderId,
      total: new Prisma.Decimal('650.00'),
      paymentMethod: 'payhere',
      paymentStatus: 'completed',
      transactionId: 'PAY-TEST-001', // matches payment_id below
    };
    const svc = new PaymentService(
      makePrisma({ order: { findUnique: jest.fn().mockResolvedValue(order) } }),
      makeNoopQueueCache(),
      { append: jest.fn().mockResolvedValue(undefined) } as unknown as OutboxService,
      { handleOrderPaid: jest.fn().mockResolvedValue(undefined) } as unknown as OrderService,
    );

    const payload = buildValidWebhookPayload(orderId, '650.00');
    const result = await svc.processWebhook(payload);

    expect(result).toEqual({ success: true });
  });

  it('throws BadRequestException for unsupported currency', async () => {
    const orderId = 'ord-usd';
    const order = {
      id: orderId,
      total: new Prisma.Decimal('10.00'),
      paymentMethod: 'payhere',
      paymentStatus: 'pending',
      transactionId: null,
    };
    const svc = makeService({
      order: { findUnique: jest.fn().mockResolvedValue(order) },
    });

    // Build a valid sig but with USD currency
    const secretHash = crypto.createHash('md5').update(TEST_MERCHANT_SECRET, 'utf8').digest('hex').toUpperCase();
    const md5sig = crypto
      .createHash('md5')
      .update(`${TEST_MERCHANT_ID}${orderId}10.00USD2${secretHash}`, 'utf8')
      .digest('hex')
      .toUpperCase();

    await expect(
      svc.processWebhook({
        merchant_id: TEST_MERCHANT_ID,
        order_id: orderId,
        payhere_amount: '10.00',
        payhere_currency: 'USD',
        status_code: '2',
        payment_id: 'PAY-USD',
        md5sig,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when amount mismatches order total', async () => {
    const orderId = 'ord-mismatch';
    const order = {
      id: orderId,
      total: new Prisma.Decimal('650.00'),
      paymentMethod: 'payhere',
      paymentStatus: 'pending',
      transactionId: null,
    };
    const svc = makeService({
      order: { findUnique: jest.fn().mockResolvedValue(order) },
    });
    // Webhook amount 100 ≠ order total 650
    const payload = buildValidWebhookPayload(orderId, '100.00');
    await expect(svc.processWebhook(payload)).rejects.toThrow(BadRequestException);
  });
});

// ---------------------------------------------------------------------------
// generatePaymentHashForOrder — access control
// ---------------------------------------------------------------------------

describe('PaymentService.generatePaymentHashForOrder', () => {
  const mockUser = (role: string, sub: string): RequestUser =>
    ({ sub, email: 'x@x.com', role }) as RequestUser;

  it('throws ForbiddenException when CLIENT tries to access another users order', async () => {
    const order = { id: 'ord-private', total: new Prisma.Decimal('200.00'), customerId: 'other-user', placedByUserId: null };
    const svc = makeService({ order: { findUnique: jest.fn().mockResolvedValue(order) } });
    await expect(
      svc.generatePaymentHashForOrder(mockUser('CLIENT', 'my-user-id'), 'ord-private', 200.0),
    ).rejects.toThrow();
  });

  it('allows CLIENT to access their own order', async () => {
    const order = { id: 'ord-mine', total: new Prisma.Decimal('200.00'), customerId: 'my-user-id', placedByUserId: null };
    const svc = makeService({ order: { findUnique: jest.fn().mockResolvedValue(order) } });
    const result = await svc.generatePaymentHashForOrder(
      mockUser('CLIENT', 'my-user-id'),
      'ord-mine',
      200.0,
    );
    expect(result.hash).toBeDefined();
  });

  it('allows CASHIER to access any order', async () => {
    const order = { id: 'ord-any', total: new Prisma.Decimal('500.00'), customerId: 'some-cust', placedByUserId: null };
    const svc = makeService({ order: { findUnique: jest.fn().mockResolvedValue(order) } });
    const result = await svc.generatePaymentHashForOrder(
      mockUser('CASHIER', 'cashier-id'),
      'ord-any',
      500.0,
    );
    expect(result.hash).toBeDefined();
  });

  it('throws BadRequestException when amount mismatches order total', async () => {
    const order = { id: 'ord-am', total: new Prisma.Decimal('300.00'), customerId: 'me', placedByUserId: null };
    const svc = makeService({ order: { findUnique: jest.fn().mockResolvedValue(order) } });
    await expect(
      svc.generatePaymentHashForOrder(mockUser('CASHIER', 'c'), 'ord-am', 999.0),
    ).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when order not found', async () => {
    const svc = makeService({ order: { findUnique: jest.fn().mockResolvedValue(null) } });
    await expect(
      svc.generatePaymentHashForOrder(mockUser('ADMIN', 'a'), 'ghost', 100),
    ).rejects.toThrow(BadRequestException);
  });
});

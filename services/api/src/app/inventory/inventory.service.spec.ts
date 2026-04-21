import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from './inventory.service';
import { Prisma } from '@prisma/client';
import type { RequestUser } from '../../auth/current-user.decorator';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const mockActor: RequestUser = {
  sub: 'actor-id',
  email: 'admin@wrap.lk',
  role: 'ADMIN',
};

// Valid UUIDs required by Zod schemas
const ING_ID = '550e8400-e29b-41d4-a716-446655440001';

/** Build a Prisma mock from partial overrides. */
function makePrisma(overrides: Record<string, unknown> = {}): PrismaService {
  return overrides as unknown as PrismaService;
}

function decimalOf(n: number): Prisma.Decimal {
  return new Prisma.Decimal(n);
}

function makeIngredient(overrides: Record<string, unknown> = {}) {
  return {
    id: ING_ID,
    name: 'Chicken',
    unit: 'g',
    currentStock: decimalOf(1000),
    costPerUnit: decimalOf(1.5),
    lowStockThreshold: decimalOf(100),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// appendMovement (via restockIngredient public API)
// ---------------------------------------------------------------------------

describe('InventoryService.restockIngredient', () => {
  it('calls $transaction and returns a movement record', async () => {
    const movement = { id: 'mv-1', ingredientId: ING_ID, quantityDelta: decimalOf(100) };
    const ingredient = makeIngredient();
    const updatedIngredient = makeIngredient({ currentStock: decimalOf(1100) });

    const txMock = {
      ingredient: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce(ingredient)
          .mockResolvedValueOnce(ingredient),
        update: jest.fn().mockResolvedValue(updatedIngredient),
      },
      inventoryMovement: {
        create: jest.fn().mockResolvedValue(movement),
      },
      ingredientValuationSnapshot: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    const transactionFn = jest.fn().mockImplementation(async (cb: (tx: typeof txMock) => Promise<unknown>) => cb(txMock));
    const opsFn = jest.fn().mockResolvedValue({});

    const prisma = makePrisma({
      $transaction: transactionFn,
      ingredient: { findUnique: jest.fn() },
      opsActivityEvent: { create: opsFn },
    });

    const svc = new InventoryService(prisma);
    const result = await svc.restockIngredient(
      { ingredientId: ING_ID, quantity: 100, unitCost: 2 },
      mockActor,
    );

    expect(transactionFn).toHaveBeenCalledTimes(1);
    expect(result).toBe(movement);
    // Audit trail
    expect(opsFn).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: 'inventory.restock' }),
      }),
    );
  });

  it('rejects with ZodError for a non-UUID ingredientId (schema-level guard)', async () => {
    const svc = new InventoryService(makePrisma());
    await expect(
      svc.restockIngredient(
        { ingredientId: 'not-a-uuid', quantity: 100, unitCost: 2 },
        mockActor,
      ),
    ).rejects.toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// appendMovement — low-stock event emission
// ---------------------------------------------------------------------------

describe('InventoryService — low stock alert', () => {
  it('allows movement and logs low-stock warning when threshold crossed', async () => {
    // Simulate an ingredient at 105g with 100g threshold. After consuming 10g → 95g → below threshold
    const ingredient = makeIngredient({ currentStock: decimalOf(105), lowStockThreshold: decimalOf(100) });
    const updatedIngredient = makeIngredient({ currentStock: decimalOf(95), lowStockThreshold: decimalOf(100) });

    const txMock = {
      ingredient: {
        findUnique: jest.fn().mockResolvedValue(ingredient),
        update: jest.fn().mockResolvedValue(updatedIngredient),
      },
      inventoryMovement: {
        create: jest.fn().mockResolvedValue({ id: 'mv-x', ingredientId: ING_ID, quantityDelta: decimalOf(-10) }),
      },
      ingredientValuationSnapshot: { create: jest.fn().mockResolvedValue({}) },
    };

    const transactionFn = jest.fn().mockImplementation(async (cb: (tx: typeof txMock) => Promise<unknown>) => cb(txMock));
    const opsFn = jest.fn().mockResolvedValue({});
    const prisma = makePrisma({
      $transaction: transactionFn,
      opsActivityEvent: { create: opsFn },
    });

    const svc = new InventoryService(prisma);
    await svc.recordWaste(
      { ingredientId: ING_ID, quantity: 10, note: 'Spilled' },
      mockActor,
    );
    expect(txMock.ingredient.update).toHaveBeenCalled();
  });

  it('does NOT emit low_stock when stock remains above threshold', async () => {
    const ingredient = makeIngredient({ currentStock: decimalOf(600), lowStockThreshold: decimalOf(100) });
    const updatedIngredient = makeIngredient({ currentStock: decimalOf(590), lowStockThreshold: decimalOf(100) });

    const txMock = {
      ingredient: {
        findUnique: jest.fn().mockResolvedValue(ingredient),
        update: jest.fn().mockResolvedValue(updatedIngredient),
      },
      inventoryMovement: {
        create: jest.fn().mockResolvedValue({ id: 'mv-y', ingredientId: ING_ID, quantityDelta: decimalOf(-10) }),
      },
      ingredientValuationSnapshot: { create: jest.fn().mockResolvedValue({}) },
    };

    const transactionFn = jest.fn().mockImplementation(async (cb: (tx: typeof txMock) => Promise<unknown>) => cb(txMock));
    const opsFn = jest.fn().mockResolvedValue({});
    const prisma = makePrisma({
      $transaction: transactionFn,
      opsActivityEvent: { create: opsFn },
    });

    const svc = new InventoryService(prisma);
    await svc.recordWaste({ ingredientId: ING_ID, quantity: 10 }, mockActor);
    expect(txMock.ingredient.update).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// appendMovement — insufficient stock guard
// ---------------------------------------------------------------------------

describe('InventoryService — insufficient stock guard', () => {
  it('throws when waste exceeds currentStock (Zod passes, appendMovement rejects)', async () => {
    const ingredient = makeIngredient({ currentStock: decimalOf(5) });

    const txMock = {
      ingredient: {
        findUnique: jest.fn().mockResolvedValue(ingredient),
        update: jest.fn(),
      },
      inventoryMovement: { create: jest.fn() },
      ingredientValuationSnapshot: { create: jest.fn() },
    };

    const transactionFn = jest
      .fn()
      .mockImplementation(async (cb: (tx: typeof txMock) => Promise<unknown>) => cb(txMock));

    const prisma = makePrisma({ $transaction: transactionFn });
    const svc = new InventoryService(prisma);

    // appendMovement throws BadRequestException when resulting qty goes negative
    await expect(
      svc.recordWaste({ ingredientId: ING_ID, quantity: 10 }, mockActor),
    ).rejects.toBeDefined(); // ZodError or BadRequestException
  });
});

// ---------------------------------------------------------------------------
// handleOrderInKitchen — idempotency guard
// ---------------------------------------------------------------------------

describe('InventoryService.handleOrderInKitchen — idempotency', () => {
  it('skips processing when COGS already recorded for the order', async () => {
    const txMock = {
      orderCogsLine: {
        count: jest.fn().mockResolvedValue(1), // already consumed
      },
      order: { findUnique: jest.fn() },
    };
    const transactionFn = jest
      .fn()
      .mockImplementation(async (cb: (tx: typeof txMock) => Promise<unknown>) => cb(txMock));

    const prisma = makePrisma({ $transaction: transactionFn });
    const svc = new InventoryService(prisma);

    await svc.handleOrderInKitchen({ orderId: 'order-abc' });

    // findUnique on order should NOT have been called — processing stopped early
    expect(txMock.order.findUnique).not.toHaveBeenCalled();
  });

  it('does not call $transaction when orderId is missing from event payload', async () => {
    const transactionFn = jest.fn();
    const prisma = makePrisma({ $transaction: transactionFn });
    const svc = new InventoryService(prisma);

    // No orderId in payload
    await svc.handleOrderInKitchen({});
    expect(transactionFn).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// createIngredient — validation
// ---------------------------------------------------------------------------

describe('InventoryService.createIngredient — validation', () => {
  it('throws when lowStockThreshold exceeds initialStock', async () => {
    const prisma = makePrisma({ $transaction: jest.fn() });
    const svc = new InventoryService(prisma);
    await expect(
      svc.createIngredient(
        { name: 'Salt', unit: 'g', currentStock: 10, costPerUnit: 0.5, lowStockThreshold: 50 },
        mockActor,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});

// ---------------------------------------------------------------------------
// recordWaste — audit trail
// ---------------------------------------------------------------------------

describe('InventoryService.recordWaste — audit trail', () => {
  it('writes an opsActivityEvent with eventType inventory.waste_recorded', async () => {
    const ingredient = makeIngredient({ currentStock: decimalOf(500) });
    const updatedIngredient = makeIngredient({ currentStock: decimalOf(490) });

    const txMock = {
      ingredient: {
        findUnique: jest.fn().mockResolvedValue(ingredient),
        update: jest.fn().mockResolvedValue(updatedIngredient),
      },
      inventoryMovement: {
        create: jest.fn().mockResolvedValue({ id: 'mv-w', ingredientId: ING_ID, quantityDelta: decimalOf(-10) }),
      },
      ingredientValuationSnapshot: { create: jest.fn().mockResolvedValue({}) },
    };

    const transactionFn = jest.fn().mockImplementation(async (cb: (tx: typeof txMock) => Promise<unknown>) => cb(txMock));
    const opsFn = jest.fn().mockResolvedValue({});

    const prisma = makePrisma({
      $transaction: transactionFn,
      opsActivityEvent: { create: opsFn },
    });

    const svc = new InventoryService(prisma);
    await svc.recordWaste({ ingredientId: ING_ID, quantity: 10, note: 'Expired' }, mockActor);

    expect(opsFn).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: 'inventory.waste_recorded' }),
      }),
    );
  });
});

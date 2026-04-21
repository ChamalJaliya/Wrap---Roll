# 🧪 Testing Guide — Wrap & Roll

> **Document Status**: `v1.0` | **Scope**: `services/api` test suite

This guide covers everything you need to understand, run, and extend the Wrap & Roll test suite.

---

## Table of Contents

1. [Test Architecture Overview](#1-test-architecture-overview)
2. [Running Tests](#2-running-tests)
3. [Test Layers Explained](#3-test-layers-explained)
4. [Mock Strategy & `test-utils.ts`](#4-mock-strategy--test-utilsts)
5. [Fixtures](#5-fixtures)
6. [Adding a New Spec](#6-adding-a-new-spec)
7. [Stress & Concurrency Tests](#7-stress--concurrency-tests)
8. [E2E Tests (Playwright)](#8-e2e-tests-playwright)
9. [Coverage](#9-coverage)

---

## 1. Test Architecture Overview

```
services/api/src/
├── app/
│   ├── coupon/
│   │   └── coupon.service.spec.ts      ← Unit: validation rules, audit trail
│   ├── inventory/
│   │   └── inventory.service.spec.ts   ← Unit: deduction, low-stock, COGS
│   ├── payment/
│   │   └── payment.service.spec.ts     ← Unit: MD5 sig, idempotency, IDOR
│   └── order/
│       ├── order.service.spec.ts        ← Unit: state machine transitions
│       └── order-queue-projection.spec.ts ← Unit: role-scoped projections
└── test/
    ├── test-utils.ts                    ← Shared NestJS test app factory
    ├── fixtures/
    │   ├── order-fixtures.ts            ← WrapOrder payload builders
    │   └── queue-order-db-fixture.ts    ← Queue DB row fixture
    ├── contract.spec.ts                 ← Integration: API contract (Zod schema)
    ├── lifecycle.spec.ts                ← Integration: Order lifecycle flow
    ├── queue-response-roles.spec.ts     ← Integration: Role-scoped queue JSON
    ├── coupon.spec.ts                   ← Integration: Coupon validation endpoint
    ├── auth-rbac.spec.ts                ← Integration: RBAC + IDOR boundaries
    ├── inventory.spec.ts                ← Integration: Inventory transition flow
    ├── enum-parity.spec.ts              ← Integration: Contract enum parity
    └── stress.spec.ts                   ← Conditional: Concurrency & stress (real DB)
```

**Test types:**

| Type | DB? | Speed | Purpose |
|:--|:--|:--|:--|
| **Unit** | No (mocks) | < 1s per suite | Business logic correctness |
| **Integration** | No (mocked Prisma) | 2–5s per suite | API wiring, auth, contract |
| **Stress / Concurrency** | Yes (real Supabase) | 30–60s | Race conditions, inventory accuracy |
| **E2E (Playwright)** | Yes (real stack) | 1–2 min | Browser-level smoke tests |

---

## 2. Running Tests

```bash
# Run all unit + integration tests
npx nx test api

# Run a single spec file
npx nx test api --testFile=services/api/src/app/coupon/coupon.service.spec.ts

# Run by pattern
npx nx test api --testPathPattern=coupon

# With watch mode (development)
npx nx test api --watch

# With full coverage report
npx nx test api --coverage

# Run all affected tests (CI-style — only changed files)
npx nx affected --target=test --base=origin/main
```

---

## 3. Test Layers Explained

### Unit Tests (`app/**/*.service.spec.ts`)

Unit tests instantiate the service class directly with fully mocked dependencies.  
**No HTTP server** is bootstrapped — tests are pure function-level.

```typescript
// Pattern: construct service with mock Prisma
const prisma = { coupon: { findUnique: jest.fn().mockResolvedValue(coupon) } } as unknown as PrismaService;
const svc = new CouponService(prisma);
const result = await svc.validateCoupon('WELCOME10', 1000);
expect(result.valid).toBe(true);
```

### Integration Tests (`src/test/*.spec.ts`)

Integration tests use `createTestApp()` which spins up a **full NestJS application** with:
- Prisma overridden with in-memory mocks (no real DB)
- Guards overridden to allow role-based testing via token strings
- ThrottlerGuard disabled

```typescript
const response = await request(app.getHttpServer())
  .post('/api/orders')
  .set('Authorization', 'Bearer mock-token') // CASHIER role
  .send(payload);
expect(response.status).toBe(201);
```

---

## 4. Mock Strategy & `test-utils.ts`

`src/test/test-utils.ts` is the **single shared factory** for all integration tests.

### Role Token Map

| Bearer Token | Resolved Role |
|:--|:--|
| `mock-token` (default) | `CASHIER` |
| `mock-role-admin` | `ADMIN` |
| `mock-role-kitchen` | `KITCHEN` |
| `mock-role-courier` | `COURIER` |

### Mocked Services

| Service | What is mocked |
|:--|:--|
| `PrismaService` | `order.*`, `coupon.*`, `customer.*`, `businessSettings.*`, `$transaction` |
| `SupabaseService` | `verifyToken` → returns a synthetic user |
| `PaymentService` | `processWebhook`, `generatePaymentHash` → noop returns |
| `SupabaseAuthGuard` | `canActivate` → sets `request.user` from token string |
| `RolesGuard` | `canActivate` → always `true` (role checked per token) |
| `ThrottlerGuard` | `canActivate` → always `true` (no rate limit in tests) |

> ⚠️ **Important**: The mocked `PrismaService` maintains a `let mockOrder = { id: 'test-order-id', ... }` singleton that mutates across tests within the same `app` instance. Beware of test ordering effects if you are testing bidirectional state changes.

---

## 5. Fixtures

### `buildWrapOrderFixture(overrides?)`

Builds a valid `WrapOrderSchema`-compatible payload. Use it for `POST /api/orders` calls:

```typescript
import { buildWrapOrderFixture, ORDER_VALUES } from './fixtures/order-fixtures';

const payload = buildWrapOrderFixture({
  orderId: 'my-order-id',
  customer: { name: 'Alice' },
  payment: { method: ORDER_VALUES.paymentMethod.cash, status: ORDER_VALUES.paymentStatus.completed },
  fulfillment: { type: ORDER_VALUES.fulfillment.takeaway },
});
```

### `queueOrderDbFixture`

A pre-built `QueueOrder` database row used by the mock `PrismaService.order.findMany` to simulate the queue endpoint (`/api/orders/queue`).

---

## 6. Adding a New Spec

### Unit test (service-level)

1. Create `[module]/[service].service.spec.ts` next to the service file.
2. Import the service class directly — **do not** import `AppModule`.
3. Mock all constructor dependencies with `jest.fn()`.
4. Follow the existing pattern in `coupon.service.spec.ts`.

### Integration test (API-level)

1. Create `src/test/[feature].spec.ts`.
2. Use `createTestApp()` from `./test-utils`.
3. Set the `Authorization` header using the token mapping above.
4. Call `app.close()` in `afterAll`.

### Example scaffold

```typescript
import request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { createTestApp } from './test-utils';

describe('My Feature', () => {
  let app: INestApplication;
  beforeAll(async () => { app = await createTestApp(); });
  afterAll(async () => { await app.close(); });

  it('does the thing', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/my-endpoint')
      .set('Authorization', 'Bearer mock-token');
    expect(res.status).toBe(200);
  });
});
```

---

## 7. Stress & Concurrency Tests

The stress suite (`stress.spec.ts`) is **opt-in** and requires a real, seeded Supabase database.

```bash
# Enable and run
RUN_STRESS_TESTS=1 npx nx test api --testPathPattern=stress.spec --forceExit

# With a custom timeout
RUN_STRESS_TESTS=1 npx jest services/api/src/test/stress.spec.ts --testTimeout=120000
```

**What it tests:**
- **Flash Sale (100 orders concurrent)**: places, pays via webhook, transitions to `in_kitchen` → `ready` concurrently. Verifies inventory accuracy.
- **Offline Cashier Sync (10 cash orders)**: simulates POS offline batch sync with inventory deduction.

> ⚠️ These tests mutate real data. They clean up their own test data (seeded under known UUIDs) in `afterAll`. **Never run against production.**

---

## 8. E2E Tests (Playwright)

```bash
# Start the full stack first
npm run start:api &
npm run start:admin &

# Then run E2E
npm run e2e:admin
```

Playwright config is in `apps/admin/playwright.config.ts`. Tests live in `apps/admin/e2e/`.

---

## 9. Coverage

Coverage is collected per-project. The global threshold is set in `jest.preset.js`:

| Metric | Threshold |
|:--|:--|
| Lines | 80% |
| Branches | 75% |

```bash
# Generate and view a coverage report
npx nx test api --coverage
open coverage/lcov-report/index.html
```

> Coverage is uploaded as a GitHub Actions artifact on every CI run. Download it from the **Actions** tab on the PR.

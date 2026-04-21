# Queue API response personas (least-privilege JSON)

## Summary

`GET /orders/queue` builds an internal **ops** row (`QueueOrder` / `OpsQueueOrder`), then applies **`projectQueueOrderForPersona`** so each staff role only receives fields appropriate for that surface:

| JWT role   | Persona   | Contract type        |
|-----------|-----------|----------------------|
| ADMIN, CASHIER | `ops` | `OpsQueueOrder` (= full `QueueOrder`) |
| KITCHEN   | `kitchen` | `KitchenQueueOrder` |
| COURIER   | `courier` | `CourierQueueOrder` |

Mapping from role to persona lives in **`staffRoleToResponsePersona`** (`libs/contracts/src/response/response-persona.ts`). The Nest **`OrderService.getQueue`** method applies the projector after sorting.

## Runtime checks (API)

In **non-production** (and when `QUEUE_PROJECTION_VALIDATE=1` in production), the API logs warnings if:

- Forbidden keys appear on kitchen/courier payloads (`KITCHEN_QUEUE_FORBIDDEN_KEYS`, `COURIER_QUEUE_FORBIDDEN_KEYS`).
- Zod schemas drift from the TypeScript projectors (`KitchenQueueOrderSchema`, `CourierQueueOrderSchema`).

Tests use `NODE_ENV=test`, which **skips** these warnings to avoid noise. To force validation in a deployed staging environment, set `QUEUE_PROJECTION_VALIDATE=1`. To disable locally: `QUEUE_PROJECTION_VALIDATE=0`.

## Contracts layout

- `libs/contracts/src/response/order-queue-projection.ts` — types + pure projectors
- `libs/contracts/src/response/order-queue-projection.schema.ts` — Zod (strict object shapes)
- `libs/contracts/src/response/queue-projection-runtime.ts` — forbidden-key helpers + Zod issue descriptions

## Refactor hazard

When renaming symbols, avoid naive replace of `QueueOrder` inside longer identifiers (e.g. `setQueueOrders`, `refreshQueueOrders`). See comment in `services/api/src/test/test-utils.ts`.

## Performance & concurrency

See [scaling-api-queue.md](./scaling-api-queue.md) (indexes, lean reads, cache headers, throttles, k6 script).

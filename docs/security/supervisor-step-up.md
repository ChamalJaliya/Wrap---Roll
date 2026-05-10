# Supervisor step-up (POS)

This document describes the **production-style supervisor step-up** flow: a cashier session stays `CASHIER`, while **short-lived elevation** is issued after an **ADMIN** proves email + **supervisor PIN**. The pattern matches common retail POS “manager override” without a second full login.

## Threat model (short)

- The **browser is not trusted** for authority. Hiding a button in React is UX only; **all privileged operations must be enforced in the API** with a valid elevation session.
- **PINs** are stored only as **scrypt** hashes in Postgres (`StaffSupervisorPin`). Plaintext PINs never appear in logs.
- **Brute force** is mitigated with **throttling** on `POST /supervisor/challenge` (currently **8 requests / minute / default throttler scope**) and **generic** `Supervisor authentication failed.` responses for invalid email / missing PIN / wrong PIN (audit rows still record the real reason).
- **Manual discount orders** mark the elevation session **`consumedAt`** when the order is committed, so the same token cannot be replayed for another order (single-use for that flow).

## Data model

| Table | Purpose |
|--------|---------|
| `StaffSupervisorPin` | One row per ADMIN `staffUserId` (Supabase `user.id`) with `pinHash`. |
| `SupervisorElevationSession` | Opaque `elevationToken`, `cashierUserId`, `supervisorUserId`, `scope`, `expiresAt`, optional `consumedAt` (for future single-use). |
| `SupervisorElevationAudit` | Append-only style events: challenge success/failure, PIN set, etc. |

## API (Nest)

| Method | Path | Who | Description |
|--------|------|-----|-------------|
| `POST` | `/supervisor/challenge` | Staff (`CASHIER` + others) | Body: `{ supervisorEmail, pin, scope? }`. Returns `{ elevationToken, expiresAt, scope }`. Default TTL **3 minutes**. |
| `POST` | `/supervisor/privileged/ping` | `CASHIER` + `ADMIN` | **Demo** of a protected route. Header: `x-supervisor-elevation: <token>`. |
| `PATCH` | `/supervisor/pins/:staffUserId` | `ADMIN` | Body: `{ pin }`. Sets or rotates the supervisor PIN for that **ADMIN** user. |

### Elevation header

Privileged routes use the header:

`x-supervisor-elevation: <elevationToken>`

The `SupervisorElevationGuard` + `@RequireSupervisorElevation('privileged_operations')` decorator validate that:

- the token exists and is not expired;
- the session’s `cashierUserId` matches the authenticated user;
- the session `scope` matches the decorator.

## Cashier app

- **Coupon / promo** and **Supervisor step-up** live in the cart column.
- **Unlock** calls `POST /api/nest/supervisor/challenge` (via the existing Next proxy).
- **Test privileged API** calls `POST /api/nest/supervisor/privileged/ping` with the elevation header.

## Operations checklist

1. **Migrate DB**: apply Prisma migration `20260509160000_supervisor_step_up`.
2. **Set a PIN** (as `ADMIN`, e.g. from HTTP client or future admin UI):  
   `PATCH /supervisor/pins/<adminSupabaseUserId>` with `{ "pin": "……" }` (min 6 characters).
3. **Sign in as cashier** on the POS, enter the **supervisor’s email** + **PIN**, tap **Unlock**.
4. Use **Test privileged API** to confirm the round trip.

## TODO — dated backlog

Search this doc for **`TODO-2026-05-09`** (or jump to this section) when picking up work.

### `TODO-2026-05-09` — Reuse supervisor elevation for POS controls

Extend the same pattern (`SupervisorElevationGuard`, scoped challenge `scope`, `SupervisorElevationAudit`, optional `consumedAt` per flow):

| Track | Suggested scope string | Notes |
|--------|-------------------------|--------|
| Refunds | `refunds` | Tie audit + API checks to payment / order ids; idempotent refund handling on server. |
| Void (order or line) | `order_void` | Align with kitchen / settlement rules before exposing in UI. |
| Cancel | `order_cancel` | Same guard; business rules (timing, fulfillment state) stay in `OrderService` (or equivalent). |

Cashier: reuse challenge UI; pass **`x-supervisor-elevation`** with the scope returned from challenge for each route.

### Other next steps (not implemented here)

- **Single-use** tokens for high-risk actions where not already consumed (`consumedAt`).
- **Manager UI** in `apps/admin` to set PIN without raw HTTP.
- **Stricter rate limits** or IP-based lockout for repeated challenge failures.

## Related code

- `services/api/src/app/supervisor/` — service, controller, guard, scrypt helpers.
- `services/api/prisma/schema.prisma` — models above.
- `apps/cashier/src/app/page.tsx` — POS UI for challenge + demo ping.

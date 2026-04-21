# Queue release timing + prioritization (plan)

This defines **when** tickets may enter each queue and **how** staff see urgency. Implementation should follow **§0** (non-negotiable for a clean system).

---

## 0. Principles (contract-first, no legacy drift)

- **Contracts are the API of the monorepo.** Add or extend types in [`libs/contracts`](../../libs/contracts/src) (`OrderStatus`, `QueueOrder`, `releaseReason`, business settings shapes) before introducing ad-hoc fields in apps. Apps import **only** from `@wrap-roll/contracts` public exports.
- **Server is authoritative.** `kitchenEligible`, schedule gates, sort order, and any **computed deadline / SLA bucket** should be produced in [`services/api`](../../services/api/src/app/order/order.service.ts) (or a dedicated policy module called from it). Client surfaces **render** server output; they must not re-implement release math in parallel (KDS realtime already risks drift—fix by refetch or server-computed fields).
- **Latest behavior only; avoid compatibility fallbacks.** We work from **current seed + schema**. When changing policy, **remove** obsolete code paths and outdated seed branches rather than keeping “just in case” branches. Prefer one clear implementation + migration notes in PR description over layered fallbacks.
- **Config is explicit.** Prep lead, SLA windows, cutoffs live in **documented** settings (`BusinessSettings`, `deliveryJson`, `operationsCalendarJson` as already modeled). Avoid silent per-app defaults that disagree with the API.

---

## 1. Release timing (kitchen / scheduled)

- **Problem:** `kitchenEligible` today does not consider `estimatedReadyTime`; prepaid scheduled orders can appear on KDS too early.
- **Direction:** Derive **`kitchenReleaseAt`** from `estimatedReadyTime` minus **prep lead** (minutes), sourced from settings (dedicated key or agreed reuse—decide once, document in contracts/settings).
- **Gate:** If `estimatedReadyTime` is set, require `now >= kitchenReleaseAt` (in **business timezone**) before treating the ticket as releasable for kitchen, unless **manual override** (§7.4).
- **Delivery v1 semantics:** `estimatedReadyTime` = **target ready time** (pickup handoff or **ready for courier**). Street **arrival** is phase 2 (travel buffer / zones).
- **Delivery queue:** No extra gate on `ready` in v1 if kitchen only marks `ready` when appropriate; flow stays `… → ready → in_transit`.

---

## 2. Prioritization (ordering tickets)

Staff need one **deterministic** ordering, not FIFO-only by `placedAt`.

**Sort keys (API `orderBy` + stable tie-break):**

1. **SLA / risk bucket** (overdue, due soon, ok)—prefer **server-computed** ordinal or sort fields (§8).
2. **`kitchenPriority`:** `rush` before `normal` (existing field).
3. **Deadline ascending:** scheduled → `estimatedReadyTime`; ASAP → `implicitDeadline = placedAt + serviceLevelMinutes` (§3).
4. **`placedAt`:** oldest first within the same bucket.

**Surfaces:** KDS queue, delivery `ready`, admin/cashier (same default order for trust).

---

## 3. ASAP delivery (and ASAP in general)

- **Phase 1:** Optional **`serviceLevelMinutes`** in settings → `implicitDeadline = placedAt + serviceLevelMinutes` for **priority and badges** (delivery-focused or all types—pick one, document in contracts).
- **Phase 2:** Arrival promises → add **travel buffer**; deadlines combine prep + travel.
- Use implicit deadline for **UX / sort** until you explicitly enforce hard SLAs.

---

## 4. Visual treatment (cards)

| Signal | Meaning |
|--------|--------|
| **RUSH** | `kitchenPriority === rush` |
| **SCHEDULED** + time | `estimatedReadyTime` in venue TZ |
| **DUE SOON** | within N minutes of deadline |
| **OVERDUE** | past deadline and not yet at the relevant milestone (`ready`, etc.) |
| **DELIVERY** | fulfillment badge |

Shared styling via `@wrap-roll/shared-ui` (`QueueOrderCard`, KDS `OrderCard`) fed by **server fields** where possible.

---

## 5. Realtime vs API truth

- **KDS:** After Supabase updates, **refetch** queue or merge using **same ordering as API** so priority does not drift.
- **Delivery:** Poll already API-backed; **order must match** server `orderBy`.

---

## 6. Out of scope (first slice)

- Auto-escalation of `kitchenPriority`.
- Guaranteed arrival SLA enforcement.
- Per-menu-item prep times.

---

## 7. Production hardening (gaps closed)

### 7.1 Ownership

| Concern | Owner |
|--------|--------|
| Release gate, `kitchenEligible`, transition blocks | API `OrderService` / shared policy module |
| Sort order, SLA bucket | API queue responses |
| Display | KDS / delivery / admin (read-only) |

### 7.2 Time and boundaries

- **Clock:** `now` in **`BusinessSettings.timezone`** for all comparisons (align with [`validateCustomerOrderTiming`](../../services/api/src/app/settings/operations-calendar-rules.ts)).
- **Overnight windows:** Same rules as ordering policy; document if API host `TZ` must match venue.
- **Boundaries:** Define inclusive/exclusive for `kitchenReleaseAt` (e.g. eligible when `now >= releaseAt`); minute granularity; behavior if `estimatedReadyTime` is edited in support.

### 7.3 API contract (avoid client duplication)

Expose stable computed fields on `QueueOrder` (or a nested `timing` object) **from the API**, for example:

- `kitchenReleaseAt` (ISO) or null if ASAP-only
- `priorityDeadlineAt` (ISO)—scheduled or implicit ASAP
- `slaBucket`: `overdue` | `due_soon` | `ok` (string union in contracts)

UIs sort and badge from these **only**, so Radix/KDS/Delivery stay in sync.

### 7.4 Manual override

- **Who:** `ADMIN` / `CASHIER` (align with existing RBAC).
- **What:** Force kitchen release or adjust `estimatedReadyTime` with **audit event** (you already have payment/support event patterns—reuse).
- **No silent bypass** in client-only code.

### 7.5 Observability

- Metrics or structured logs: blocked-by-schedule count, overdue tickets by queue, time from `placed` → `in_kitchen` vs deadline.
- Optional alerts when overdue rate exceeds threshold (later).

### 7.6 Tests

- Unit: release predicate (timezone, overnight, boundary minute).
- Contract: queue payload includes new fields and sorts deterministically.
- Integration: KDS refetch after realtime preserves order parity with API.

---

## 8. Seed and legacy cleanup (latest only)

- **Seed** ([`services/api/src/seed.ts`](../../services/api/src/seed.ts)) should reflect **current** `BusinessSettings` and **representative order scenarios** only (ASAP, scheduled, rush, delivery + pickup)—no obsolete shapes or duplicate “old flow” rows kept for backward compatibility.
- When implementing this plan, **delete** dead code paths (duplicate scheduling logic, unused release helpers) instead of retaining fallbacks.
- **Documentation:** Update [`docs/ops/actor-flow-status.md`](./actor-flow-status.md) and [`docs/ops/ordering-policy.md`](./ordering-policy.md) so runbooks match the single implementation.

---

## 9. Reflection in order Kanban (admin/cashier)

This section defines exactly how new timing/priority features appear on the Kanban boards.

### 9.1 Column model (no status changes)

- Keep existing status columns (`placed`, `paid`, `in_kitchen`, `ready`, `in_transit`, `delivered`, terminals).
- Do **not** invent UI-only pseudo statuses. Timing and urgency are represented as **badges/metadata**, not new columns.

### 9.2 Card metadata (top-right badges)

- `SCHEDULED` badge + local time when `estimatedReadyTime` exists.
- `RELEASE HH:mm` badge when `kitchenReleaseAt` exists and order is not yet kitchen-eligible.
- SLA badge from `slaBucket`:
  - `OVERDUE` (red)
  - `DUE SOON` (amber)
  - `ON TRACK` (neutral, optional)
- Existing `RUSH` and fulfillment badges remain.

### 9.3 Default board sort (applies within each column)

Use server-provided order; UI should not re-implement ranking. Expected sequence:

1. `slaBucket` severity (`overdue` > `due_soon` > `ok`)
2. `kitchenPriority` (`rush` > `normal`)
3. `priorityDeadlineAt` ascending
4. `placedAt` ascending

### 9.4 Interaction rules

- If `kitchenEligible === false` and `releaseReason === SCHEDULED_PENDING`, disable `placed -> in_kitchen` move with helper text:
  - “Scheduled. Kitchen release at HH:mm.”
- If manual override is used by authorized roles, record audit note and refresh board from API immediately.

### 9.5 Kanban filters/chips (optional but recommended)

- Quick filters: `All`, `Overdue`, `Due soon`, `Scheduled`, `Rush`, `Delivery`.
- These are view filters only; no extra backend states required.

### 9.6 Board-level KPIs (top summary)

- `Overdue now` count
- `Due in next 15m` count
- `Scheduled waiting release` count
- `Rush active` count

All counts should come from current board dataset using API-computed timing fields.

### 9.7 Empty/error states

- If board has no cards after filters, show empty-state reason (e.g., “No overdue tickets”).
- If queue fetch fails, show blocking banner/toast and preserve last known board snapshot until retry.

---

*Last updated: added Kanban reflection model (columns, badges, sorting, interactions, KPIs) under contract-first/server-authoritative policy.*

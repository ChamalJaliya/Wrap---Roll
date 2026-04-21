# Ordering policy & operational surfaces

## Policy A (customer storefront)

| Flow | When the customer may submit |
|------|------------------------------|
| **ASAP** (no scheduled pickup/delivery time) | Only while the business is **open** for immediate orders: wall-clock in `BusinessSettings.timezone`, from **open** through **last order minute** = `closingTimeMinutes − orderCutoffBeforeCloseMinutes` (from `deliveryJson`). |
| **Scheduled** (`estimatedReadyTime` / client `requestedTime`) | **Any time**, including when ASAP is closed, **if** the slot passes: same calendar **day** as “now” in `BusinessSettings.timezone` (when `scheduleSameDayOnly`), slot **within** `[open, close)`, **before** last-order cutoff, and at least **`minLeadTimeMinutes`** after submission time. |

Staff **POST /orders** paths use the same `createOrder` pipeline unless we later add an explicit override flag.

### Holidays & overrides (`operationsCalendarJson`)

Stored on `BusinessSettings.operationsCalendarJson` (see `OperationsCalendar` in `@wrap-roll/contracts`). Normalized by `normalizeOperationsCalendar`; customer timing is enforced by `validateCustomerOrderTiming` (same rules for web checkout and staff flows using `createOrder`).

| Field | Effect |
|--------|--------|
| **`closedDates`** | List of `YYYY-MM-DD` (interpreted in `BusinessSettings.timezone`). That calendar day is treated as **closed** for ASAP and scheduled slots. |
| **`specialHours`** | Per-date overrides: `closedForDay`, or `openingTimeMinutes` + `closingTimeMinutes` (and optional `note`). If both open/close are set, they replace the default hours for that date (including overnight if close ≤ open). |
| **`emergencyClosureUntil`** | ISO instant: while server `now` is **before** this time, **all** new customer orders are rejected (message from `emergencyClosureMessage` when set). |

Public **`GET /settings`** exposes **`acceptingOrders`** and **`closureReason`** (computed for “ASAP right now” / emergency). The storefront uses these to disable checkout before submit; the API still enforces on `POST`.

### Timezone

- **Non-overnight** hours: ASAP and scheduled slot checks use **`Intl`** in `BusinessSettings.timezone` (default `Asia/Colombo`).
- **Overnight** (`closingTimeMinutes <= openingTimeMinutes`): slot boundaries still use `Date`-based window math on the API host; run the API with `TZ` aligned to the venue or treat overnight as advanced until fully migrated.

---

## Admin: order board vs payment board

- **Single API load:** `GET /orders/queue?status=…&date=YYYY-MM-DD`
- **Order flow board** and **payment flow board** are **the same dataset**; the UI groups or filters by `status` vs `paymentStatus` / method.
- **`date`**: filters `placedAt` to the **operational window** returned by `getOperationalWindow(date)` (not raw UTC midnight). Use the date picker / “Reset to today” so the window matches the business day you care about.

**Defaults:** `GET /settings` includes **`operationalCalendarDate`** (YYYY-MM-DD in `BusinessSettings.timezone`, with the same overnight anchor heuristic as queue “today”). Admin and cashier initialize the board date and **Reset to today** from that field (fallback: UTC calendar date if settings fail).

---

## Cashier queue

- Same pattern as admin: `GET /api/nest/orders/queue?…&date=` with a chosen **calendar** `date` interpreted by the API into an operational window.

---

## Kitchen (KDS)

- **Initial load:** `GET /orders/queue?status=placed,paid,in_kitchen&date=today`
- **`today`:** server resolves **current** operational anchor (same rules as reconciliation “today”, including overnight edge).
- **Realtime:** Supabase `Order` updates can **append** rows without re-checking `date=today`. A **periodic refetch** (e.g. every 60s) re-applies the API filter so tickets don’t stick from another ops day.

Kitchen shows orders that are `in_kitchen` **or** `kitchenEligible === true` (so `placed` phone/COD can appear when policy allows).

---

## Delivery app

- **Ready:** `GET /orders/queue?status=ready&fulfillmentType=delivery&date=today`
- **My transit:** `GET /orders/queue?status=in_transit&fulfillmentType=delivery&date=today` then filter `courierId`.

Same **`date=today`** semantics as KDS. No realtime → list is always API-filtered.

---

## Quick reference

| Surface | Endpoint | `date` |
|---------|----------|--------|
| Admin boards | `/orders/queue` | `YYYY-MM-DD` or `today` |
| Cashier | `/orders/queue` (proxied) | same |
| Kitchen | `/orders/queue` | `today` |
| Delivery | `/orders/queue` | `today` |

---

## Related

- `docs/ops/actor-flow-status.md` — status / RBAC / kitchen eligibility
- `services/api/.env.example` — optional `TZ=` note for overnight / host alignment

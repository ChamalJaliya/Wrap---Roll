# 📡 API Reference — Wrap & Roll

> **Document Status**: `v1.0` | **Base URL**: `http://localhost:4000/api`  
> **Interactive Docs**: Visit `/api/docs` when the API is running (Swagger UI).  
> **Authentication**: All protected endpoints require `Authorization: Bearer <supabase-jwt>` unless marked 🌐 Public.

---

## Table of Contents

- [Orders](#orders-apiorders)
- [Payment](#payment-apipayment)
- [Coupon](#coupon-apicoupon)
- [Inventory](#inventory-apiinventory)
- [Menu (Admin)](#menu-admin-apiadminmenu)
- [Coupon (Admin)](#coupon-admin-apiadmincoupon)
- [Analytics](#analytics-apianalytics)
- [Staff](#staff-apistaff)
- [Settings](#settings-apisettings)
- [Customer Vault](#customer-vault-apicustomer)
- [Notification](#notification-apinotification)
- [Print](#print-apiprint)

---

## Orders `/api/orders`

### `POST /api/orders`
Place a new order.

| Attribute | Value |
|:--|:--|
| **Auth** | `CLIENT`, `CASHIER` |
| **Rate Limit** | 5 req / 10s |
| **Idempotency** | `X-Idempotency-Key` header |
| **Body** | `WrapOrderSchema` (Zod) |
| **Returns** | Created order object |
| **Status** | `201 Created` / `400 Bad Request` |

**Body shape (excerpt):**
```json
{
  "orderId": "uuid",
  "customer": { "name": "Alice" },
  "items": [{ "wrapId": "uuid", "quantity": 1, "unitPrice": 650, "lineTotal": 650 }],
  "pricing": { "subtotal": 650, "tax": 0, "total": 650, "discountAmount": 0, "deliveryFee": 0 },
  "payment": { "method": "payhere", "status": "pending" },
  "fulfillment": { "type": "takeaway" },
  "source": "client_web"
}
```

---

### `GET /api/orders`
List orders by status.

| Attribute | Value |
|:--|:--|
| **Auth** | `ADMIN`, `CASHIER`, `COURIER`, `KITCHEN` |
| **Query params** | `status`, `fulfillmentType` |
| **Returns** | `Order[]` |

---

### `GET /api/orders/queue`
Role-scoped operations queue with computed fields (SLA, actions, kitchenEligible, etc.).

| Attribute | Value |
|:--|:--|
| **Auth** | `ADMIN`, `CASHIER`, `COURIER`, `KITCHEN` |
| **Rate Limit** | 120 req / min |
| **Cache** | `Cache-Control: no-store`, `Vary: Authorization` |
| **Query params** | `status` (comma-separated), `fulfillmentType`, `date`, `page`, `limit` |
| **Returns** | `QueueOrder[]` — filtered by role persona |

> KITCHEN and COURIER personas receive stripped-down responses (no pricing, no transactionId). See `KITCHEN_QUEUE_FORBIDDEN_KEYS` and `COURIER_QUEUE_FORBIDDEN_KEYS` in `@wrap-roll/contracts`.

---

### `GET /api/orders/queue/stream` (SSE)
Server-Sent Events stream for `queue:dirty` invalidation signals. Connect once per terminal; re-fetch on each event.

| Attribute | Value |
|:--|:--|
| **Auth** | `ADMIN`, `CASHIER`, `COURIER`, `KITCHEN` |
| **Protocol** | `text/event-stream` |
| **Events** | `{ type: 'queue:dirty', orderId?, rev }` |

---

### `GET /api/orders/track/:id` 🌐 Public
Customer self-service order tracking (no auth). Optional `?phone=` for unverified caller validation.

---

### `GET /api/orders/:id`
Fetch a single order. IDOR-protected: `CLIENT` callers can only read their own `customerId`.

---

### `GET /api/orders/:id/payment-events`
Full payment event history for an order.

| **Auth** | `ADMIN`, `CASHIER` |

---

### `GET /api/orders/activity`
Global staff activity feed (mutations, coupon changes, etc.).

| **Auth** | `ADMIN`, `CASHIER` |
| **Query params** | `take`, `entityType`, `app`, `actorRole`, `eventType`, `q`, `from`, `to` |

---

### `GET /api/orders/support/search` / `GET /api/orders/support/:id`
Support lookup — search orders and fetch detailed support view.

| **Auth** | `ADMIN`, `CASHIER` |

---

### `PATCH /api/orders/:id/support`
Update customer / fulfillment support fields (name, phone, table, delivery address, scheduled time). Policy may block edits for some delivery-ready paid orders for cashiers; **ADMIN** is not blocked.

| **Auth** | `ADMIN`, `CASHIER` |
| **Body** | `{ customerName?, customerPhone?, tableNumber?, deliveryAddress?, estimatedReadyTime?, note? }` |

---

### `PATCH /api/orders/:id/line-items`
Replace **all** line items on an existing order. Server recomputes **subtotal**, **tax** (VAT from settings), reapplies **coupon** if still valid, keeps **delivery fee**, updates **total**. Emits payment/event + ops activity + outbox `order.lines_replaced`.

| **Auth** | `ADMIN`, `CASHIER` |
| **Body** | Canonical wrap lines: `{ items: WrapOrderItem[], note?: string, adminOverrideReason?: string }` |
| **Policy (summary)** | **Cashier**: edit while payment is **pending**, or paid but status still **`placed`** / **`paid`**. Not allowed once paid and past that (e.g. **in_kitchen**, **ready**, **in_transit**), or **paid delivery** in **ready**. **ADMIN**: may override blocked states with **`adminOverrideReason`** (minimum 3 characters). |
| **Cashier UI** | **Orders** tab → select order → **Amend lines in POS** → **POS** tab → **Save line changes**. |

---

### `PATCH /api/orders/:id/status`
Advance order status via the state machine. Invalid transitions return `400`. ADMIN-only for voiding in-kitchen orders.

| Attribute | Value |
|:--|:--|
| **Auth** | `ADMIN`, `CASHIER`, `KITCHEN`, `COURIER` |
| **Body** | `{ status: OrderStatus, courierId?: string, replay?: boolean }` |
| **Side-effects** | EventEmitter → Inventory, Print, Notification |

**Valid transitions (simplified):**

```
placed → paid (via webhook) → in_kitchen → ready → delivered
placed → cancelled (CASHIER/ADMIN)
paid / in_kitchen → voided (ADMIN only for in_kitchen)
paid / in_kitchen → refunded (ADMIN only for in_kitchen)
ready → in_transit (COURIER) → delivered
```

---

### `PATCH /api/orders/:id/mark-payment-received`
Record manual payment collection (cash / card at pickup).

| **Auth** | `ADMIN`, `CASHIER`, `COURIER` |
| **Body** | `{ method: 'cash' | 'card', note?: string }` |

---

### `PATCH /api/orders/:id/courier`
Assign a courier to a delivery order.

| **Auth** | `ADMIN`, `CASHIER`, `COURIER` |
| **Body** | `{ courierId: string }` |

---

### `GET /api/orders/reconciliation/summary`
Daily payment reconciliation summary (cash vs. online). Pending **pay-at-collection** orders are grouped under `byMethod.pay_at_collection` (not under `cash`), until payment is collected.

| **Auth** | `ADMIN`, `CASHIER` |
| **Query** | `date` (ISO date string) |

---

## Payment `/api/payment`

### `GET /api/payment/hash`
Generate a PayHere checkout hash for an order.

| **Auth** | `CLIENT`, `CASHIER`, `ADMIN`, `COURIER`, `KITCHEN` |
| **Query** | `orderId`, `amount`, `currency` (default: `LKR`) |
| **Returns** | `{ hash, merchantId, merchant_id }` |

---

### `POST /api/payment/webhook` 🌐 Public
PayHere payment gateway callback. Validates `md5sig`, deduplicates via idempotency key, and emits `order.paid`.

| Attribute | Value |
|:--|:--|
| **Auth** | Public (signature-verified) |
| **Body** | PayHere standard webhook payload |
| **Returns** | `{ success: true }` |
| **Security** | MD5 HMAC verification + DB-backed idempotency claim |

---

### `POST /api/payment/reconcile/:orderId`
Manual payment reconciliation (sandbox/dev only via `ALLOW_INSECURE_RECONCILE_MOCK=true`).

| **Auth** | `ADMIN` |

---

## Coupon `/api/coupon`

### `POST /api/coupon/validate` 🌐 Public
Validate a discount code against a subtotal and optional customer identity.

| Attribute | Value |
|:--|:--|
| **Auth** | Public |
| **Rate Limit** | 5 req / 10s |
| **Body** | `{ code: string, subtotal: number, customerPhone?: string }` |
| **Returns** | `{ valid: boolean, discountAmount: number, message: string }` |

**Rules:**
- Code is normalised to UPPERCASE before lookup.
- Discount is capped at 50% of subtotal.
- `firstOrderOnly` coupons require `customerId` or `customerPhone`.

---

## Coupon (Admin) `/api/admin/coupon`

| Method | Path | Auth | Purpose |
|:--|:--|:--|:--|
| `GET` | `/api/admin/coupon` | `ADMIN` | List all coupons |
| `POST` | `/api/admin/coupon` | `ADMIN` | Create coupon |
| `PATCH` | `/api/admin/coupon/:id` | `ADMIN` | Update coupon |
| `DELETE` | `/api/admin/coupon/:id` | `ADMIN` | Delete coupon |

All write operations produce a `StaffAuditLog` entry.

---

## Inventory `/api/inventory`

| Method | Path | Auth | Purpose |
|:--|:--|:--|:--|
| `GET` | `/api/inventory` | `ADMIN` | List ingredients (paginated, filterable) |
| `POST` | `/api/inventory` | `ADMIN` | Create ingredient |
| `PATCH` | `/api/inventory/:id` | `ADMIN` | Update ingredient metadata (not stock) |
| `DELETE` | `/api/inventory/:id` | `ADMIN` | Delete ingredient |
| `POST` | `/api/inventory/restock` | `ADMIN` | Record a purchase/restock movement |
| `POST` | `/api/inventory/waste` | `ADMIN` | Record a waste event |
| `POST` | `/api/inventory/adjust` | `ADMIN` | Manual stock adjustment |
| `GET` | `/api/inventory/:id/movements` | `ADMIN` | Movement history for ingredient |
| `GET` | `/api/inventory/:id/valuations` | `ADMIN` | Valuation snapshot history |
| `POST` | `/api/inventory/overhead` | `ADMIN` | Add overhead cost entry |
| `GET` | `/api/inventory/overhead` | `ADMIN` | List overhead entries |
| `GET` | `/api/inventory/recipes` | `ADMIN` | List all recipes |

> Stock is automatically deducted when an order transitions to `in_kitchen` via the `order.in_kitchen` event. Direct `currentStock` updates are blocked — use restock/waste/adjust operations.

---

## Menu (Admin) `/api/admin/menu`

| Method | Path | Auth | Purpose |
|:--|:--|:--|:--|
| `GET` | `/api/menu` | 🌐 Public | List active menu items |
| `GET` | `/api/admin/menu` | `ADMIN` | Admin list (all, including inactive) |
| `POST` | `/api/admin/menu/item` | `ADMIN` | Create menu item |
| `PATCH` | `/api/admin/menu/item/:id` | `ADMIN` | Update menu item |
| `DELETE` | `/api/admin/menu/item/:id` | `ADMIN` | Delete menu item |
| `GET/POST/PATCH/DELETE` | `/api/admin/menu/category/*` | `ADMIN` | Category CRUD |

---

## Analytics `/api/analytics`

| Method | Path | Auth | Purpose |
|:--|:--|:--|:--|
| `GET` | `/api/analytics/summary` | `ADMIN` | KPI summary (GMV, orders, covers) |
| `GET` | `/api/analytics/revenue-by-day` | `ADMIN` | Daily revenue chart data |
| `GET` | `/api/analytics/top-items` | `ADMIN` | Top-selling menu items |
| `GET` | `/api/analytics/fulfillment-mix` | `ADMIN` | Takeaway vs dine-in vs delivery split |
| `GET` | `/api/analytics/hourly-heatmap` | `ADMIN` | Order volume by hour-of-day |
| `GET` | `/api/analytics/cogs-summary` | `ADMIN` | Cost of goods sold aggregation |

---

## Staff `/api/staff`

| Method | Path | Auth | Purpose |
|:--|:--|:--|:--|
| `GET` | `/api/staff` | `ADMIN` | List all staff members |
| `POST` | `/api/staff` | `ADMIN` | Create staff member |
| `PATCH` | `/api/staff/:id` | `ADMIN` | Update staff role / metadata |
| `DELETE` | `/api/staff/:id` | `ADMIN` | Deactivate staff member |

---

## Settings `/api/settings`

| Method | Path | Auth | Purpose |
|:--|:--|:--|:--|
| `GET` | `/api/settings/business` | `ADMIN`, `CASHIER` | Fetch business settings (payment methods, etc.) |
| `PATCH` | `/api/settings/business` | `ADMIN` | Update business settings |

---

## Customer Vault `/api/customer`

| Method | Path | Auth | Purpose |
|:--|:--|:--|:--|
| `GET` | `/api/customer/addresses` | `CLIENT` | List saved delivery addresses |
| `POST` | `/api/customer/addresses` | `CLIENT` | Save a new address |
| `DELETE` | `/api/customer/addresses/:id` | `CLIENT` | Remove address |
| `GET` | `/api/customer/payment-tokens` | `CLIENT` | List masked payment tokens |

---

## Notification `/api/notification`

| Method | Path | Auth | Purpose |
|:--|:--|:--|:--|
| `POST` | `/api/notification/test-sms` | `ADMIN` | Fire a test SMS (sandbox only) |

---

## Print `/api/print`

| Method | Path | Auth | Purpose |
|:--|:--|:--|:--|
| `POST` | `/api/print/:orderId` | `ADMIN`, `CASHIER` | Trigger thermal receipt print for an order |

---

## Error Responses

All error responses follow the standard NestJS shape:

```json
{
  "statusCode": 400,
  "message": "Human-readable error message",
  "error": "Bad Request"
}
```

| Code | Meaning |
|:--|:--|
| `400` | Validation error / bad input |
| `401` | Missing or invalid Bearer token |
| `403` | Insufficient role (RBAC) or IDOR violation |
| `404` | Resource not found |
| `409` | Conflict (e.g. duplicate coupon code) |
| `429` | Rate limit exceeded |
| `500` | Unexpected server error |

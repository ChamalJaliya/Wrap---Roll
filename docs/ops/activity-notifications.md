# Activity feed and notifications

## Activity feed

**Admin UI**

- **`/activity`** — Global ops timeline: filters, CSV export, “Load more”.

**API**

- **`GET /activity`** — Cursor pagination (`limit`, optional `cursor`). Filters: `from`, `to`, `eventTypes`, `orderId`, `actorUserId`, `search`.
- **`GET /activity/orders/:orderId`** — Same event shape, scoped to one order (e.g. Orders drawer).

**Legacy**

- **`GET /orders/activity`** — Still supported for older clients; new UIs should call **`/activity`**.

## Notifications

### SMS delivery log (admin)

**Admin UI**

- **`/notifications`** — Tab “SMS log”.

**API**

- **`GET /notifications/deliveries`** — **ADMIN** only. Query: `limit`, `cursor`, `channel`, `status`, `from`, `to`, `search`.

**Data**

- Rows live in **`notification_deliveries`**. Typical `status` values: `sent`, `failed`, `skipped_no_phone`.

### Staff inbox

**Admin UI**

- **`/notifications`** — Tab “Inbox”; mark one read or mark all read.

**API** (roles: `ADMIN`, `MANAGER`, `KITCHEN`, `CASHIER`)

- **`GET /notifications/inbox`** — `limit`, `cursor`, `unreadOnly`.
- **`PATCH /notifications/inbox/:id/read`**
- **`PATCH /notifications/inbox/read-all`**

**Data**

- Rows live in **`staff_notifications`**. In-app rows are created when SMS is sent where applicable (aligned title/body).

## Database

Apply Prisma migrations so **`notification_deliveries`** and **`staff_notifications`** exist in the target environment (e.g. `prisma migrate deploy` in CI or release process).

## Related

- [queue-realtime.md](./queue-realtime.md) — queue SSE and dirty stream.

# Scaling: order queue (`GET /orders/queue`)

For a **plain-language walkthrough with diagrams** (replica, cache, request flow), see [queue-scaling-visual-guide.md](./queue-scaling-visual-guide.md).

## Implemented in repo

1. **Indexes** — `Order_status_placedAt_idx`, `Order_fulfillmentType_status_placedAt_idx` (see Prisma migration `20260411140000_order_queue_indexes`). Run `npx prisma migrate deploy` in each environment after deploy.

2. **Lean DB reads** — For **KITCHEN** / **COURIER**, line items omit `unitPrice` / `lineTotal` at the database layer (`order-queue-find.ts`). Ops still loads full items.

3. **Kitchen** — Omits delivery geo columns and `deliveryCalcJson` (not present on `KitchenQueueOrder`).

4. **HTTP** — `Cache-Control: private, no-store, max-age=0` and `Vary: Authorization` on the queue route (`PrivateNoStoreVaryAuthInterceptor`).

5. **Throttling** — `GET /orders/queue` allows **120 requests / 60s** per throttler scope (see `@Throttle` on the handler). Global default remains 100/min on other routes unless overridden.

6. **Connection pool** — Tune `DATABASE_URL` query params (see [services/api/.env.example](../../services/api/.env.example)). With multiple API replicas, prefer **PgBouncer** or strict `connection_limit` so total connections stay under Postgres `max_connections`.

7. **Read replica (optional)** — Set `DATABASE_READ_URL` to route `GET /orders/queue` DB reads (`findMany`, `count`, and `businessSettings` for that request) to a replica. **Replication lag** means rows and settings can be slightly behind primary; acceptable for kitchen/courier boards. All **writes** still use the primary `DATABASE_URL`.

8. **Queue response cache (optional)** — Set `QUEUE_CACHE_TTL_MS` to a small value (e.g. 1000–2000) to cache the **serialized** queue response per persona/query key. Default TTL **0** disables caching. With `REDIS_URL`, cache is shared across instances; otherwise it is **in-process** only (each replica has its own map). Set `QUEUE_CACHE_ENABLED=false` to force-disable even if TTL is set.

9. **Perf logging** — `QUEUE_PERF_LOG=true` logs one JSON line per queue request: duration, cache hit/miss, replica use, order counts — **not** the response body.

## Load testing

See [scripts/load/README.md](../../scripts/load/README.md) for a minimal **k6** script. Set `BASE_URL` and a valid JWT to measure p95 under concurrent workers.

## Follow-ups (not automated here)

- **Column-level Prisma `select`** for ops queue if profiling shows large row payloads.
- **Full APM** (OpenTelemetry, etc.) beyond queue perf logs.

---

## Later backlog (todos you can pick up anytime)

Baseline: lean reads, optional replica + short-TTL cache, throttling, optimistic UI on actions, HTTP cache semantics, **SSE** + global rev (see [queue-realtime.md](./queue-realtime.md)), and relaxed fallback polling (~90s admin/cashier, ~120s kitchen).

1. **WebSockets** — Only if you later need **two-way** high-frequency channels (e.g. live collaboration). Otherwise SSE stays simpler.

2. **ETag / `If-None-Match`** on queue `GET` — Optional bandwidth win keyed by rev.

3. **Transactional outbox** — If you need guaranteed publish-after-commit across process crashes.

4. **Contract tests / load** — Keep k6 or similar in CI or pre-release to guard queue p95 when you change transport or cache behavior.

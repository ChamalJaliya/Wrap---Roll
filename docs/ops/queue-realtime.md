# Queue realtime (SSE)

Staff apps subscribe to **`GET /api/orders/queue/stream`** (Nest: `OrderController`, `@Sse('queue/stream')`). The API emits Server-Sent Events when the global queue revision bumps (`queue:rev:global` in Redis) and publishes JSON on Redis channel **`queue:dirty`**.

## Requirements

- **`REDIS_URL`** — Recommended in production so pub/sub fans out to every API replica and rev is shared. Without Redis, rev uses in-process memory per instance and SSE subscribers only receive heartbeats (clients still work via slower polling).
- **Next.js proxies** (`/api/nest` on cashier and admin) forward **streaming** responses for `orders/queue/stream` (no short upstream timeout; `transfer-encoding` preserved).

## Frontends

- **`useQueueDirtyStream`** (`@wrap-roll/order-kit`) — `fetch` + `ReadableStream` with optional `Authorization` or same-origin cookies.
- **`NEXT_PUBLIC_QUEUE_SSE_ENABLED`** — Set to `0` to disable the hook and rely on polling only.
- **`NEXT_PUBLIC_API_URL`** — Must include the `/api` prefix when talking to Nest directly (e.g. `http://localhost:4000/api`), matching `staffFetchJson` / `resolveApiUrl()`.

## Operations

- Bump + publish run after order-affecting mutations (`OrderService`, payment webhook failure path).
- Tune **`QUEUE_SSE_HEARTBEAT_MS`** (default 25000) so load balancers do not close idle streams before heartbeats.
- **`QUEUE_SSE_DEBUG=1`** — Logs each bump (verbose).

## Related

- [scaling-api-queue.md](./scaling-api-queue.md) — queue `GET`, cache, replica.

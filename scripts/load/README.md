# Load tests (k6)

## Prerequisites

Install [k6](https://k6.io/docs/getting-started/installation/).

## Queue endpoint smoke test

```bash
export BASE_URL=http://localhost:4000/api
export JWT='Bearer <staff-access-token>'
k6 run scripts/load/k6-queue.js
```

Adjust `vus` and `duration` in the script. Use a **non-production** token and rate limits appropriate for your environment.

The script hits `GET /orders/queue?status=placed,paid` and asserts status 200. Tune thresholds after you have baseline p95 latency.

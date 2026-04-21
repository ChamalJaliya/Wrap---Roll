# Wrap & Roll Production Readiness Checklist

Use this checklist as a go-live gate for production deployment.

- Mark each item as `PASS`, `FAIL`, or `N/A`.
- Attach evidence (dashboard screenshot, runbook URL, test log, PR link).
- Production go-live requires all `P0` items to pass.

## Tracking Table

| Priority | Area | Checklist Item | Owner | Status | Evidence | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| P0 | Platform and Infra | Redis HA/failover behavior documented and tested | Ops | FAIL | `docs/ops/backups-dr.md` | Redis is configured but HA/failover drill evidence is missing. |
| P0 | Platform and Infra | Postgres backup and restore drill completed (point-in-time recovery) | Ops | TODO | `docs/ops/backups-dr.md` | Backup docs exist; restore drill evidence still needed. |
| P0 | Platform and Infra | API and worker process supervision with health checks | Platform | FAIL | `package.json` (`start:api`, `start:worker`) | Dev scripts exist; production supervision (PM2/systemd/k8s) not evidenced. |
| P0 | Platform and Infra | Public endpoint rate limits configured and validated | Backend | TODO | `services/api/src/app/order/order.controller.ts` | Throttling decorators are present; load validation evidence needed. |
| P0 | Platform and Infra | TLS and security headers validated in production environment | Platform | TODO | `services/api/src/main.ts` | Helmet is enabled; production TLS/header verification pending. |
| P0 | Security and Secrets | All production secrets injected from secret manager (not local files) | Platform | FAIL | `services/api/.env` | Local env currently holds secrets; move to secret manager before go-live. |
| P0 | Security and Secrets | Auth cookie/JWT settings are production-safe (`secure`, `httpOnly`, same-site) | Security | TODO | `apps/admin/src/lib/authCookies.ts`, `apps/cashier/src/lib/authCookies.ts` | Needs explicit production config verification. |
| P0 | Security and Secrets | RBAC validation across ADMIN/CASHIER/KITCHEN/COURIER/CLIENT | Backend | TODO | `services/api/src/test/auth-rbac.spec.ts` | Automated RBAC tests exist; run report/signoff still needed. |
| P0 | Security and Secrets | Audit trails verified for status/refund/void/payment override actions | Backend | TODO | `services/api/src/app/activity/*`, `services/api/src/app/order/order.service.ts` | Activity logging exists; verification checklist needs execution evidence. |
| P0 | Security and Secrets | Dependency vulnerability review completed (critical issues resolved/accepted) | Security | FAIL | `npm audit` output | Prior audit shows critical vulnerabilities; remediation/acceptance not documented. |
| P0 | Async Reliability | Outbox relay idempotency validated under duplicate delivery | Backend | PASS | `services/api/src/app/outbox/outbox-relay.service.ts`, `services/api/src/app/payment/payment.service.ts` | Idempotency keys + webhook claim flow implemented and exercised. |
| P0 | Async Reliability | Worker retry/backoff tested with forced transient failure | Backend | TODO | `docs/ops/concurrency-improved-bullmq-kafka-ready.md` | Retry logic exists; explicit chaos test evidence pending. |
| P0 | Async Reliability | Dead-letter handling flow tested and runbook documented | Backend | TODO | `docs/ops/concurrency-improved-bullmq-kafka-ready.md` | Dead-letter strategy defined; operational drill evidence missing. |
| P0 | Async Reliability | Queue lag/failed-job alert thresholds configured | Ops | FAIL |  | No alerting configuration evidence yet. |
| P0 | Async Reliability | SSE stability soak test complete (multi-tab, 30-60 min, no reconnect storm) | Frontend | TODO | `apps/admin/src/app/orders/page.tsx`, `apps/cashier/src/app/page.tsx` | Reconnect handling and diagnostics added; soak test still required. |
| P0 | Payments and Reconciliation | PayHere production credentials/domain authorization verified | Payments | FAIL | `services/api/.env` | Sandbox credentials in use; production credentials/domain checks pending. |
| P0 | Payments and Reconciliation | Webhook signature validation tested with real callback payloads | Payments | TODO | `services/api/src/app/payment/payment.service.ts` | Signature verification implemented; production callback test evidence pending. |
| P0 | Payments and Reconciliation | Failed-init/aborted checkout behavior validated (no active queue pollution) | Backend | PASS | `services/api/src/app/payment/payment.controller.ts`, `apps/client/src/app/[locale]/checkout/page.tsx` | Abort endpoint + client abort call path implemented and validated locally. |
| P0 | Payments and Reconciliation | Daily reconciliation validated against gateway + DB truth | Finance/Ops | TODO | `services/api/src/app/order/order.service.ts` (`getReconciliationSummary`) | Summary endpoint exists; reconciliation signoff pending. |
| P0 | Payments and Reconciliation | Manual reconciliation procedure tested by operations | Ops | TODO | `services/api/src/app/payment/payment.controller.ts` (`/payment/reconcile/:orderId`) | Endpoint exists; ops execution evidence not yet captured. |
| P0 | Functional Ops Flows | End-to-end happy path validated across all 5 apps | QA | PASS | Local verification session (API + worker + all apps) | Full flow was exercised with queue processing and UI updates. |
| P0 | Functional Ops Flows | Edge flows validated (cancel/void/refund, cash/card collect, payment fail/retry) | QA | TODO | `services/api/src/app/order/order.service.ts`, specs | Some edge paths tested; full matrix evidence still needed. |
| P0 | Functional Ops Flows | Cross-app consistency validated without manual refresh dependency | QA | TODO | SSE diagnostics and dedupe changes in admin/cashier | Fixes shipped; final multi-app validation run pending. |
| P0 | Functional Ops Flows | Support and diagnostics usable without terminal access | Product/Ops | PASS | `apps/admin/src/app/orders/page.tsx` | Admin diagnostics drawer and live status indicators are available. |
| P1 | Observability | Centralized logs with correlation (`orderId`, `correlationId`, `requestId`) | Ops | FAIL |  | Not yet integrated with CloudWatch/log pipeline. |
| P1 | Observability | Dashboards for API latency/error, worker throughput, queue failures | Ops | FAIL |  | No dashboard evidence yet. |
| P1 | Observability | Alerting configured (5xx spike, worker down, queue failures, webhook failure) | Ops | FAIL |  | Alerts not configured yet. |
| P1 | Observability | On-call triage playbook documented and linked | Ops | TODO | `docs/ops/payment-order-runbook.md`, `docs/ops/payment-rollout-rollback.md` | Partial runbooks exist; consolidated on-call playbook needed. |
| P1 | Data and Migrations | Staging migration rehearsal completed with production-like data volume | Backend | TODO |  | Not yet evidenced. |
| P1 | Data and Migrations | Rollback plan documented for app and schema changes | Backend | TODO | `docs/ops/payment-rollout-rollback.md` | Payment rollback doc exists; full app/schema rollback plan still needed. |
| P1 | Data and Migrations | Retention/cleanup policy finalized for outbox and activity events | Backend/Ops | TODO |  | Policy not documented yet. |
| P1 | Release Discipline | CI gate enforces lint/test/build before deploy | Platform | TODO | `.github/workflows/ci.yml` | CI exists; release gate requirements need explicit signoff criteria. |
| P1 | Release Discipline | Post-deploy smoke suite runs automatically | QA | TODO |  | Not yet evidenced. |
| P1 | Release Discipline | Feature-flag or canary path exists for risky releases | Platform | TODO |  | No canary/flag rollout evidence documented. |
| P1 | Release Discipline | Engineering + operations go/no-go signoff recorded | Eng + Ops | TODO |  | Signoff template/process pending. |

## Go or No-Go Rule

- **Go live only when all `P0` items are `PASS`.**
- `P1` items can remain open only with explicit owner, due date, and mitigation notes.

## Suggested Evidence Sources

- Screenshot of queue/worker dashboards and alert policy pages
- Test run logs (retry, DLQ, webhook signatures, reconciliation)
- Linked runbooks in `docs/ops/*`
- Incident drill notes for restore/failover tests

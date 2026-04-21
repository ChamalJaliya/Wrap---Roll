# Payment-State Binding Rollout and Rollback

## Goal
Roll out strict payment-state binding with low operational risk while preserving auditability.

## Rollout Phases

### Phase 1: API Enforcement (dark launch)
- Enable strict scenario/payment policy validation in API.
- Keep UI unchanged.
- Observe rejects and log policy violations for 24-48 hours.

### Phase 2: Operator Surfaces
- Enable cashier/admin payment-aware queues and exception badges.
- Enable support timeline visibility and reconciliation summary.
- Train operators on `mark-payment-received` (`method=cash|card`) as the collection completion action.

### Phase 3: Client Experience
- Enable payment method/status visibility in success and track pages.
- Add guidance text for pending/failed/refunded outcomes.

## Feature Flags
- `STRICT_PAYMENT_POLICY=true|false`
- `ENABLE_PAYMENT_EXCEPTION_WIDGETS=true|false`
- `ENABLE_CLIENT_PAYMENT_VISIBILITY=true|false`

## Backfill and Migration Checklist
- Identify orders missing normalized `paymentStatus`.
- Backfill orders where:
  - `status=paid` and `paymentStatus!=completed` => set `paymentStatus=completed` with backfill event.
  - `status=refunded` and `paymentStatus!=refunded` => set `paymentStatus=refunded` with backfill event.
- Record actor as `SYSTEM` and note as `backfill_migration`.

## Rollback Strategy
- Disable strict policy flag first (accept traffic, preserve logs).
- Keep timeline/event recording enabled for forensic visibility.
- Do not delete or rewrite payment events.
- Re-enable old UI behavior only if operator flow is blocked.

## Success Criteria
- No unauthorized `placed -> paid` transitions.
- Duplicate webhook or cash-collection retries produce no duplicate financial mutation.
- Reconciliation variance remains within accepted threshold.

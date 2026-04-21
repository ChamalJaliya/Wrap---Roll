# Payment and Order Incident Runbook

## Scope
- Applies to non-RSVP flows: guest/client dine-in, takeaway, scheduled, and delivery.
- Covers incidents where `order.status` and `paymentStatus` drift or payment events fail.

## Alerts and Thresholds
- Webhook failure rate > 2% over 10 minutes.
- `cash` orders in `pending` for more than 30 minutes after `ready`.
- Reconciliation variance (expected vs collected) not equal to 0 at closeout.
- Duplicate payment event attempts for the same order/payment key.

## Initial Triage (First 10 Minutes)
- Confirm impacted channel: `cashier_pos`, `client_web`, `client_mobile`.
- Pull order by ID from support endpoint and verify:
  - fulfillment type
  - payment method/status
  - current order status
  - payment event timeline
- Check webhook logs for signature and duplicate-key rejects.

## Incident Playbooks

### 1) Online payment marked failed but customer claims success
- Run reconciliation check for the order.
- If gateway confirms payment, emit canonical paid path (do not manually set order paid without event).
- Verify `transactionId` and ensure payment event is present once.

### 2) Cash collected but order still pending payment
- Use `mark-payment-received` endpoint with `method=cash|card` (idempotent).
- Confirm resulting state:
  - `paymentStatus=completed`
  - `status=paid` if order was still `placed`
  - `cash_collected` or `card_collected` event recorded once

### 3) Queue drift (scheduled/overdue misclassification)
- Validate business timezone setting and current effective time window.
- Rebuild queue from API endpoint; do not use stale frontend cache.

## Data Integrity Invariants
- `status=paid` requires payment evidence (`paymentStatus=completed`).
- `status=refunded` must force `paymentStatus=refunded` and create refund event.
- Financial mutations must be idempotent per order and event key.

## Communication Template
- Start: "We identified payment/order mismatch impacting <channel>. Mitigation is active."
- Update every 15 minutes with impacted order count and current rollback/mitigation status.
- Close: include root cause, corrected orders count, and follow-up action owner/date.

## Post-Incident
- Add missing test case for the exact failing transition.
- Add or tune alert threshold to detect earlier.
- Document permanent fix in changelog and closeout notes.

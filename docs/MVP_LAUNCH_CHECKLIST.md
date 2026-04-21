# MVP go-live checklist

Use this before pointing production traffic at Wrap & Roll. Tick items in order within each section.

## 1. Infrastructure

- [ ] **API** runs in production mode (`NODE_ENV=production`) with a stable **process manager** (systemd, PM2, Kubernetes, etc.).
- [ ] **HTTPS** terminates at your edge (CDN, load balancer, or host); HTTP redirects to HTTPS.
- [ ] **Database**: managed Postgres (or equivalent) with **automated backups** enabled; restore tested once (see `docs/ops/backups-dr.md` if present).
- [ ] **Migrations**: `npx prisma migrate deploy` (or your CI step) runs successfully against **production** before cutover.
- [ ] **CORS / origins**: Nest and Next apps only allow your real **customer** and **staff** domains (no wildcard `*` in prod).

## 2. Secrets & environment

- [ ] **Supabase**: production project URL + **service role** and **anon** keys only in server/build env — never commit `.env` with real secrets.
- [ ] **JWT / cookies**: cookie names and `Secure` / `SameSite` settings match HTTPS deployment for cashier, admin, client.
- [ ] **PayHere** (see below): merchant ID and secret from the **live** PayHere dashboard, not sandbox.

## 3. PayHere (online payments)

- [ ] `PAYHERE_MERCHANT_ID` and `PAYHERE_MERCHANT_SECRET` set to **production** credentials.
- [ ] Merchant **site / app domain** registered in PayHere (e.g. `https://yourdomain.com`); localhost only for dev.
- [ ] **Webhook URL** points to `https://<api-host>/api/payment/webhook` (or your mounted path) and is reachable from PayHere.
- [ ] Confirm a **small real transaction** in staging or a controlled prod test: success path updates order + payment events.

> Webhook **idempotency** is enforced in the API via a DB claim on `PaymentEvent` (duplicate deliveries are safe across multiple API instances).

## 4. Staff access (Supabase Auth)

- [ ] Staff users (`ADMIN`, `CASHIER`, `KITCHEN`, `COURIER`) have **`role`** set in **`user_metadata` or `app_metadata`** (API reads both).
- [ ] Cashier sign-in rejects non-staff roles (see cashier auth route).
- [ ] **Print / support** endpoints: only staff roles; verify with a **CLIENT** test user → expect **403**.

## 5. Apps & domains

- [ ] **Client** (`apps/client`): `NEXT_PUBLIC_*` API URL points to production API; menu/checkout smoke-tested.
- [ ] **Cashier / Kitchen / Delivery / Admin**: each uses the production API proxy or direct API URL as designed.
- [ ] **PWA / offline** (cashier): understand limitations; document for staff if you rely on sync queue.

## 5b. Automated admin checks (CI / pre-release)

- [ ] `npm run e2e:admin` passes (Playwright: CSRF on `/api/auth/set-session`, `/api/auth/signin`, `/api/auth/signout`).
- [ ] Optional: configure **`E2E_NONADMIN_EMAIL`** / **`E2E_NONADMIN_PASSWORD`** so the suite also asserts password sign-in rejects non-admin roles.

## 6. Smoke tests (day of launch)

- [ ] Place order on **client** → appears in **API** / **kitchen** queue with expected status.
- [ ] **PayHere** success → order **paid**, receipt/print paths acceptable for ops.
- [ ] **Cash** path: mark payment received → state and events correct.
- [ ] **Admin** login, staff list, critical read paths.

## 7. Operations

- [ ] **Monitoring**: API logs aggregated; error rate or 5xx alerts configured.
- [ ] **On-call**: someone knows how to use `docs/ops/payment-order-runbook.md` for payment mismatches.
- [ ] **Rollback**: procedure documented (revert deploy, disable client ordering banner, etc.).

## 8. Known non-blockers (post-MVP)

- Push/email **notifications** may still be log-only — plan provider + templates if you promise customer comms.
- **Delivery dispatch** SLAs and assignment rules — tighten if delivery is core from day one.
- **Tax invoice** block (VAT ID, legal entity on PDF/print) — add when compliance requires it.

---

**Related:** `docs/admin-todos.md` (admin e2e/CSRF hardening), `RESEARCH_GAPS.md` (product gaps), `docs/ops/payment-order-runbook.md` (incidents).

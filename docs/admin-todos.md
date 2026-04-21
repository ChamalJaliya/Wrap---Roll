# Admin stabilization TODOs

Last updated: 2026-04-10 (password reset + audit + CSRF wave + profile contract centralization)

## Current state

- Admin app routes now compile: `/`, `/menu`, `/analytics`, `/inventory`, `/staff`.
- Sidebar UX is collapsible and has active route highlighting.
- Admin app now has dedicated auth routes: `/auth/signin`, `/auth/callback`.
- Admin protected routes are guarded in the layout shell by session + `ADMIN` role checks.
- Logout is wired to Supabase sign-out and redirects to admin sign-in.
- Staff page now uses real API data and supports courier create + activate/deactivate.
- API now exposes admin staff endpoints: `GET /staff/couriers`, `POST /staff/couriers`, `PATCH /staff/couriers/:id/status`.
- Admin auth screens are now refactored to use shared-ui auth layout components for parity with client experience.
- Admin auth supports two paths for the primary admin: magic link and password sign-in.
- Admin session cookies are now persisted as httpOnly cookies via app auth routes.
- Admin API proxy forwards cookie access token to Nest (`Authorization: Bearer <token>`).
- Staff screen is now unified for operational roles with create/manage for `CASHIER`, `KITCHEN`, `COURIER`, and `ADMIN`.
- Staff backend now exposes unified user APIs: `GET /staff/users`, `POST /staff/users`, `PATCH /staff/users/:id`.
- Admin can trigger password resets from staff table.
- Staff audit trail is visible in admin (`/staff`) and persisted in API DB.
- CSRF token validation is enforced for cookie-mutating auth routes.
- Client profile page now uses centralized form/style/function contracts in `apps/client/src/lib/client-profile-contract.ts` with spec doc `docs/client-profile-centralization-spec.md`.
- Admin pages now have shared UI contracts in `apps/admin/src/lib/admin-ui-contract.ts` with coverage tracked in `docs/admin-page-centralization-status.md`.

## Priority 0 (must finish first)

- Go-live prep: see **`docs/MVP_LAUNCH_CHECKLIST.md`** (env, PayHere prod, smoke, ops).
- API: `RolesGuard` behavior is covered by **`services/api/src/auth/roles.guard.spec.ts`** (wrong role / missing role → 403).
- Admin app: Playwright e2e for **CSRF on cookie-mutating auth routes** — run `npm run e2e:admin` (from repo root; installs browsers via `npx playwright install chromium` on first run). Optional: set **`E2E_NONADMIN_EMAIL`** / **`E2E_NONADMIN_PASSWORD`** to assert `POST /api/auth/signin` returns **403** for non-`ADMIN` users.
- Add e2e checks for forbidden-role handling on **callback UI** and **protected page redirects** (browser flows; optional follow-up).
- Cashier: CSRF + role e2e parity when admin patterns are stable.

## Priority 1 (finish admin module)

- Keep admin account as single-owner model (no public/self admin signup path).
- Add optional forced password change-on-first-login flow for staff accounts.

## Priority 2 (quality and UX hardening)

- Add route-level tests for admin pages to prevent accidental 404 regressions.
- Audit all admin states (loading/error/empty/confirm) for strict component parity with client patterns.
- Add keyboard support and persisted collapse state for sidebar (`localStorage`).
- Add analytics and inventory smoke tests against seeded API data.
- Extend dashboard ops widgets with drill-down links and time filters.

## Open questions

- Should staff identities live fully in Supabase Auth metadata, or in Prisma with sync to Supabase?
- Is `COURIER` the final role label for delivery users, or should it be standardized to `DELIVERY` across UI labels?
- Do we want one shared back-office login with role-based redirect, or separate app login pages per role?

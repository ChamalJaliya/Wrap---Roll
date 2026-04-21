# Admin Page Centralization Status

Last updated: 2026-04-10 (shared-ui primitives + centralization lint)

## Objective

Keep admin pages aligned to shared UI contracts so visual drift and duplicated interaction styles do not creep back in.

## Centralized coverage

- shared admin UI contract module
  - `apps/admin/src/lib/admin-ui-contract.ts`
  - coverage:
    - page shell: `adminPageShellClass`
    - page container: `adminPageContainerClass`
    - primary page title: `adminPageTitleClass`
    - title spacing: `adminPageTitleSpacingClass`

- pages using centralized admin contracts
  - `apps/admin/src/app/auth/signin/page.tsx` (shared-ui `SegmentedControl`)
  - `apps/admin/src/app/pricing/page.tsx` (shell/container/title)
  - `apps/admin/src/app/settings/page.tsx` (shell/container/title)
  - `apps/admin/src/app/coupons/page.tsx` (shell/container/title)
  - `apps/admin/src/app/pricing/page.tsx`, `settings/page.tsx`, `coupons/page.tsx` use shared-ui `FormToggleRow`

## Enforcement

- warning mode checker: `npm run lint:centralization`
- strict mode checker: `npm run lint:centralization:strict`
- checker script: `scripts/centralization/lint-centralization.mjs`
- CI uploads `artifacts/centralization-report.md` in lint job

## Rules for new admin pages

- Do not hardcode full page shell/container/title classes; import from `admin-ui-contract.ts`.
- Do not create one-off segmented controls; use shared-ui `SegmentedControl`.
- Keep page-level code focused on behavior; keep reusable visual contracts in `src/lib`.

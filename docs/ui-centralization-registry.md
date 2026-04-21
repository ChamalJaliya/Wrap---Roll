# UI Centralization Registry

Last updated: 2026-04-10

## Purpose

This registry is the source of truth for where reusable UI contracts and primitives live, who owns them, and when extraction is mandatory.

## Ownership

- Client contracts: frontend product team
- Admin contracts: ops/admin frontend owners
- Shared primitives (`@wrap-roll/shared-ui`): shared-ui maintainers

## Contract modules

### Client app-local contracts

- `apps/client/src/lib/client-page-shell.ts`
  - page shell, max-width containers, display heading scales, lead styles, panel styles
- `apps/client/src/lib/client-profile-contract.ts`
  - profile page form contracts, validators, payload mappers, profile-specific style tokens
- `apps/client/src/lib/client-checkout-contract.ts`
  - checkout address draft contract, payload shaping, checkout-specific style tokens
- `apps/client/src/lib/client-order-tracking-contract.ts`
  - track/success status-flow contract and derived label logic
- `apps/client/src/lib/client-segmented-control.ts`
  - segmented control style/behavior contract for client pages

### Admin app-local contracts

- `apps/admin/src/lib/admin-ui-contract.ts`
  - admin page shell/container/title contracts and segmented control contract

## Shared primitives (`@wrap-roll/shared-ui`)

- `SegmentedControl` (`libs/shared-ui/src/components/SegmentedControl.tsx`)
- `PageHeroHeader` (`libs/shared-ui/src/components/PageHeroHeader.tsx`)
- `InlineFormPanel` (`libs/shared-ui/src/components/InlineFormPanel.tsx`)
- `FormToggleRow` (`libs/shared-ui/src/components/FormToggleRow.tsx`)

Use shared primitives when the same UI shape appears in multiple pages/apps.

## Extraction rules

- If a page-level class pattern appears in 2+ pages, extract to an app-local contract or shared primitive.
- If the pattern appears in both Client and Admin, prefer a shared-ui primitive.
- Page files under `src/app/**/page.tsx` should compose contracts/primitives rather than define repeated style literals.
- Any form state -> API payload transformation repeated in multiple handlers must move to a contract mapper function.

## Banned drift patterns in page files

These are checked by `npm run lint:centralization`:

- raw segmented control wrapper classes:
  - `grid grid-cols-2 gap-2 rounded-xl border p-1`
- raw segmented option button classes:
  - `rounded-lg px-3 py-2 text-xs font-bold`
  - `rounded-lg px-3 py-2 text-xs font-black`
- raw display title class:
  - `font-display text-4xl font-black tracking-tight text-neutral-900`

## Enforcement model

- `npm run lint:centralization`: warning mode (non-blocking), emits report
- `npm run lint:centralization:strict`: blocking mode (exit 1 on violations)

CI starts in warning mode and can graduate to strict by toggling `CENTRALIZATION_STRICT=true`.

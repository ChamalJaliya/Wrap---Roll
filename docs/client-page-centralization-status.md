# Client Page Centralization Status

Last updated: 2026-04-10 (shared-ui primitives + centralization lint)

## Objective

Keep client pages spec-driven by moving repeated page-level contracts, style tokens, and behavior helpers into `apps/client/src/lib/*`.

## Centralized coverage

- `profile/page.tsx`
  - contract module: `apps/client/src/lib/client-profile-contract.ts`
  - spec: `docs/client-profile-centralization-spec.md`
  - coverage: form contracts, validation, payload shaping, edit mapping, profile style tokens

- `checkout/page.tsx`
  - contract module: `apps/client/src/lib/client-checkout-contract.ts`
  - coverage: address draft contract, coordinate parsing, address save payload shaping
  - shared-ui primitives used: `SegmentedControl`, `FormToggleRow`

- `order/success/page.tsx`
  - contract module: `apps/client/src/lib/client-order-tracking-contract.ts`
  - coverage: order status flow contract, fulfillment/payment normalization, status label/description mapping

- `auth/signin/page.tsx` and `auth/signup/page.tsx`
  - shared-ui primitives used: `SegmentedControl`
  - coverage: shared auth mode switch structure with no page-level raw segmented classes

- shared page shell alignment
  - contract module: `apps/client/src/lib/client-page-shell.ts`
  - shared-ui primitive used: `PageHeroHeader` (about/contact/profile/track)
  - coverage: consistent hero title/subtitle rhythm across key pages

- profile form wrappers
  - shared-ui primitives used: `InlineFormPanel`, `FormToggleRow`
  - coverage: reduced page-level checkbox/panel drift

## Enforcement

- warning mode checker: `npm run lint:centralization`
- strict mode checker: `npm run lint:centralization:strict`
- checker script: `scripts/centralization/lint-centralization.mjs`
- CI uploads `artifacts/centralization-report.md` for each run

## Rules for future page work

- If a page has 2+ repeated class strings with the same meaning, move them to a page contract/style module.
- If a page transforms form state to API payloads, centralize the mapper function.
- If a page has business-flow helpers (status transitions, schedule rules, policy interpretation), keep them in a contract module and import into the page.
- Keep route page files focused on composition and event wiring, not contract definitions.

## Next candidates

- lift additional repeated option-card wrappers (address/card selectors) into shared-ui primitives
- gradually retire app-local segmented-control helper file after all consumers are removed

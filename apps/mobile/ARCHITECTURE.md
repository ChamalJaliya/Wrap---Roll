# Mobile App Structure

This mobile app uses a feature-first structure to keep screens clean, reusable, and consistent.

## Directory Layout

- `app/` route files only (Expo Router wrappers)
- `features/<feature>/` feature modules (screen, styles, types, components)
- `components/` cross-feature shared UI primitives
- `constants/` design tokens and shared theme values
- `services/` API/auth service clients
- `store/` app-level state (cart/session)
- `lib/` low-level utilities

## Rules

1. Keep route files thin:
   - `app/...` files should import and export feature screens only.
2. Keep feature logic in `features/<name>/`:
   - API orchestration, local screen state, render tree, and feature-specific styles live here.
3. Keep style tokens centralized:
   - Colors/radius/spacing come from `constants/mobileTheme.ts`.
   - Avoid hardcoded values when a token already exists.
4. Keep shared UI in `components/mobile-ui.tsx`:
   - Reuse `SurfaceCard`, `PrimaryButton`, `TopHeader`, etc. before creating one-off controls.
5. Prefer explicit module boundaries:
   - Use feature barrel files (`features/<name>/index.ts`) for imports.

## Current Migration Status

- Done: `features/menu` and `features/cart` moved out of route files.
- Next: move `home`, `auth`, `checkout`, `profile`, and `menu/[id]` to feature modules using the same pattern.

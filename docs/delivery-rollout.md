# Delivery Fee Rollout Guide

## Feature Flags

- `DELIVERY_GEO_PROVIDER=google|none`
  - `google`: enables `/location/autocomplete` and `/location/place/:id`.
  - `none`: disables provider endpoints for controlled rollout.
- `DELIVERY_REQUIRE_COORDS=true|false`
  - `true` (default): distance-mode checkout requires coordinates.
  - `false`: temporary fallback mode; checkout can proceed with zero delivery fee when coords are missing.

## Suggested Stages

1. **Stage 0 (dark launch)**
   - Deploy backend with `DELIVERY_GEO_PROVIDER=none`.
   - Verify checkout, order creation, and saved-address coordinates persistence.

2. **Stage 1 (internal QA)**
   - Enable `DELIVERY_GEO_PROVIDER=google` only in staging.
   - Validate autocomplete, place selection, and distance-based fee outputs.

3. **Stage 2 (soft production)**
   - Enable provider in production with `DELIVERY_REQUIRE_COORDS=false`.
   - Monitor `delivery_coords_required` and `delivery_out_of_range` rates in API logs.

4. **Stage 3 (strict mode)**
   - Set `DELIVERY_REQUIRE_COORDS=true`.
   - Track conversion funnel from address step to placed order.

## Observability Checklist

- API logs include:
  - `Delivery fee computed ...`
  - blocked reasons: `coords_required`, `out_of_range`, `invalid_rules`
- Frontend dataLayer events:
  - `delivery_location_permission_prompted`
  - `delivery_location_permission_denied`
  - `delivery_fee_calculated`
  - `delivery_out_of_range`


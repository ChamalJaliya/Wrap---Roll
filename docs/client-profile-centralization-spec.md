# Client Profile Centralization Spec

Last updated: 2026-04-10

See also: `docs/client-page-centralization-status.md` for coverage across other client pages.

## Why this exists

The client profile page had repeated UI classes and repeated request-shaping logic spread across the page component. This increases mismatch risk when we update form behavior or visual style.

This spec centralizes:

- form contracts (`AddressForm`, `CardForm`)
- validation contracts (what counts as valid draft data)
- API payload shaping (trim/null normalization)
- shared profile-only style classes

## Source of truth

Use `apps/client/src/lib/client-profile-contract.ts` as the canonical module for profile contracts and behavior.

Do not duplicate these in route pages or feature components.

## Contract rules

- `AddressForm` and `CardForm` are UI draft state contracts.
- `emptyAddressForm` and `emptyCardForm` are the only default seeds for reset state.
- Validation must go through:
  - `isAddressFormValid()`
  - `isCardFormValid()`
- Payload normalization must go through:
  - `toAddressDraftPayload()`
  - `toCardDraftPayload()`

### Normalization details

- `trim()` all editable string inputs before save.
- Optional address fields must become `null` when empty (`addressLine2`, `postalCode`).
- Last 4 card digits remain strict `^\d{4}$`.

## Style centralization rules

Use profile style constants from the same module for recurring profile visuals:

- `profileInlineFormPanelClass`
- `profileCheckboxLabelClass`
- `profileDefaultBadgeClass`

Input and text-area control styles still come from `apps/client/src/lib/client-field-styles.ts`.

## Mapping helpers

When entering edit mode from persisted entities:

- map address entities with `toAddressForm()`
- map card entities with `toCardForm()`

This avoids in-page repeated shape mapping and keeps future contract migration in one place.

## Adoption checklist for new profile features

- Add/extend form type in `client-profile-contract.ts`.
- Add a validator if required fields change.
- Add/extend payload mapper for API contract changes.
- Reuse style constants instead of inline classes.
- Document contract changes in this file.

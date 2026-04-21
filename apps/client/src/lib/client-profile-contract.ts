import type { CustomerAddress, SavedPaymentToken } from '@wrap-roll/contracts';

export type AddressForm = {
  id?: string;
  label: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postalCode: string;
  isDefault: boolean;
};

export type CardForm = {
  id?: string;
  token: string;
  cardBrand: string;
  last4: string;
  isDefault: boolean;
};

export const emptyAddressForm: AddressForm = {
  label: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  postalCode: '',
  isDefault: false,
};

export const emptyCardForm: CardForm = {
  token: '',
  cardBrand: '',
  last4: '',
  isDefault: false,
};

export const profileCheckboxLabelClass = 'flex items-center gap-2 text-sm font-medium text-neutral-700';
export const profileInlineFormPanelClass =
  'mb-6 grid gap-3 rounded-xl border border-orange-100 bg-white/70 p-4 md:grid-cols-2';
export const profileDefaultBadgeClass = 'rounded bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700';

export const isAddressFormValid = (form: AddressForm): boolean =>
  Boolean(form.label.trim() && form.addressLine1.trim() && form.city.trim());

export const isCardFormValid = (form: CardForm): boolean =>
  Boolean(form.token.trim() && form.cardBrand.trim() && /^\d{4}$/.test(form.last4.trim()));

export const toAddressDraftPayload = (form: AddressForm) => ({
  id: form.id,
  label: form.label.trim(),
  addressLine1: form.addressLine1.trim(),
  addressLine2: form.addressLine2.trim() || null,
  city: form.city.trim(),
  postalCode: form.postalCode.trim() || null,
  latitude: null,
  longitude: null,
  geocodeSource: null,
  geocodeAccuracy: null,
  isDefault: form.isDefault,
});

export const toCardDraftPayload = (form: CardForm) => ({
  id: form.id,
  token: form.token.trim(),
  cardBrand: form.cardBrand.trim(),
  last4: form.last4.trim(),
  isDefault: form.isDefault,
});

export const toAddressForm = (address: CustomerAddress): AddressForm => ({
  id: address.id,
  label: address.label,
  addressLine1: address.addressLine1,
  addressLine2: address.addressLine2 ?? '',
  city: address.city,
  postalCode: address.postalCode ?? '',
  isDefault: Boolean(address.isDefault),
});

export const toCardForm = (card: SavedPaymentToken): CardForm => ({
  id: card.id,
  token: card.token,
  cardBrand: card.cardBrand,
  last4: card.last4,
  isDefault: Boolean(card.isDefault),
});

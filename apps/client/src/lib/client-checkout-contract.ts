import { cn } from '@/lib/utils';

export type AddressBookEntry = {
  id: string;
  label: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isDefault?: boolean;
};

export type NewAddressDraft = {
  label: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postalCode: string;
  isDefault: boolean;
};

export const emptyNewAddressDraft: NewAddressDraft = {
  label: 'Home',
  addressLine1: '',
  addressLine2: '',
  city: 'Colombo',
  postalCode: '',
  isDefault: true,
};

export const checkoutOptionCardBaseClass =
  'flex cursor-pointer items-start gap-3 rounded-[var(--radius-xl)] border bg-white/80 p-4 text-sm shadow-sm backdrop-blur-sm transition-colors';
export const checkoutSaveAddressLabelClass = 'flex cursor-pointer items-center gap-2';

export const getCheckoutOptionCardClass = (isActive: boolean) =>
  cn(
    checkoutOptionCardBaseClass,
    isActive ? 'border-primary bg-[hsl(var(--primary)/0.08)]' : 'border-neutral-200/90 hover:border-primary/40',
  );

export const parseCoord = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

export const toCheckoutAddressSavePayload = (
  draft: NewAddressDraft,
  coords: { lat: number | null; lng: number | null },
) => ({
  label: draft.label,
  addressLine1: draft.addressLine1.trim(),
  addressLine2: draft.addressLine2.trim() || null,
  city: draft.city.trim(),
  postalCode: draft.postalCode.trim() || null,
  latitude: coords.lat,
  longitude: coords.lng,
  geocodeSource: coords.lat != null ? 'device_location' : null,
  isDefault: Boolean(draft.isDefault),
});

/**
 * Client-web checkout: subtotal → VAT → line totals.
 * Server `clientCheckoutToWrapOrderShape` + order create must use the same VAT source as public settings.
 */

export const CLIENT_WEB_CHECKOUT_VAT_RATE = 0.15;

/** Clamp VAT rate to [0, 1]; invalid values fall back to default. */
export function normalizeCheckoutVatRate(rate: unknown): number {
  const n =
    typeof rate === 'number'
      ? rate
      : typeof rate === 'string'
        ? parseFloat(rate)
        : Number(rate);
  if (!Number.isFinite(n) || n < 0 || n > 1) {
    return CLIENT_WEB_CHECKOUT_VAT_RATE;
  }
  return Math.round(n * 1_000_000) / 1_000_000;
}

export function computeClientWebCheckoutTotals(
  subtotal: number,
  vatRate: number = CLIENT_WEB_CHECKOUT_VAT_RATE,
): {
  subtotal: number;
  tax: number;
  total: number;
} {
  const s = Number(subtotal);
  const r = normalizeCheckoutVatRate(vatRate);
  const tax = Math.round(s * r * 100) / 100;
  const total = Math.round((s + tax) * 100) / 100;
  return { subtotal: s, tax, total };
}

/**
 * Full storefront order math: VAT on subtotal; discount reduces subtotal portion;
 * `total = subtotal - discountAmount + tax + deliveryFee` (matches order service).
 */
export function computeCheckoutBreakdown(args: {
  subtotal: number;
  vatRate: number;
  deliveryFee: number;
  discountAmount: number;
}): {
  subtotal: number;
  tax: number;
  deliveryFee: number;
  discountAmount: number;
  total: number;
} {
  const s = Number(args.subtotal);
  const tax = Math.round(s * normalizeCheckoutVatRate(args.vatRate) * 100) / 100;
  const disc = Math.max(0, Number(args.discountAmount));
  const del = Math.max(0, Number(args.deliveryFee));
  const total = Math.round((s - disc + tax + del) * 100) / 100;
  return { subtotal: s, tax, deliveryFee: del, discountAmount: disc, total };
}

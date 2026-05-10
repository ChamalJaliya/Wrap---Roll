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
 * Full order math aligned with `OrderService.createOrder` after coupon:
 * taxable base = subtotal − discount, VAT on that base, total = base + tax + delivery.
 *
 * **Single source of truth after checkout:** once `POST /orders` succeeds, persisted money
 * lives on the `Order` row (`subtotal`, `discountAmount`, `tax`, `deliveryFee`, `total`).
 * Ops queue, admin, and cashier Orders read those columns — they do not recompute from cart
 * preview state. If POS preview and DB disagree, the create/sync path did not persist the
 * same inputs (or a later PATCH such as line-items replaced pricing).
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
  const disc = Math.max(0, Number(args.discountAmount));
  const del = Math.max(0, Number(args.deliveryFee));
  const r = normalizeCheckoutVatRate(args.vatRate);
  const taxableBase = Math.max(0, Math.round((s - disc) * 100) / 100);
  const tax = Math.round(taxableBase * r * 100) / 100;
  const total = Math.round((taxableBase + tax + del) * 100) / 100;
  return { subtotal: s, tax, deliveryFee: del, discountAmount: disc, total };
}

const MONEY_EPS = 0.02;

/** Sum of line `lineTotal` values (should match order subtotal before discounts). */
export function sumQueueOrderLineTotals(items: Array<{ lineTotal?: unknown }> | undefined): number {
  if (!items?.length) return 0;
  return Math.round(items.reduce((acc, it) => acc + Number(it.lineTotal ?? 0), 0) * 100) / 100;
}

/**
 * True when `total ≈ (subtotal − discount) + tax + deliveryFee` using stored cents rounding.
 * Does not prove VAT rate correctness — only catches inconsistent scalar writes.
 */
export function isPersistedOrderMoneyRowBalanced(row: {
  subtotal?: unknown;
  discountAmount?: unknown;
  tax?: unknown;
  deliveryFee?: unknown;
  total?: unknown;
}): boolean {
  const sub = Number(row.subtotal ?? 0);
  const disc = Math.max(0, Number(row.discountAmount ?? 0));
  const tax = Number(row.tax ?? 0);
  const del = Math.max(0, Number(row.deliveryFee ?? 0));
  const tot = Number(row.total ?? 0);
  const base = Math.max(0, Math.round((sub - disc) * 100) / 100);
  const expected = Math.round((base + tax + del) * 100) / 100;
  return Math.abs(expected - tot) <= MONEY_EPS;
}

/**
 * Short label for stored order discounts: coupon code when present, otherwise supervisor/manual
 * (manual discounts have no `discountCode` but still have `discountAmount`).
 */
export function formatPersistedDiscountCaption(row: {
  discountCode?: string | null;
  discountAmount?: unknown;
}): string {
  const n = Math.max(0, Number(row.discountAmount ?? 0));
  if (n <= 0 || !Number.isFinite(n)) return '';
  const code = String(row.discountCode ?? '').trim();
  return code.length > 0 ? `Coupon · ${code}` : 'Supervisor / manual';
}

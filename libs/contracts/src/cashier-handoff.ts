/**
 * Cashier POS deep links for in-venue handoff (e.g. dine-in QR).
 * Query name is stable across client web, mobile, and cashier.
 */
export const CASHIER_RESOLVE_ORDER_QUERY = 'resolveOrder';

/** Absolute cashier app URL with ?resolveOrder=<orderId> for staff to open support details. */
export function buildCashierResolveOrderUrl(cashierOrigin: string, orderId: string): string {
  const trimmed = String(orderId ?? '').trim();
  if (!trimmed) {
    const base = String(cashierOrigin ?? '').trim().replace(/\/+$/, '');
    return base || 'http://localhost:3002';
  }
  let base = String(cashierOrigin ?? '').trim().replace(/\/+$/, '');
  if (!base) base = 'http://localhost:3002';
  const url = new URL(base.includes('://') ? base : `https://${base}`);
  url.searchParams.set(CASHIER_RESOLVE_ORDER_QUERY, trimmed);
  return url.toString();
}

import { isElevationExpired, type SupervisorElevation } from './supervisor-session';

/**
 * Same rules as `manualDiscountPreview` on the cashier page — computed at **call time**
 * so "Place order" cannot enqueue without a manual discount when the input already shows one
 * (avoids one-frame stale React state).
 */
export function computeLiveManualDiscountRs(args: {
  manualDiscountInput: string;
  cartSubtotal: number;
  couponDiscountAmount: number;
  elevation: SupervisorElevation | null;
}): number {
  const { manualDiscountInput, cartSubtotal, couponDiscountAmount, elevation } = args;
  if (!elevation?.token || isElevationExpired(elevation)) return 0;
  const n = parseFloat(String(manualDiscountInput).replace(',', '.'));
  const manualDiscountRequested =
    Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
  const maxManual = Math.max(
    0,
    Math.round((cartSubtotal * 0.5 - couponDiscountAmount) * 100) / 100,
  );
  const capped = Math.min(manualDiscountRequested, maxManual);
  return capped;
}

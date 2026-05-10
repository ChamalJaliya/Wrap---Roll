'use client';

import { useSupervisorStore } from '../../store/useSupervisorStore';
import { PrivilegedSurface } from './PrivilegedSurface';

type Props = {
  isOnline: boolean;
};

/**
 * Checkout-side manual discount — requires supervisor session (token from nav unlock).
 */
export function PrivilegedManualDiscount({ isOnline }: Props) {
  const manualDiscountInput = useSupervisorStore((s) => s.manualDiscountInput);
  const setManualDiscountInput = useSupervisorStore((s) => s.setManualDiscountInput);

  return (
    <PrivilegedSurface title="Supervisor · manual discount (Rs)" className="mb-4">
      <input
        id="privileged-manual-discount-rs"
        type="number"
        min={0}
        step="0.01"
        className="h-10 w-full rounded-lg border border-emerald-200/90 bg-background px-3 text-sm tabular-nums shadow-sm focus-visible:border-emerald-500/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25"
        placeholder="0.00"
        value={manualDiscountInput}
        onChange={(e) => setManualDiscountInput(e.target.value)}
        disabled={!isOnline}
      />
      <p className="mt-1.5 text-[10px] leading-snug text-muted-foreground">
        With coupon codes, combined discounts are capped at 50% of subtotal (same as server).
      </p>
    </PrivilegedSurface>
  );
}

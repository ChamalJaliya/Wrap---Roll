/**
 * Client-web checkout: subtotal → VAT → line totals.
 * Server `clientCheckoutToWrapOrderShape` + order create must use the same VAT source as public settings.
 */
export declare const CLIENT_WEB_CHECKOUT_VAT_RATE = 0.15;
/** Clamp VAT rate to [0, 1]; invalid values fall back to default. */
export declare function normalizeCheckoutVatRate(rate: unknown): number;
export declare function computeClientWebCheckoutTotals(subtotal: number, vatRate?: number): {
    subtotal: number;
    tax: number;
    total: number;
};
/**
 * Full storefront order math: VAT on subtotal; discount reduces subtotal portion;
 * `total = subtotal - discountAmount + tax + deliveryFee` (matches order service).
 */
export declare function computeCheckoutBreakdown(args: {
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
};
//# sourceMappingURL=storefront-pricing.d.ts.map
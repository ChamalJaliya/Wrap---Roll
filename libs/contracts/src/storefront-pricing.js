"use strict";
/**
 * Client-web checkout: subtotal → VAT → line totals.
 * Server `clientCheckoutToWrapOrderShape` + order create must use the same VAT source as public settings.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLIENT_WEB_CHECKOUT_VAT_RATE = void 0;
exports.normalizeCheckoutVatRate = normalizeCheckoutVatRate;
exports.computeClientWebCheckoutTotals = computeClientWebCheckoutTotals;
exports.computeCheckoutBreakdown = computeCheckoutBreakdown;
exports.CLIENT_WEB_CHECKOUT_VAT_RATE = 0.15;
/** Clamp VAT rate to [0, 1]; invalid values fall back to default. */
function normalizeCheckoutVatRate(rate) {
    const n = typeof rate === 'number'
        ? rate
        : typeof rate === 'string'
            ? parseFloat(rate)
            : Number(rate);
    if (!Number.isFinite(n) || n < 0 || n > 1) {
        return exports.CLIENT_WEB_CHECKOUT_VAT_RATE;
    }
    return Math.round(n * 1000000) / 1000000;
}
function computeClientWebCheckoutTotals(subtotal, vatRate = exports.CLIENT_WEB_CHECKOUT_VAT_RATE) {
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
function computeCheckoutBreakdown(args) {
    const s = Number(args.subtotal);
    const tax = Math.round(s * normalizeCheckoutVatRate(args.vatRate) * 100) / 100;
    const disc = Math.max(0, Number(args.discountAmount));
    const del = Math.max(0, Number(args.deliveryFee));
    const total = Math.round((s - disc + tax + del) * 100) / 100;
    return { subtotal: s, tax, deliveryFee: del, discountAmount: disc, total };
}
//# sourceMappingURL=storefront-pricing.js.map
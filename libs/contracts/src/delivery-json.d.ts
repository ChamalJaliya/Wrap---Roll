/**
 * Normalized delivery rules from `BusinessSettings.deliveryJson` (flexible JSON).
 */
export type DeliveryFeeMode = 'flat' | 'distance';
export type DistanceBand = {
    /**
     * Inclusive upper bound in km from the origin (straight-line / haversine).
     * `null` means “and above” — must be the last tier after sorting.
     */
    maxKm: number | null;
    fee: number;
};
export type ParsedDeliveryJson = {
    enabled: boolean;
    feeFlat: number;
    orderCutoffBeforeCloseMinutes: number;
    feeMode: DeliveryFeeMode;
    /** Kitchen / store reference point when `feeMode === 'distance'`. */
    originLat: number | null;
    originLng: number | null;
    /** Reject deliveries beyond this straight-line distance (km). `null` = no cap. */
    maxDeliveryKm: number | null;
    distanceBands: DistanceBand[];
};
/** Great-circle distance between two WGS84 points (km). */
export declare function haversineDistanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number;
export declare function parseDeliveryJson(deliveryJson: unknown): ParsedDeliveryJson;
export type DeliveryFeeErrorCode = 'coords_required' | 'out_of_range' | 'invalid_rules';
export type ComputeDeliveryFeeResult = {
    fee: number;
    distanceKm?: number;
    error?: undefined;
} | {
    fee: number;
    distanceKm?: undefined;
    error: DeliveryFeeErrorCode;
};
/**
 * Storefront delivery fee (LKR). Server and client both use this for consistent totals.
 * When `feeMode === 'distance'`, callers must supply drop-off coordinates.
 */
export declare function computeDeliveryFeeLkr(rules: ParsedDeliveryJson, input: {
    fulfillmentIsDelivery: boolean;
    deliveryLat?: number | null;
    deliveryLng?: number | null;
}): ComputeDeliveryFeeResult;
//# sourceMappingURL=delivery-json.d.ts.map
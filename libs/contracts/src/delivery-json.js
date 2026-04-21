"use strict";
/**
 * Normalized delivery rules from `BusinessSettings.deliveryJson` (flexible JSON).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.haversineDistanceKm = haversineDistanceKm;
exports.parseDeliveryJson = parseDeliveryJson;
exports.computeDeliveryFeeLkr = computeDeliveryFeeLkr;
const EARTH_RADIUS_KM = 6371;
/** Great-circle distance between two WGS84 points (km). */
function haversineDistanceKm(lat1, lng1, lat2, lng2) {
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return EARTH_RADIUS_KM * c;
}
function normalizeBands(raw) {
    if (!Array.isArray(raw)) {
        return [];
    }
    const out = [];
    for (const row of raw) {
        if (!row || typeof row !== 'object')
            continue;
        const r = row;
        const feeRaw = Number(r.fee);
        const fee = Number.isFinite(feeRaw) && feeRaw >= 0 ? Math.round(feeRaw * 100) / 100 : 0;
        let maxKm = null;
        if (r.maxKm !== undefined && r.maxKm !== null && String(r.maxKm).toLowerCase() !== 'null') {
            const m = Number(r.maxKm);
            maxKm = Number.isFinite(m) && m > 0 ? m : null;
        }
        out.push({ maxKm, fee });
    }
    out.sort((a, b) => {
        var _a, _b;
        const ai = (_a = a.maxKm) !== null && _a !== void 0 ? _a : Number.POSITIVE_INFINITY;
        const bi = (_b = b.maxKm) !== null && _b !== void 0 ? _b : Number.POSITIVE_INFINITY;
        return ai - bi;
    });
    if (out.length === 0)
        return [];
    return out;
}
function parseDeliveryJson(deliveryJson) {
    var _a;
    if (!deliveryJson || typeof deliveryJson !== 'object') {
        return {
            enabled: true,
            feeFlat: 0,
            orderCutoffBeforeCloseMinutes: 60,
            feeMode: 'flat',
            originLat: null,
            originLng: null,
            maxDeliveryKm: null,
            distanceBands: [],
        };
    }
    const d = deliveryJson;
    const enabled = d.enabled === undefined ? true : Boolean(d.enabled);
    const feeRaw = Number(d.feeFlat);
    const feeFlat = Number.isFinite(feeRaw) && feeRaw >= 0 ? Math.round(feeRaw * 100) / 100 : 0;
    const cutoffRaw = Number(d.orderCutoffBeforeCloseMinutes);
    const orderCutoffBeforeCloseMinutes = Number.isFinite(cutoffRaw) && cutoffRaw >= 0 ? Math.floor(cutoffRaw) : 60;
    const modeRaw = String((_a = d.feeMode) !== null && _a !== void 0 ? _a : 'flat').toLowerCase();
    const feeMode = modeRaw === 'distance' ? 'distance' : 'flat';
    const olat = Number(d.originLat);
    const olng = Number(d.originLng);
    const originLat = Number.isFinite(olat) && olat >= -90 && olat <= 90 ? olat : null;
    const originLng = Number.isFinite(olng) && olng >= -180 && olng <= 180 ? olng : null;
    let maxDeliveryKm = null;
    if (d.maxDeliveryKm !== undefined && d.maxDeliveryKm !== null) {
        const mx = Number(d.maxDeliveryKm);
        if (Number.isFinite(mx) && mx > 0)
            maxDeliveryKm = mx;
    }
    const distanceBands = normalizeBands(d.distanceBands);
    return {
        enabled,
        feeFlat,
        orderCutoffBeforeCloseMinutes,
        feeMode,
        originLat,
        originLng,
        maxDeliveryKm,
        distanceBands,
    };
}
/**
 * Storefront delivery fee (LKR). Server and client both use this for consistent totals.
 * When `feeMode === 'distance'`, callers must supply drop-off coordinates.
 */
function computeDeliveryFeeLkr(rules, input) {
    var _a, _b;
    if (!input.fulfillmentIsDelivery || !rules.enabled) {
        return { fee: 0 };
    }
    if (rules.feeMode !== 'distance') {
        return { fee: rules.feeFlat };
    }
    if (rules.originLat == null ||
        rules.originLng == null ||
        rules.distanceBands.length === 0) {
        return { fee: 0, error: 'invalid_rules' };
    }
    const lat = input.deliveryLat;
    const lng = input.deliveryLng;
    if (lat == null ||
        lng == null ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        lat < -90 ||
        lat > 90 ||
        lng < -180 ||
        lng > 180) {
        return { fee: 0, error: 'coords_required' };
    }
    const distanceKm = haversineDistanceKm(rules.originLat, rules.originLng, lat, lng);
    if (rules.maxDeliveryKm != null && distanceKm > rules.maxDeliveryKm + 1e-6) {
        return { fee: 0, error: 'out_of_range' };
    }
    for (const band of rules.distanceBands) {
        const cap = (_a = band.maxKm) !== null && _a !== void 0 ? _a : Number.POSITIVE_INFINITY;
        if (distanceKm <= cap + 1e-9) {
            return { fee: band.fee, distanceKm };
        }
    }
    const last = rules.distanceBands[rules.distanceBands.length - 1];
    return { fee: (_b = last === null || last === void 0 ? void 0 : last.fee) !== null && _b !== void 0 ? _b : 0, distanceKm };
}
//# sourceMappingURL=delivery-json.js.map
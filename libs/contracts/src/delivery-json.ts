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

const EARTH_RADIUS_KM = 6371;

/** Great-circle distance between two WGS84 points (km). */
export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

function normalizeBands(raw: unknown): DistanceBand[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  const out: DistanceBand[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const feeRaw = Number(r.fee);
    const fee =
      Number.isFinite(feeRaw) && feeRaw >= 0 ? Math.round(feeRaw * 100) / 100 : 0;
    let maxKm: number | null = null;
    if (r.maxKm !== undefined && r.maxKm !== null && String(r.maxKm).toLowerCase() !== 'null') {
      const m = Number(r.maxKm);
      maxKm = Number.isFinite(m) && m > 0 ? m : null;
    }
    out.push({ maxKm, fee });
  }
  out.sort((a, b) => {
    const ai = a.maxKm ?? Number.POSITIVE_INFINITY;
    const bi = b.maxKm ?? Number.POSITIVE_INFINITY;
    return ai - bi;
  });
  if (out.length === 0) return [];
  return out;
}

export function parseDeliveryJson(deliveryJson: unknown): ParsedDeliveryJson {
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
  const d = deliveryJson as Record<string, unknown>;
  const enabled = d.enabled === undefined ? true : Boolean(d.enabled);
  const feeRaw = Number(d.feeFlat);
  const feeFlat =
    Number.isFinite(feeRaw) && feeRaw >= 0 ? Math.round(feeRaw * 100) / 100 : 0;
  const cutoffRaw = Number(d.orderCutoffBeforeCloseMinutes);
  const orderCutoffBeforeCloseMinutes =
    Number.isFinite(cutoffRaw) && cutoffRaw >= 0 ? Math.floor(cutoffRaw) : 60;

  const modeRaw = String(d.feeMode ?? 'flat').toLowerCase();
  const feeMode: DeliveryFeeMode = modeRaw === 'distance' ? 'distance' : 'flat';

  const olat = Number(d.originLat);
  const olng = Number(d.originLng);
  const originLat = Number.isFinite(olat) && olat >= -90 && olat <= 90 ? olat : null;
  const originLng = Number.isFinite(olng) && olng >= -180 && olng <= 180 ? olng : null;

  let maxDeliveryKm: number | null = null;
  if (d.maxDeliveryKm !== undefined && d.maxDeliveryKm !== null) {
    const mx = Number(d.maxDeliveryKm);
    if (Number.isFinite(mx) && mx > 0) maxDeliveryKm = mx;
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

export type DeliveryFeeErrorCode =
  | 'coords_required'
  | 'out_of_range'
  | 'invalid_rules';

export type ComputeDeliveryFeeResult =
  | { fee: number; distanceKm?: number; error?: undefined }
  | { fee: number; distanceKm?: undefined; error: DeliveryFeeErrorCode };

/**
 * Storefront delivery fee (LKR). Server and client both use this for consistent totals.
 * When `feeMode === 'distance'`, callers must supply drop-off coordinates.
 */
export function computeDeliveryFeeLkr(
  rules: ParsedDeliveryJson,
  input: {
    fulfillmentIsDelivery: boolean;
    deliveryLat?: number | null;
    deliveryLng?: number | null;
  },
): ComputeDeliveryFeeResult {
  if (!input.fulfillmentIsDelivery || !rules.enabled) {
    return { fee: 0 };
  }

  if (rules.feeMode !== 'distance') {
    return { fee: rules.feeFlat };
  }

  if (
    rules.originLat == null ||
    rules.originLng == null ||
    rules.distanceBands.length === 0
  ) {
    return { fee: 0, error: 'invalid_rules' };
  }

  const lat = input.deliveryLat;
  const lng = input.deliveryLng;
  if (
    lat == null ||
    lng == null ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return { fee: 0, error: 'coords_required' };
  }

  const distanceKm = haversineDistanceKm(rules.originLat, rules.originLng, lat, lng);

  if (rules.maxDeliveryKm != null && distanceKm > rules.maxDeliveryKm + 1e-6) {
    return { fee: 0, error: 'out_of_range' };
  }

  for (const band of rules.distanceBands) {
    const cap = band.maxKm ?? Number.POSITIVE_INFINITY;
    if (distanceKm <= cap + 1e-9) {
      return { fee: band.fee, distanceKm };
    }
  }

  const last = rules.distanceBands[rules.distanceBands.length - 1];
  return { fee: last?.fee ?? 0, distanceKm };
}

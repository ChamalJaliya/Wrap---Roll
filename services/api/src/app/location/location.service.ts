import { Injectable, ServiceUnavailableException } from '@nestjs/common';

export type LocationProvider = 'none' | 'google';

export type LocationAutocompleteItem = {
  id: string;
  label: string;
  secondaryText?: string;
};

export type PlaceCoordinateResult = {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
};

export type ReverseGeocodeResult = {
  formattedAddress: string;
  addressLine1: string;
  city: string | null;
  postalCode: string | null;
  country: string | null;
};

type CacheEntry<T> = { expiresAt: number; value: T };

@Injectable()
export class LocationService {
  private readonly provider: LocationProvider;
  private readonly googleApiKey: string;
  private readonly cacheTtlMs = 45_000;
  private readonly autocompleteCache = new Map<string, CacheEntry<LocationAutocompleteItem[]>>();
  private readonly placeCache = new Map<string, CacheEntry<PlaceCoordinateResult>>();
  private readonly geocodeAddressCache = new Map<string, CacheEntry<{ latitude: number; longitude: number } | null>>();

  constructor() {
    const p = String(process.env.DELIVERY_GEO_PROVIDER ?? 'google').toLowerCase();
    this.provider = p === 'none' ? 'none' : 'google';
    this.googleApiKey = String(process.env.GOOGLE_MAPS_API_KEY ?? '').trim();
  }

  private getCached<T>(cache: Map<string, CacheEntry<T>>, key: string): T | null {
    const row = cache.get(key);
    if (!row) return null;
    if (Date.now() > row.expiresAt) {
      cache.delete(key);
      return null;
    }
    return row.value;
  }

  private setCached<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T): void {
    cache.set(key, { value, expiresAt: Date.now() + this.cacheTtlMs });
  }

  private ensureGoogleEnabled(): void {
    if (this.provider !== 'google') {
      throw new ServiceUnavailableException('Location provider is disabled');
    }
    if (!this.googleApiKey) {
      throw new ServiceUnavailableException('Google maps API key is not configured');
    }
  }

  async autocomplete(query: string): Promise<LocationAutocompleteItem[]> {
    const q = String(query ?? '').trim();
    if (q.length < 3) return [];
    const key = q.toLowerCase();
    const cached = this.getCached(this.autocompleteCache, key);
    if (cached) return cached;
    this.ensureGoogleEnabled();

    const u = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json');
    u.searchParams.set('input', q);
    u.searchParams.set('key', this.googleApiKey);
    u.searchParams.set('components', 'country:lk');

    const res = await fetch(u.toString(), { method: 'GET' });
    if (!res.ok) {
      throw new ServiceUnavailableException('Location search is temporarily unavailable');
    }
    const data = (await res.json()) as {
      status?: string;
      predictions?: Array<{
        place_id?: string;
        description?: string;
        structured_formatting?: { secondary_text?: string };
      }>;
    };
    if (data.status && !['OK', 'ZERO_RESULTS'].includes(data.status)) {
      throw new ServiceUnavailableException('Location search failed');
    }
    const out =
      data.predictions?.map((p) => ({
        id: String(p.place_id ?? ''),
        label: String(p.description ?? ''),
        secondaryText: p.structured_formatting?.secondary_text,
      }))?.filter((x) => x.id.length > 0 && x.label.length > 0) ?? [];

    this.setCached(this.autocompleteCache, key, out);
    return out;
  }

  async place(placeId: string): Promise<PlaceCoordinateResult> {
    const id = String(placeId ?? '').trim();
    if (!id) {
      throw new ServiceUnavailableException('Invalid place id');
    }
    const cached = this.getCached(this.placeCache, id);
    if (cached) return cached;
    this.ensureGoogleEnabled();

    const u = new URL('https://maps.googleapis.com/maps/api/place/details/json');
    u.searchParams.set('place_id', id);
    u.searchParams.set('key', this.googleApiKey);
    u.searchParams.set('fields', 'place_id,name,formatted_address,geometry');

    const res = await fetch(u.toString(), { method: 'GET' });
    if (!res.ok) {
      throw new ServiceUnavailableException('Place lookup is temporarily unavailable');
    }
    const data = (await res.json()) as {
      status?: string;
      result?: {
        place_id?: string;
        name?: string;
        formatted_address?: string;
        geometry?: { location?: { lat?: number; lng?: number } };
      };
    };
    if (data.status !== 'OK' || !data.result?.geometry?.location) {
      throw new ServiceUnavailableException('Place lookup failed');
    }
    const lat = Number(data.result.geometry.location.lat);
    const lng = Number(data.result.geometry.location.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new ServiceUnavailableException('Place coordinates unavailable');
    }
    const out: PlaceCoordinateResult = {
      id: String(data.result.place_id ?? id),
      label: String(data.result.formatted_address ?? data.result.name ?? id),
      latitude: lat,
      longitude: lng,
    };
    this.setCached(this.placeCache, id, out);
    return out;
  }

  /**
   * Forward-geocode a free-text address (Sri Lanka–biased). Used when POS has an address
   * but no pin for distance-based delivery fees. Returns null if unavailable or unconfigured.
   */
  async geocodeAddressLine(address: string): Promise<{ latitude: number; longitude: number } | null> {
    const q = String(address ?? '').trim();
    if (q.length < 3) return null;
    if (this.provider !== 'google' || !this.googleApiKey) return null;

    const key = q.toLowerCase();
    const cached = this.getCached(this.geocodeAddressCache, key);
    if (cached) return cached;

    const u = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    u.searchParams.set('address', q);
    u.searchParams.set('key', this.googleApiKey);
    u.searchParams.set('components', 'country:lk');

    const res = await fetch(u.toString(), { method: 'GET' });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      status?: string;
      results?: Array<{
        geometry?: { location?: { lat?: number; lng?: number } };
      }>;
    };
    if (data.status !== 'OK' || !Array.isArray(data.results) || data.results.length === 0) {
      return null;
    }
    const loc = data.results[0]?.geometry?.location;
    const lat = Number(loc?.lat);
    const lng = Number(loc?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const out = { latitude: lat, longitude: lng };
    this.setCached(this.geocodeAddressCache, key, out);
    return out;
  }

  async reverseGeocode(latitude: number, longitude: number): Promise<ReverseGeocodeResult> {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      throw new ServiceUnavailableException('Invalid coordinates for reverse geocode');
    }
    this.ensureGoogleEnabled();

    const u = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    u.searchParams.set('latlng', `${lat},${lng}`);
    u.searchParams.set('key', this.googleApiKey);

    const res = await fetch(u.toString(), { method: 'GET' });
    if (!res.ok) {
      throw new ServiceUnavailableException('Reverse geocoding is temporarily unavailable');
    }
    const data = (await res.json()) as {
      status?: string;
      results?: Array<{
        formatted_address?: string;
        address_components?: Array<{
          long_name?: string;
          short_name?: string;
          types?: string[];
        }>;
      }>;
    };
    if (data.status !== 'OK' || !Array.isArray(data.results) || data.results.length === 0) {
      throw new ServiceUnavailableException('Reverse geocoding failed');
    }
    const first = data.results[0];
    const comps = first.address_components ?? [];
    const read = (type: string): string | null => {
      const c = comps.find((x) => Array.isArray(x.types) && x.types.includes(type));
      return c?.long_name ? String(c.long_name) : null;
    };
    const route = read('route');
    const streetNo = read('street_number');
    const sublocality =
      read('sublocality_level_1') ?? read('sublocality') ?? read('neighborhood');
    const city =
      read('locality') ??
      read('administrative_area_level_2') ??
      read('administrative_area_level_1');
    const postalCode = read('postal_code');
    const country = read('country');
    const addressLine1 = [streetNo, route].filter(Boolean).join(' ').trim() || sublocality || city || String(first.formatted_address ?? '');
    return {
      formattedAddress: String(first.formatted_address ?? ''),
      addressLine1,
      city,
      postalCode,
      country,
    };
  }
}


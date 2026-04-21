import axios from 'axios';
import type {
  Customer,
  CustomerAddress,
  CustomerHistoryOrder,
  MenuItem,
  PublicBusinessSettings,
  SavedPaymentToken,
} from '@wrap-roll/contracts';
import { getApiBaseUrl } from '@/lib/env';
import { getSupabase } from '@/lib/supabase';

const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 12_000,
  headers: { 'Content-Type': 'application/json' },
});

async function getAccessTokenSafely(): Promise<string | undefined> {
  const supabase = getSupabase();
  if (!supabase) return undefined;
  const timeoutMs = 2500;
  try {
    const raced = await Promise.race([
      supabase.auth.getSession(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
    if (!raced) return undefined;
    return raced.data.session?.access_token;
  } catch {
    return undefined;
  }
}

api.interceptors.request.use(async (config) => {
  const token = await getAccessTokenSafely();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const MenuService = {
  getMenu: async (params?: {
    search?: string;
    category?: string;
    categoryId?: string;
    sort?: 'price' | 'newest';
    page?: number;
    limit?: number;
  }): Promise<{
    items: MenuItem[];
    meta: {
      total: number;
      page: number;
      limit: number;
      lastPage: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  }> => {
    const { data } = await api.get('/menu', { params });
    return data;
  },
  getMenuItem: async (id: string): Promise<MenuItem> => {
    const { data } = await api.get(`/menu/${id}`);
    return data;
  },
  getMenuCategories: async (): Promise<Array<{ id: string; name: string; slug: string }>> => {
    const { data } = await api.get('/menu/categories');
    return data;
  },
  getMenuItemInfo: async (
    id: string,
  ): Promise<{
    itemId: string;
    name: string;
    categoryName: string;
    prepTimeMinutes: number;
    categoryAveragePrepTimeMinutes: number;
    ingredientHighlights: string[];
    healthTips: string[];
    nutritionTags: Array<{ key: string; label: string }>;
  }> => {
    const { data } = await api.get(`/menu/${id}/info`);
    return data;
  },
};

export const SettingsApiService = {
  getPublic: async (): Promise<PublicBusinessSettings> => {
    const { data } = await api.get('/settings');
    return data;
  },
};

export type LocationAutocompleteItem = {
  id: string;
  label: string;
  secondaryText?: string;
};

export const LocationApiService = {
  autocomplete: async (q: string): Promise<LocationAutocompleteItem[]> => {
    const { data } = await api.get('/location/autocomplete', { params: { q } });
    return Array.isArray(data?.items) ? (data.items as LocationAutocompleteItem[]) : [];
  },
  place: async (
    id: string,
  ): Promise<{
    id: string;
    label: string;
    latitude: number;
    longitude: number;
  }> => {
    const { data } = await api.get(`/location/place/${encodeURIComponent(id)}`);
    return data;
  },
  reverseGeocode: async (
    lat: number,
    lng: number,
  ): Promise<{
    formattedAddress: string;
    addressLine1: string;
    city: string | null;
    postalCode: string | null;
    country: string | null;
  }> => {
    const { data } = await api.get('/location/reverse-geocode', {
      params: { lat, lng },
    });
    return data;
  },
};

export const CouponApiService = {
  validate: async (body: {
    code: string;
    subtotal: number;
    customerPhone?: string;
  }): Promise<{ valid: boolean; discountAmount?: number; message?: string }> => {
    const { data } = await api.post('/coupon/validate', body);
    return data;
  },
};

export const OrderService = {
  createOrder: async (
    orderData: unknown,
  ): Promise<{ orderId?: string; id?: string; total?: number; pricing?: { total?: number } } & Record<string, unknown>> => {
    const { data } = await api.post('/orders', orderData);
    return data;
  },
  trackOrder: async (
    orderId: string,
    phone: string,
  ): Promise<{
    id: string;
    status: string;
    paymentStatus: string;
    paymentMethod: string;
    paymentCollection?: string | null;
    fulfillmentType: string;
    deliveryAddress?: string | null;
    deliveryLatitude?: number | string | null;
    deliveryLongitude?: number | string | null;
    deliveryDistanceKm?: number | string | null;
    deliveryGeoSource?: string | null;
    deliveryFee?: number | string | null;
    estimatedReadyTime?: string | null;
    customerName: string;
    itemCount: number;
    total: number;
    placedAt: string;
    updatedAt: string;
  }> => {
    const { data } = await api.get(`/orders/track/${orderId}`, {
      params: { phone },
    });
    return data;
  },
};

export const CustomerApiService = {
  getProfile: async (): Promise<
    Pick<Customer, 'id' | 'email' | 'name' | 'phone'> & { orders?: unknown[] }
  > => {
    const { data } = await api.get('/customer/profile');
    return data;
  },

  getHistory: async (): Promise<CustomerHistoryOrder[]> => {
    const { data } = await api.get('/customer/history');
    return Array.isArray(data) ? data : [];
  },

  updateProfile: async (payload: { name?: string; phone?: string }) => {
    const { data } = await api.put('/customer/profile', payload);
    return data as Pick<Customer, 'id' | 'email' | 'name' | 'phone'>;
  },

  sync: async (): Promise<Pick<Customer, 'id' | 'email' | 'name' | 'phone'>> => {
    const { data } = await api.post('/customer/sync');
    return data;
  },

  getAddressBook: async (): Promise<CustomerAddress[]> => {
    const { data } = await api.get('/customer/address-book');
    return data;
  },

  saveAddress: async (payload: CustomerAddress): Promise<CustomerAddress> => {
    const { data } = await api.put('/customer/address', payload);
    return data;
  },

  getSavedCards: async (): Promise<SavedPaymentToken[]> => {
    const { data } = await api.get('/customer/saved-cards');
    return data;
  },

  saveCard: async (payload: SavedPaymentToken): Promise<SavedPaymentToken> => {
    const { data } = await api.put('/customer/card', payload);
    return data;
  },
};

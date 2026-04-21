import { create } from 'zustand';
import { toast } from 'sonner';
import api from '../lib/api';
import type {
  CourierQueueOrder,
  DeliveryPaymentCollectionMethod,
  MarkPaymentReceivedPayload,
  OrderStatus,
} from '@wrap-roll/contracts';

export interface DeliveryOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerAddress: string;
  deliveryLatitude?: number | null;
  deliveryLongitude?: number | null;
  deliveryDistanceKm?: number | null;
  deliveryGeoSource?: string | null;
  deliveryFee?: number;
  customerPhone: string;
  status: DeliveryOrderStatus;
  items_count: number;
  total_amount: number;
  paymentMethod?: CourierQueueOrder['paymentMethod'];
  paymentStatus?: CourierQueueOrder['paymentStatus'];
}

type DeliveryOrderStatus = Extract<OrderStatus, 'ready' | 'in_transit' | 'delivered' | 'cancelled'>;
const DELIVERY_STATUSES: DeliveryOrderStatus[] = ['ready', 'in_transit', 'delivered', 'cancelled'];

function toDeliveryStatus(v: unknown): DeliveryOrderStatus | null {
  const s = String(v ?? '');
  return DELIVERY_STATUSES.includes(s as DeliveryOrderStatus)
    ? (s as DeliveryOrderStatus)
    : null;
}

export type CourierStatus = 'Active' | 'Idle';

interface DeliveryState {
  readyOrders: DeliveryOrder[];
  transitOrders: DeliveryOrder[];
  courierStatus: CourierStatus;
  courierId: string | null;
  /** Supabase auth user id (JWT sub) — matches Order.courierId when courier self-assigns with sub. */
  authSub: string | null;
  /** From session role (e.g. ADMIN sees all in-transit; COURIER only their assignments). */
  staffRole: string | null;
  setCourierId: (id: string) => void;
  setAuthSub: (id: string | null) => void;
  setStaffRole: (role: string | null) => void;
  setCourierStatus: (status: CourierStatus) => void;
  fetchReadyOrders: () => Promise<void>;
  fetchMyTransitOrders: () => Promise<void>;
  assignOrder: (orderId: string) => Promise<void>;
  updateStatus: (orderId: string, status: DeliveryOrder['status']) => Promise<void>;
  collectCash: (orderId: string, note?: string) => Promise<void>;
  collectCard: (orderId: string, note?: string) => Promise<void>;
}

function paymentCollectionPayload(
  method: DeliveryPaymentCollectionMethod,
  note: string,
): MarkPaymentReceivedPayload {
  return { method, note };
}

function rawApiErrorMessage(error: unknown): string | null {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as { response?: { data?: { message?: unknown } } }).response?.data?.message ===
      'string'
  ) {
    return (error as { response: { data: { message: string } } }).response.data.message;
  }
  return null;
}

/** User-facing copy when the server rejects status changes (e.g. payment not recorded yet). */
function friendlyCourierStatusError(raw: string): string {
  if (/in_transit\s*->\s*delivered/i.test(raw) || /Invalid transition.*delivered/i.test(raw)) {
    return 'Collect cash or card first, then mark as delivered.';
  }
  return raw;
}

const mapQueueToDeliveryOrder = (o: CourierQueueOrder): DeliveryOrder | null => {
  const status = toDeliveryStatus(o.status);
  if (!status) return null;
  return {
    id: o.id,
    orderNumber: o.id.slice(0, 8).toUpperCase(),
    customerName: o.customer?.name || 'Guest',
    customerAddress: o.deliveryAddress || 'N/A',
    deliveryLatitude: o.deliveryLatitude == null ? null : Number(o.deliveryLatitude),
    deliveryLongitude: o.deliveryLongitude == null ? null : Number(o.deliveryLongitude),
    deliveryDistanceKm: o.deliveryDistanceKm == null ? null : Number(o.deliveryDistanceKm),
    deliveryGeoSource: o.deliveryGeoSource == null ? null : String(o.deliveryGeoSource),
    deliveryFee: o.deliveryFee == null ? undefined : Number(o.deliveryFee),
    customerPhone: o.customer?.phone || 'N/A',
    status,
    items_count: o.itemCount || 0,
    total_amount: Number(o.total),
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
  };
};

export const useDeliveryStore = create<DeliveryState>((set, get) => ({
  readyOrders: [],
  transitOrders: [],
  courierStatus: 'Idle',
  courierId: null,
  authSub: null,
  staffRole: null,
  setCourierId: (id) => set({ courierId: id }),
  setAuthSub: (id) => set({ authSub: id }),
  setStaffRole: (role) => set({ staffRole: role }),
  setCourierStatus: (status) => set({ courierStatus: status }),
  
  fetchReadyOrders: async () => {
    try {
      const response = await api.get('/orders/queue', {
        params: { status: 'ready', fulfillmentType: 'delivery', date: 'today' },
      });
      const queueOrders = (Array.isArray(response.data) ? response.data : []) as CourierQueueOrder[];
      const orders = queueOrders
        .filter((o) => o.status === 'ready')
        .map(mapQueueToDeliveryOrder)
        .filter((o): o is DeliveryOrder => Boolean(o));
      set({ readyOrders: orders });
    } catch (error) {
      console.error('Failed to fetch ready orders:', error);
    }
  },

  fetchMyTransitOrders: async () => {
    const { courierId, authSub, staffRole } = get();
    const isAdmin = staffRole === 'ADMIN';
    // COURIER needs at least one id to match Order.courierId (Prisma Courier PK or JWT sub).
    if (!isAdmin && !courierId && !authSub) return;
    try {
      const response = await api.get('/orders/queue', {
        params: { status: 'in_transit', fulfillmentType: 'delivery', date: 'today' },
      });
      const queueOrders = (Array.isArray(response.data) ? response.data : []) as CourierQueueOrder[];
      const mine = (o: CourierQueueOrder) => {
        if (o.status !== 'in_transit') return false;
        if (isAdmin) return true;
        const assigned = o.courierId != null && String(o.courierId).length > 0;
        if (!assigned) return false;
        const cid = String(o.courierId);
        return cid === String(courierId ?? '') || cid === String(authSub ?? '');
      };
      const myOrders = queueOrders
        .filter(mine)
        .map(mapQueueToDeliveryOrder)
        .filter((o): o is DeliveryOrder => Boolean(o));
      set({ transitOrders: myOrders });
    } catch (error) {
      console.error('Failed to fetch transit orders:', error);
    }
  },

  assignOrder: async (orderId: string) => {
    const { courierId } = get();
    if (!courierId) {
      alert('Must be logged in/active to assign orders');
      return;
    }
    try {
      await api.patch(`/orders/${orderId}/courier`, { courierId });
      get().fetchReadyOrders();
      get().fetchMyTransitOrders();
    } catch (error) {
      console.error('Failed to assign order:', error);
      const message = rawApiErrorMessage(error) ?? 'Assignment failed';
      alert(message);
    }
  },

  updateStatus: async (orderId: string, status: DeliveryOrder['status']) => {
    try {
      await api.patch(`/orders/${orderId}/status`, { status });
      set((state) => {
        if (status === 'delivered') {
          return {
            transitOrders: state.transitOrders.filter(o => o.id !== orderId)
          };
        }
        return state;
      });
      // Update data if still in lists
      get().fetchMyTransitOrders();
    } catch (error) {
      console.error('Failed to update status:', error);
      const raw = rawApiErrorMessage(error) ?? 'Could not update order status.';
      toast.error(friendlyCourierStatusError(raw));
    }
  },

  collectCash: async (orderId: string, note?: string) => {
    try {
      await api.patch(`/orders/${orderId}/mark-payment-received`, {
        ...paymentCollectionPayload('cash', note || 'Cash collected by courier at doorstep'),
      } satisfies MarkPaymentReceivedPayload);
      await get().fetchMyTransitOrders();
    } catch (error) {
      console.error('Failed to collect cash:', error);
      const raw = rawApiErrorMessage(error) ?? 'Could not record cash payment.';
      toast.error(raw);
    }
  },

  collectCard: async (orderId: string, note?: string) => {
    try {
      await api.patch(`/orders/${orderId}/mark-payment-received`, {
        ...paymentCollectionPayload('card', note || 'Card payment collected by courier at doorstep'),
      } satisfies MarkPaymentReceivedPayload);
      await get().fetchMyTransitOrders();
    } catch (error) {
      console.error('Failed to collect card payment:', error);
      const raw = rawApiErrorMessage(error) ?? 'Could not record card payment.';
      toast.error(raw);
    }
  },
}));

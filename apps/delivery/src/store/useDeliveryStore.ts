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
type PendingAction =
  | { kind: 'assign'; orderId: string; payload: { courierId: string } }
  | { kind: 'status'; orderId: string; payload: { status: DeliveryOrder['status'] } }
  | { kind: 'collect_cash'; orderId: string; payload: MarkPaymentReceivedPayload }
  | { kind: 'collect_card'; orderId: string; payload: MarkPaymentReceivedPayload }
  | { kind: 'delivery_attempt'; orderId: string; payload: { result: 'failed' | 'note'; reason?: string } }
  | { kind: 'handover'; orderId: string; payload: { nextCourierId?: string; reason?: string } };
const DELIVERY_PENDING_ACTIONS_KEY = 'delivery-pending-actions-v1';

function loadPendingActions(): PendingAction[] {
  try {
    const raw = localStorage.getItem(DELIVERY_PENDING_ACTIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as PendingAction[]) : [];
  } catch {
    return [];
  }
}

function savePendingActions(actions: PendingAction[]): void {
  try {
    localStorage.setItem(DELIVERY_PENDING_ACTIONS_KEY, JSON.stringify(actions));
  } catch {
    /* ignore */
  }
}

function looksOfflineError(error: unknown): boolean {
  const msg = String(rawApiErrorMessage(error) ?? (error as { message?: string })?.message ?? '').toLowerCase();
  return (
    msg.includes('network error') ||
    msg.includes('failed to fetch') ||
    msg.includes('timeout') ||
    msg.includes('offline')
  );
}

interface DeliveryState {
  readyOrders: DeliveryOrder[];
  transitOrders: DeliveryOrder[];
  deliveredOrders: DeliveryOrder[];
  pendingActionByOrder: Record<string, 'assigning' | 'collecting_cash' | 'collecting_card' | 'delivering'>;
  courierStatus: CourierStatus;
  courierId: string | null;
  /** Supabase auth user id (JWT sub) — matches Order.courierId when courier self-assigns with sub. */
  authSub: string | null;
  /** From session role (e.g. ADMIN sees all in-transit; COURIER only their assignments). */
  staffRole: string | null;
  pendingQueueCount: number;
  setCourierId: (id: string) => void;
  setAuthSub: (id: string | null) => void;
  setStaffRole: (role: string | null) => void;
  setCourierStatus: (status: CourierStatus) => void;
  fetchReadyOrders: () => Promise<void>;
  fetchMyTransitOrders: () => Promise<void>;
  fetchDeliveredOrders: () => Promise<void>;
  assignOrder: (orderId: string) => Promise<void>;
  updateStatus: (orderId: string, status: DeliveryOrder['status']) => Promise<void>;
  /** Pass `totalLkr` so receipt / recon can show tender (assumes exact change when collecting at door). */
  collectCash: (orderId: string, totalLkr?: number, note?: string) => Promise<void>;
  collectCard: (orderId: string, note?: string) => Promise<void>;
  reportDeliveryAttempt: (orderId: string, reason: string) => Promise<void>;
  handoverDelivery: (orderId: string, nextCourierId?: string, reason?: string) => Promise<void>;
  flushPendingActions: () => Promise<void>;
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
    return 'Collect cash or card (terminal) first, then mark as delivered.';
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
  deliveredOrders: [],
  pendingActionByOrder: {},
  courierStatus: 'Idle',
  courierId: null,
  authSub: null,
  staffRole: null,
  pendingQueueCount: 0,
  setCourierId: (id) => set({ courierId: id }),
  setAuthSub: (id) => set({ authSub: id }),
  setStaffRole: (role) => set({ staffRole: role }),
  setCourierStatus: (status) => set({ courierStatus: status }),
  
  fetchReadyOrders: async () => {
    try {
      set({ pendingQueueCount: loadPendingActions().length });
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

  fetchDeliveredOrders: async () => {
    const { courierId, authSub, staffRole } = get();
    const isAdmin = staffRole === 'ADMIN';
    if (!isAdmin && !courierId && !authSub) return;
    try {
      const response = await api.get('/orders/queue', {
        params: { status: 'delivered', fulfillmentType: 'delivery', date: 'today' },
      });
      const queueOrders = (Array.isArray(response.data) ? response.data : []) as CourierQueueOrder[];
      const mine = (o: CourierQueueOrder) => {
        if (o.status !== 'delivered') return false;
        if (isAdmin) return true;
        const assigned = o.courierId != null && String(o.courierId).length > 0;
        if (!assigned) return false;
        const cid = String(o.courierId);
        return cid === String(courierId ?? '') || cid === String(authSub ?? '');
      };
      const delivered = queueOrders
        .filter(mine)
        .map(mapQueueToDeliveryOrder)
        .filter((o): o is DeliveryOrder => Boolean(o));
      set({ deliveredOrders: delivered });
    } catch (error) {
      console.error('Failed to fetch delivered orders:', error);
    }
  },

  assignOrder: async (orderId: string) => {
    const { courierId } = get();
    if (!courierId) {
      alert('Must be logged in/active to assign orders');
      return;
    }
    if (get().pendingActionByOrder[orderId]) return;
    set((state) => ({
      pendingActionByOrder: {
        ...state.pendingActionByOrder,
        [orderId]: 'assigning',
      },
    }));
    try {
      await api.patch(`/orders/${orderId}/courier`, { courierId });
      get().fetchReadyOrders();
      get().fetchMyTransitOrders();
      toast.success('Order assigned');
    } catch (error) {
      console.error('Failed to assign order:', error);
      if (looksOfflineError(error)) {
        const queue = loadPendingActions();
        queue.push({ kind: 'assign', orderId, payload: { courierId } });
        savePendingActions(queue);
        set({ pendingQueueCount: queue.length });
        toast.message('Offline: assignment queued for sync');
        return;
      }
      const message = rawApiErrorMessage(error) ?? 'Assignment failed';
      alert(message);
    } finally {
      set((state) => ({
        pendingActionByOrder: Object.fromEntries(
          Object.entries(state.pendingActionByOrder).filter(([id]) => id !== orderId),
        ),
      }));
    }
  },

  updateStatus: async (orderId: string, status: DeliveryOrder['status']) => {
    if (get().pendingActionByOrder[orderId]) return;
    set((state) => ({
      pendingActionByOrder: {
        ...state.pendingActionByOrder,
        [orderId]: 'delivering',
      },
    }));
    try {
      await api.patch(`/orders/${orderId}/status`, { status });
      set((state) => {
        if (status === 'delivered') {
          return {
            transitOrders: state.transitOrders.filter((o) => o.id !== orderId),
            deliveredOrders: state.deliveredOrders,
          };
        }
        return state;
      });
      // Update data if still in lists
      get().fetchMyTransitOrders();
      get().fetchDeliveredOrders();
      if (status === 'delivered') toast.success('Marked as delivered');
    } catch (error) {
      console.error('Failed to update status:', error);
      if (looksOfflineError(error)) {
        const queue = loadPendingActions();
        queue.push({ kind: 'status', orderId, payload: { status } });
        savePendingActions(queue);
        set({ pendingQueueCount: queue.length });
        toast.message('Offline: status update queued');
        return;
      }
      const raw = rawApiErrorMessage(error) ?? 'Could not update order status.';
      toast.error(friendlyCourierStatusError(raw));
    } finally {
      set((state) => ({
        pendingActionByOrder: Object.fromEntries(
          Object.entries(state.pendingActionByOrder).filter(([id]) => id !== orderId),
        ),
      }));
    }
  },

  collectCash: async (orderId: string, totalLkr?: number, note?: string) => {
    if (get().pendingActionByOrder[orderId]) return;
    set((state) => ({
      pendingActionByOrder: {
        ...state.pendingActionByOrder,
        [orderId]: 'collecting_cash',
      },
    }));
    try {
      const base = note?.trim() || 'Cash collected by courier at doorstep';
      const tenderNote =
        typeof totalLkr === 'number' && Number.isFinite(totalLkr) && totalLkr > 0
          ? `${base} · Tender Rs ${(Math.round(totalLkr * 100) / 100).toFixed(2)} · Change Rs 0.00`
          : base;
      await api.patch(`/orders/${orderId}/mark-payment-received`, {
        ...paymentCollectionPayload('cash', tenderNote),
      } satisfies MarkPaymentReceivedPayload);
      await get().fetchMyTransitOrders();
      toast.success('Cash payment recorded');
    } catch (error) {
      console.error('Failed to collect cash:', error);
      if (looksOfflineError(error)) {
        const queue = loadPendingActions();
        queue.push({
          kind: 'collect_cash',
          orderId,
          payload: paymentCollectionPayload('cash', tenderNote),
        });
        savePendingActions(queue);
        set({ pendingQueueCount: queue.length });
        toast.message('Offline: cash collection queued');
        return;
      }
      const raw = rawApiErrorMessage(error) ?? 'Could not record cash payment.';
      toast.error(raw);
    } finally {
      set((state) => ({
        pendingActionByOrder: Object.fromEntries(
          Object.entries(state.pendingActionByOrder).filter(([id]) => id !== orderId),
        ),
      }));
    }
  },

  collectCard: async (orderId: string, note?: string) => {
    if (get().pendingActionByOrder[orderId]) return;
    set((state) => ({
      pendingActionByOrder: {
        ...state.pendingActionByOrder,
        [orderId]: 'collecting_card',
      },
    }));
    try {
      const payload = paymentCollectionPayload(
        'card',
        note || 'Card payment collected by courier at doorstep',
      );
      await api.patch(`/orders/${orderId}/mark-payment-received`, {
        ...payload,
      } satisfies MarkPaymentReceivedPayload);
      await get().fetchMyTransitOrders();
      toast.success('Card payment recorded');
    } catch (error) {
      console.error('Failed to collect card payment:', error);
      if (looksOfflineError(error)) {
        const queue = loadPendingActions();
        queue.push({
          kind: 'collect_card',
          orderId,
          payload: paymentCollectionPayload(
            'card',
            note || 'Card payment collected by courier at doorstep',
          ),
        });
        savePendingActions(queue);
        set({ pendingQueueCount: queue.length });
        toast.message('Offline: card collection queued');
        return;
      }
      const raw = rawApiErrorMessage(error) ?? 'Could not record card terminal payment.';
      toast.error(raw);
    } finally {
      set((state) => ({
        pendingActionByOrder: Object.fromEntries(
          Object.entries(state.pendingActionByOrder).filter(([id]) => id !== orderId),
        ),
      }));
    }
  },

  reportDeliveryAttempt: async (orderId: string, reason: string) => {
    const payload = { result: 'failed' as const, reason };
    try {
      await api.patch(`/orders/${orderId}/delivery-attempt`, payload);
      toast.success('Retry reason logged');
    } catch (error) {
      if (looksOfflineError(error)) {
        const queue = loadPendingActions();
        queue.push({ kind: 'delivery_attempt', orderId, payload });
        savePendingActions(queue);
        set({ pendingQueueCount: queue.length });
        toast.message('Offline: retry reason queued');
        return;
      }
      const raw = rawApiErrorMessage(error) ?? 'Could not log delivery attempt';
      toast.error(raw);
    }
  },

  handoverDelivery: async (orderId: string, nextCourierId?: string, reason?: string) => {
    const payload = {
      ...(nextCourierId ? { nextCourierId } : {}),
      ...(reason ? { reason } : {}),
    };
    try {
      await api.patch(`/orders/${orderId}/handover`, payload);
      await get().fetchReadyOrders();
      await get().fetchMyTransitOrders();
      toast.success('Handover completed');
    } catch (error) {
      if (looksOfflineError(error)) {
        const queue = loadPendingActions();
        queue.push({ kind: 'handover', orderId, payload });
        savePendingActions(queue);
        set({ pendingQueueCount: queue.length });
        toast.message('Offline: handover queued');
        return;
      }
      const raw = rawApiErrorMessage(error) ?? 'Could not handover order';
      toast.error(raw);
    }
  },

  flushPendingActions: async () => {
    const queued = loadPendingActions();
    if (queued.length === 0) {
      set({ pendingQueueCount: 0 });
      return;
    }
    const remaining: PendingAction[] = [];
    for (const action of queued) {
      try {
        if (action.kind === 'assign') {
          await api.patch(`/orders/${action.orderId}/courier`, action.payload);
        } else if (action.kind === 'status') {
          await api.patch(`/orders/${action.orderId}/status`, action.payload);
        } else if (action.kind === 'collect_cash' || action.kind === 'collect_card') {
          await api.patch(`/orders/${action.orderId}/mark-payment-received`, action.payload);
        } else if (action.kind === 'delivery_attempt') {
          await api.patch(`/orders/${action.orderId}/delivery-attempt`, action.payload);
        } else if (action.kind === 'handover') {
          await api.patch(`/orders/${action.orderId}/handover`, action.payload);
        }
      } catch {
        remaining.push(action);
      }
    }
    savePendingActions(remaining);
    set({ pendingQueueCount: remaining.length });
    if (remaining.length === 0) toast.success('Queued offline actions synced');
    await get().fetchReadyOrders();
    await get().fetchMyTransitOrders();
    await get().fetchDeliveredOrders();
  },
}));

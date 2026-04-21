import { create } from 'zustand';
import type { KitchenQueueOrder, OrderStatus, QueueOrder } from '@wrap-roll/contracts';

/** KDS may receive slim kitchen rows or full ops rows when an admin uses the same UI. */
export type KdsQueueOrder = KitchenQueueOrder | QueueOrder;

interface KdsState {
  activeOrders: KdsQueueOrder[];
  setOrders: (orders: KdsQueueOrder[]) => void;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  removeOrder: (orderId: string) => void;
}

export const useKdsStore = create<KdsState>((set) => ({
  activeOrders: [],
  setOrders: (orders) => set({ activeOrders: orders }),
  updateOrderStatus: (orderId, status) =>
    set((state) => ({
      activeOrders:
        status === 'ready' || status === 'delivered'
          ? state.activeOrders.filter((o) => o.id !== orderId)
          : state.activeOrders.map((o) => (o.id === orderId ? { ...o, status } : o)),
    })),
  removeOrder: (orderId) =>
    set((state) => ({
      activeOrders: state.activeOrders.filter((o) => o.id !== orderId),
    })),
}));

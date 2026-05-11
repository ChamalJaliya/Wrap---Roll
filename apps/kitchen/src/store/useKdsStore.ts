import { create } from 'zustand';
import type { KitchenQueueOrder, OrderStatus, QueueOrder } from '@wrap-roll/contracts';
import { getOrderItemModifierDisplayLines } from '@wrap-roll/order-kit';

/** KDS may receive slim kitchen rows or full ops rows when an admin uses the same UI. */
export type KdsQueueOrder = KitchenQueueOrder | QueueOrder;

export type KdsOrderUpdateAlert = {
  orderId: string;
  updatedAtMs: number;
  summary: string;
  addedLines: string[];
  removedLines: string[];
  signature: string;
};

type ItemAgg = {
  name: string;
  variant: string;
  qty: number;
};

function stableJsonString(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => stableJsonString(v)).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort((a, b) => a.localeCompare(b));
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableJsonString(obj[k])}`).join(',')}}`;
}

function summarizeVariant(variant: string): string {
  return variant === 'Standard build' ? '' : ` (${variant})`;
}

function buildItemAggregate(order: KdsQueueOrder): Map<string, ItemAgg> {
  const map = new Map<string, ItemAgg>();
  for (const item of order.items ?? []) {
    const lines = getOrderItemModifierDisplayLines(item.modifiersJson);
    const variant =
      lines.length > 0
        ? lines.map((line) => `${line.label}: ${line.value}`).join(' | ')
        : 'Standard build';
    const modifierFingerprint = stableJsonString(item.modifiersJson ?? null);
    const key = `${item.name}__${modifierFingerprint}`;
    const existing = map.get(key);
    if (existing) {
      existing.qty += Number(item.quantity ?? 0);
    } else {
      map.set(key, {
        name: item.name,
        variant,
        qty: Number(item.quantity ?? 0),
      });
    }
  }
  return map;
}

function mapSignature(map: Map<string, ItemAgg>): string {
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}:${value.qty}`)
    .join('||');
}

function diffInKitchenOrderItems(
  prev: KdsQueueOrder,
  next: KdsQueueOrder,
): Omit<KdsOrderUpdateAlert, 'orderId' | 'updatedAtMs'> | null {
  const prevMap = buildItemAggregate(prev);
  const nextMap = buildItemAggregate(next);
  const prevSig = mapSignature(prevMap);
  const nextSig = mapSignature(nextMap);
  if (prevSig === nextSig) return null;

  const allKeys = new Set([...prevMap.keys(), ...nextMap.keys()]);
  const addedLines: string[] = [];
  const removedLines: string[] = [];
  for (const key of allKeys) {
    const before = prevMap.get(key)?.qty ?? 0;
    const after = nextMap.get(key)?.qty ?? 0;
    const delta = after - before;
    const row = nextMap.get(key) ?? prevMap.get(key);
    if (!row || delta === 0) continue;
    const label = `${row.name}${summarizeVariant(row.variant)}`;
    if (delta > 0) addedLines.push(`+${delta}x ${label}`);
    else removedLines.push(`${delta}x ${label}`);
  }
  const summary = `${addedLines.length} added, ${removedLines.length} removed`;
  return {
    summary,
    addedLines: addedLines.slice(0, 4),
    removedLines: removedLines.slice(0, 4),
    signature: nextSig,
  };
}

interface KdsState {
  activeOrders: KdsQueueOrder[];
  orderUpdateAlerts: Record<string, KdsOrderUpdateAlert>;
  setOrders: (orders: KdsQueueOrder[]) => void;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  acknowledgeOrderUpdate: (orderId: string) => void;
  removeOrder: (orderId: string) => void;
}

export const useKdsStore = create<KdsState>((set) => ({
  activeOrders: [],
  orderUpdateAlerts: {},
  setOrders: (orders) =>
    set((state) => {
      const prevById = new Map(state.activeOrders.map((o) => [o.id, o]));
      const nextIds = new Set(orders.map((o) => o.id));
      const nextAlerts: Record<string, KdsOrderUpdateAlert> = {};

      for (const [orderId, alert] of Object.entries(state.orderUpdateAlerts)) {
        if (nextIds.has(orderId)) nextAlerts[orderId] = alert;
      }

      for (const nextOrder of orders) {
        const prevOrder = prevById.get(nextOrder.id);
        if (!prevOrder) continue;
        if (nextOrder.status !== 'in_kitchen') continue;
        const diff = diffInKitchenOrderItems(prevOrder, nextOrder);
        if (!diff) continue;
        const existing = nextAlerts[nextOrder.id];
        if (existing && existing.signature === diff.signature) continue;
        nextAlerts[nextOrder.id] = {
          orderId: nextOrder.id,
          updatedAtMs: Date.now(),
          summary: diff.summary,
          addedLines: diff.addedLines,
          removedLines: diff.removedLines,
          signature: diff.signature,
        };
      }

      return { activeOrders: orders, orderUpdateAlerts: nextAlerts };
    }),
  updateOrderStatus: (orderId, status) =>
    set((state) => ({
      activeOrders:
        status === 'ready' || status === 'delivered'
          ? state.activeOrders.filter((o) => o.id !== orderId)
          : state.activeOrders.map((o) => (o.id === orderId ? { ...o, status } : o)),
      orderUpdateAlerts:
        status === 'ready' || status === 'delivered'
          ? Object.fromEntries(
              Object.entries(state.orderUpdateAlerts).filter(([id]) => id !== orderId),
            )
          : state.orderUpdateAlerts,
    })),
  acknowledgeOrderUpdate: (orderId) =>
    set((state) => ({
      orderUpdateAlerts: Object.fromEntries(
        Object.entries(state.orderUpdateAlerts).filter(([id]) => id !== orderId),
      ),
    })),
  removeOrder: (orderId) =>
    set((state) => ({
      activeOrders: state.activeOrders.filter((o) => o.id !== orderId),
      orderUpdateAlerts: Object.fromEntries(
        Object.entries(state.orderUpdateAlerts).filter(([id]) => id !== orderId),
      ),
    })),
}));

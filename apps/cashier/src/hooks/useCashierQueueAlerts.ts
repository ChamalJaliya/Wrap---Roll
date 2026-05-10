import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type { OpsQueueOrder, QueueOrderStatus } from '@wrap-roll/contracts';
import { playPosQueueAlertChime } from '../lib/pos-queue-alert-chime';

type Snapshot = {
  status: QueueOrderStatus;
  paymentStatus: string;
};

function shortId(id: string): string {
  return String(id).slice(0, 8).toUpperCase();
}

function isPayOnDelivery(order: OpsQueueOrder): boolean {
  const pc = String(order.paymentCollection ?? '').toLowerCase();
  const ft = String(order.fulfillmentType ?? '').toLowerCase();
  return ft === 'delivery' && pc === 'on_delivery';
}

function readyToastTitle(order: OpsQueueOrder): string {
  const ft = String(order.fulfillmentType ?? '').toLowerCase();
  if (ft === 'dine_in') {
    const table = order.tableNumber?.trim();
    return table ? `Ready — bring to table ${table}` : 'Ready — bring to dine-in guest';
  }
  if (ft === 'takeaway') return 'Ready — pickup at counter';
  if (ft === 'delivery') return 'Ready — pack / dispatch';
  return 'Order ready';
}

function soundPref(): boolean {
  try {
    return window.localStorage.getItem('cashier-queue-alert-sound') !== '0';
  } catch {
    return true;
  }
}

const DEDUPE_MS = 2200;

export type UseCashierQueueAlertsOptions = {
  orders: OpsQueueOrder[];
  /** Typically signed-in cashier with queue loaded */
  enabled: boolean;
  /** Reset baseline when queue date / scope changes */
  scopeKey: string;
  /** When set, controls alert chimes (toasts always show). Falls back to localStorage `cashier-queue-alert-sound`. */
  alertSoundEnabled?: boolean;
};

/**
 * Surfaces actionable queue transitions for counter staff (handoff + payment).
 * Seeds silently on first snapshot; resets when `scopeKey` changes.
 */
export function useCashierQueueAlerts({
  orders,
  enabled,
  scopeKey,
  alertSoundEnabled,
}: UseCashierQueueAlertsOptions): void {
  const prevRef = useRef<Map<string, Snapshot>>(new Map());
  const seededRef = useRef(false);
  const scopeRef = useRef(scopeKey);
  const dedupeRef = useRef<Map<string, number>>(new Map());

  const shouldDedupe = (key: string): boolean => {
    const now = Date.now();
    const last = dedupeRef.current.get(key) ?? 0;
    if (now - last < DEDUPE_MS) return true;
    dedupeRef.current.set(key, now);
    return false;
  };

  useEffect(() => {
    if (scopeRef.current !== scopeKey) {
      scopeRef.current = scopeKey;
      seededRef.current = false;
      prevRef.current = new Map();
      dedupeRef.current.clear();
    }
  }, [scopeKey]);

  useEffect(() => {
    if (!enabled) {
      seededRef.current = false;
      prevRef.current = new Map();
      return;
    }

    const next = new Map<string, Snapshot>();
    for (const o of orders) {
      next.set(o.id, {
        status: o.status,
        paymentStatus: String(o.paymentStatus ?? ''),
      });
    }

    if (!seededRef.current) {
      seededRef.current = true;
      prevRef.current = next;
      return;
    }

    const prev = prevRef.current;
    const soundOn =
      alertSoundEnabled !== undefined ? alertSoundEnabled : soundPref();

    for (const [id, cur] of next) {
      const was = prev.get(id);
      const order = orders.find((x) => x.id === id);
      if (!order) continue;

      if (!was) {
        if (order.status === 'ready') {
          if (shouldDedupe(`ready:${id}`)) continue;
          toast.success(readyToastTitle(order), {
            description: `#${shortId(id)} · ${order.customer?.name?.trim() || 'Guest'}`,
            duration: 8500,
          });
          if (soundOn) void playPosQueueAlertChime('ready');
        } else {
          if (shouldDedupe(`new:${id}`)) continue;
          toast.info(`New ticket · #${shortId(id)}`, {
            description: `${String(order.fulfillmentType ?? 'order').replace(/_/g, ' ')} · ${order.status.replace(/_/g, ' ')}`,
            duration: 5000,
          });
          if (soundOn) void playPosQueueAlertChime('ping');
        }
        continue;
      }

      const statusChanged = was.status !== cur.status;
      const paymentChanged = was.paymentStatus !== cur.paymentStatus;

      if (statusChanged && cur.status === 'ready') {
        const dk = `ready:${id}`;
        if (shouldDedupe(dk)) continue;
        toast.success(readyToastTitle(order), {
          description: `#${shortId(id)} · ${order.customer?.name?.trim() || 'Guest'}`,
          duration: 8500,
        });
        if (soundOn) void playPosQueueAlertChime('ready');
        continue;
      }

      if (paymentChanged && cur.paymentStatus === 'failed') {
        if (shouldDedupe(`fail:${id}`)) continue;
        toast.error(`Payment failed · #${shortId(id)}`, {
          description: 'Resolve with the customer or retry collection.',
          duration: 10_000,
        });
        if (soundOn) void playPosQueueAlertChime('attention');
        continue;
      }

      if (
        statusChanged &&
        cur.status === 'delivered' &&
        cur.paymentStatus !== 'completed' &&
        !isPayOnDelivery(order)
      ) {
        if (shouldDedupe(`collect:${id}`)) continue;
        toast.warning(`Collect payment · #${shortId(id)}`, {
          description: 'Delivered — payment still open.',
          duration: 9000,
        });
        if (soundOn) void playPosQueueAlertChime('attention');
      }
    }

    prevRef.current = next;
  }, [orders, enabled, alertSoundEnabled]);
}

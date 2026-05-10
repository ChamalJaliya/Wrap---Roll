import { openDB, IDBPDatabase } from 'idb';
import type { CashierOrderSyncPayload } from '@wrap-roll/contracts';

const DB_NAME = 'cashier-pos-db';
const STORE_NAME = 'order-sync-queue';
const DB_VERSION = 1;

export interface OfflineOrder {
  id: string; // Internal temporary ID
  orderData: CashierOrderSyncPayload;
  timestamp: number;
}

let syncInFlight: Promise<void> | null = null;
let syncRerunRequested = false;

export const initSyncDB = async (): Promise<IDBPDatabase> => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    },
  });
};

function truncateForLog(s: string, max = 400): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function parseSyncErrorMessage(raw: string): string {
  try {
    const o = JSON.parse(raw) as { message?: unknown };
    const m = o?.message;
    if (typeof m === 'string') return m;
    if (Array.isArray(m)) return m.map(String).join(' ');
  } catch {
    /* keep raw */
  }
  return raw.length > 600 ? `${raw.slice(0, 600)}…` : raw;
}

/** 400s that will never succeed on retry with the same payload — drop the queue row and keep syncing others. */
function isUnrecoverableCashierSyncFailure(status: number, message: string): boolean {
  const lower = message.toLowerCase();
  if (status === 403) {
    return (
      lower.includes('supervisor') ||
      lower.includes('elevation') ||
      lower.includes('privileged') ||
      lower.includes('step-up')
    );
  }
  if (status !== 400) return false;
  return (
    lower.includes('no longer available') ||
    lower.includes('refresh menu') ||
    lower.includes('menu product id') ||
    lower.includes('invalid order payload') ||
    lower.includes('invalid cashier order') ||
    lower.includes('zod') ||
    lower.includes('unsupported order source') ||
    lower.includes('coupon error') ||
    lower.includes('supervisor') ||
    lower.includes('elevation') ||
    lower.includes('privileged')
  );
}

/** Persists full POS payload (including `paymentCollection`: immediate | on_pickup | on_delivery | at_collection) and POSTs it to `/api/orders` unchanged when online. */
export const queueOrder = async (
  orderData: CashierOrderSyncPayload,
  /** When set (e.g. current checkout), must match `pendingPlacementQueueIds` for UI finalize. */
  fixedId?: string,
): Promise<string> => {
  const db = await initSyncDB();
  const order: OfflineOrder = {
    id:
      fixedId?.trim() ||
      `off_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    orderData,
    timestamp: Date.now(),
  };
  await db.put(STORE_NAME, order);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('cashier-order-queued', {
        detail: {
          localId: order.id,
          offline: typeof navigator !== 'undefined' && !navigator.onLine,
        },
      }),
    );
  }
  
  // Try to sync if online
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    await syncOrders();
  }
  return order.id;
};

async function runSyncOnce() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return;
  }

  const db = await initSyncDB();
  const queuedOrders = await db.getAll(STORE_NAME);

  if (queuedOrders.length === 0) {
    return;
  }

  for (const order of queuedOrders) {
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': `cashier-sync-${order.id}`,
        },
        body: JSON.stringify(order.orderData),
      });

      if (response.ok) {
        const responseText = await response.text();
        let orderBody: unknown = null;
        try {
          orderBody = responseText ? JSON.parse(responseText) : null;
        } catch {
          orderBody = null;
        }
        await db.delete(STORE_NAME, order.id);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('cashier-order-synced', {
              detail: { localId: order.id, order: orderBody },
            }),
          );
        }
      } else if (response.status === 409) {
        const body = (await response.json().catch(() => null)) as {
          duplicateOf?: string;
          message?: string;
        } | null;
        console.warn(`Sync: Duplicate order rejected (${order.id})`);
        await db.delete(STORE_NAME, order.id);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('cashier-order-duplicate', {
              detail: { duplicateOf: body?.duplicateOf, localId: order.id },
            }),
          );
        }
      } else {
        const raw = await response.text();
        const reason = parseSyncErrorMessage(raw);
        if (
          typeof window !== 'undefined' &&
          isUnrecoverableCashierSyncFailure(response.status, reason)
        ) {
          console.warn(`Sync: Dropping unrecoverable queued order ${order.id}:`, truncateForLog(reason));
          await db.delete(STORE_NAME, order.id);
          window.dispatchEvent(
            new CustomEvent('cashier-order-sync-dropped', {
              detail: { localId: order.id, status: response.status, reason },
            }),
          );
          continue;
        }
        console.error(`Sync: Failed to sync order ${order.id}:`, truncateForLog(raw));
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('cashier-order-sync-failed', {
              detail: { localId: order.id, status: response.status, reason },
            }),
          );
        }
        break;
      }
    } catch (error) {
      console.error(
        `Sync: Network error syncing order ${order.id}:`,
        error instanceof Error ? error.message : error,
      );
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('cashier-order-sync-failed', {
            detail: {
              localId: order.id,
              status: 0,
              reason: error instanceof Error ? error.message : 'Network error while syncing order',
            },
          }),
        );
      }
      break;
    }
  }
}

export const syncOrders = async () => {
  if (syncInFlight) {
    syncRerunRequested = true;
    return syncInFlight;
  }
  syncInFlight = (async () => {
    do {
      syncRerunRequested = false;
      await runSyncOnce();
    } while (syncRerunRequested);
  })();
  try {
    await syncInFlight;
  } finally {
    syncInFlight = null;
  }
};

export const clearQueuedOrders = async () => {
  const db = await initSyncDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  await tx.objectStore(STORE_NAME).clear();
  await tx.done;
};

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

export const queueOrder = async (orderData: CashierOrderSyncPayload) => {
  const db = await initSyncDB();
  const order: OfflineOrder = {
    id: `off_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    orderData,
    timestamp: Date.now(),
  };
  await db.put(STORE_NAME, order);
  console.log('Order queued in IndexedDB:', order.id);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('cashier-order-queued', {
        detail: { localId: order.id },
      }),
    );
  }
  
  // Try to sync if online
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    await syncOrders();
  }
};

async function runSyncOnce() {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    console.log('Sync postponed: Offline');
    return;
  }

  const db = await initSyncDB();
  const queuedOrders = await db.getAll(STORE_NAME);

  if (queuedOrders.length === 0) {
    console.log('Sync: No orders to sync');
    return;
  }

  console.log(`Sync: Processing ${queuedOrders.length} orders...`);

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
        console.log(`Sync: Order ${order.id} synced successfully`);
        await db.delete(STORE_NAME, order.id);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('cashier-order-synced', {
              detail: { localId: order.id },
            }),
          );
        }
      } else if (response.status === 409) {
        const body = (await response.json().catch(() => null)) as {
          duplicateOf?: string;
          message?: string;
        } | null;
        console.warn(`Sync: Duplicate order rejected (${order.id}):`, body);
        await db.delete(STORE_NAME, order.id);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('cashier-order-duplicate', {
              detail: { duplicateOf: body?.duplicateOf },
            }),
          );
        }
      } else {
        const raw = await response.text();
        console.error(`Sync: Failed to sync order ${order.id}:`, raw);
        if (typeof window !== 'undefined') {
          let reason = raw;
          try {
            const body = JSON.parse(raw) as { message?: string; detail?: string };
            reason = String(body?.message ?? body?.detail ?? raw);
          } catch {
            /* keep raw text */
          }
          window.dispatchEvent(
            new CustomEvent('cashier-order-sync-failed', {
              detail: { localId: order.id, status: response.status, reason },
            }),
          );
        }
        // We stop sync for now on first failure to prevent flood or ordering issues
        break;
      }
    } catch (error) {
      console.error(`Sync: Network error syncing order ${order.id}:`, error);
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

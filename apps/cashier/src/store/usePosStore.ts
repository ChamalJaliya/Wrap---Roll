import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  CashierOrderLineInput,
  CashierPaymentCollection,
  CashierOrderSource,
  CashierOrderSyncPayload,
  CashierPaymentMethod,
} from '@wrap-roll/contracts';
import { normalizeOptionalPositiveMoney } from '@wrap-roll/order-kit';
import { pendingPlacementQueueIds } from '../lib/checkout-placement';
import { queueOrder } from '../lib/sync-queue';

export interface CartItem extends CashierOrderLineInput {
  cartId: string;
}

/** Same fingerprint used for merge-on-add and consolidate-after-update (price rounded to cents). */
function cartLineMergeKey(item: Pick<CartItem, 'id' | 'unitPrice' | 'notes' | 'selectedOptions'>): string {
  const optionsKey = JSON.stringify(
    [...(item.selectedOptions ?? [])].sort((a, b) =>
      `${a.groupName}:${a.label}:${a.priceAdjust}`.localeCompare(
        `${b.groupName}:${b.label}:${b.priceAdjust}`,
      ),
    ),
  );
  const notesKey = (item.notes ?? '').trim();
  const priceKey = Number(item.unitPrice).toFixed(2);
  return `${String(item.id)}|${priceKey}|${notesKey}|${optionsKey}`;
}

/** Merge rows that represent the same product + modifiers + notes + unit price (first row keeps its cartId). */
function consolidateCartLines(cart: CartItem[]): CartItem[] {
  const result: CartItem[] = [];
  const keyToIndex = new Map<string, number>();
  for (const item of cart) {
    const key = cartLineMergeKey(item);
    const idx = keyToIndex.get(key);
    if (idx !== undefined) {
      const cur = result[idx];
      result[idx] = {
        ...cur,
        quantity: cur.quantity + item.quantity,
      };
    } else {
      keyToIndex.set(key, result.length);
      result.push({ ...item });
    }
  }
  return result;
}

interface PosState {
  cart: CartItem[];
  addItem: (item: Omit<CartItem, 'cartId'>) => void;
  /** Replace cart for order line amendment (assigns new cartIds). */
  loadCartForAmend: (lines: Omit<CartItem, 'cartId'>[]) => void;
  /** Change modifiers / notes / unit price on an existing cart row (same cartId & quantity). */
  updateCartLine: (
    cartId: string,
    patch: Partial<Pick<CartItem, 'unitPrice' | 'selectedOptions' | 'notes' | 'name' | 'id'>>,
  ) => void;
  incrementItem: (cartId: string) => void;
  decrementItem: (cartId: string) => void;
  removeItem: (cartId: string) => void;
  pay: (
    paymentMethod: CashierPaymentMethod,
    customer?: { name?: string; phone?: string },
    orderContext?: {
      fulfillmentType?: 'takeaway' | 'dine_in' | 'delivery';
      paymentCollection?: CashierPaymentCollection;
      tableNumber?: string;
      deliveryAddress?: string;
      orderSource?: CashierOrderSource;
      discountCode?: string;
      /**
       * Manual discount + elevation token must be computed once at checkout (same `getState()`
       * snapshot as the sidebar preview). Do not re-infer here — a second pass can disagree with UI.
       */
      manualDiscountAmount?: number;
      supervisorElevationToken?: string;
      /** Till audit for immediate cash (Pay now); stored on server payment event. */
      cashTenderAuditNote?: string;
    },
  ) => void;
  clearCart: () => void;
}

export const usePosStore = create<PosState>()(
  persist(
    (set, get) => ({
      cart: [],
      loadCartForAmend: (lines) =>
        set(() => ({
          cart: consolidateCartLines(
            lines.map((item, idx) => ({
              ...item,
              cartId: `cart_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 9)}`,
            })),
          ),
        })),
      updateCartLine: (cartId, patch) =>
        set((state) => {
          const cart = state.cart.map((item) =>
            item.cartId === cartId ? { ...item, ...patch } : item,
          );
          return { cart: consolidateCartLines(cart) };
        }),
      addItem: (item) =>
        set((state) => ({
          cart: consolidateCartLines([
            ...state.cart,
            {
              ...item,
              quantity: Math.max(1, item.quantity),
              cartId: `cart_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            },
          ]),
        })),
      incrementItem: (cartId) =>
        set((state) => ({
          cart: state.cart.map((item) =>
            item.cartId === cartId ? { ...item, quantity: item.quantity + 1 } : item,
          ),
        })),
      decrementItem: (cartId) =>
        set((state) => ({
          cart: state.cart
            .map((item) =>
              item.cartId === cartId
                ? { ...item, quantity: Math.max(0, item.quantity - 1) }
                : item,
            )
            .filter((item) => item.quantity > 0),
        })),
      removeItem: (cartId) =>
        set((state) => ({
          cart: state.cart.filter((item) => item.cartId !== cartId),
        })),
      /**
       * Does not clear the cart — enqueue only. Cart + totals stay visible until
       * `cashier-order-synced` (online) or `cashier-order-queued` with `offline: true` clears UI.
       */
      pay: (paymentMethod, customer, orderContext) => {
        const state = get();
        const manualAmt = normalizeOptionalPositiveMoney(orderContext?.manualDiscountAmount);
        const supervisorTok = orderContext?.supervisorElevationToken?.trim();
        const orderPayload: CashierOrderSyncPayload = {
          items: state.cart,
          total: state.cart.reduce(
            (acc, item) => acc + item.unitPrice * item.quantity,
            0,
          ),
          paymentMethod,
          customerName: customer?.name?.trim() || undefined,
          customerPhone: customer?.phone?.trim() || undefined,
          fulfillmentType: orderContext?.fulfillmentType ?? 'takeaway',
          paymentCollection: orderContext?.paymentCollection ?? 'immediate',
          tableNumber:
            orderContext?.fulfillmentType === 'dine_in'
              ? orderContext?.tableNumber?.trim() || undefined
              : undefined,
          deliveryAddress:
            orderContext?.fulfillmentType === 'delivery'
              ? orderContext?.deliveryAddress?.trim() || undefined
              : undefined,
          orderSource: orderContext?.orderSource ?? 'cashier_pos',
          ...(orderContext?.discountCode?.trim()
            ? { discountCode: orderContext.discountCode.trim().toUpperCase() }
            : {}),
          ...(manualAmt !== undefined && supervisorTok
            ? { manualDiscountAmount: manualAmt, supervisorElevationToken: supervisorTok }
            : {}),
          ...(typeof orderContext?.cashTenderAuditNote === 'string' &&
          orderContext.cashTenderAuditNote.trim().length > 0
            ? { cashTenderAuditNote: orderContext.cashTenderAuditNote.trim().slice(0, 400) }
            : {}),
          createdAt: new Date().toISOString(),
        };

        const queueLocalId = `off_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        pendingPlacementQueueIds.add(queueLocalId);
        void queueOrder(orderPayload, queueLocalId);
      },
      clearCart: () => set({ cart: [] }),
    }),
    {
      name: 'cashier-pos-store', // name of the item in the storage (must be unique)
      storage: createJSONStorage(() => localStorage), // (optional) by default, 'localStorage' is used
      merge: (persistedState, currentState) => {
        const fromStorage =
          persistedState && typeof persistedState === 'object'
            ? (persistedState as Partial<PosState>)
            : {};
        const merged = { ...currentState, ...fromStorage };
        merged.cart = consolidateCartLines(merged.cart ?? []);
        return merged;
      },
    }
  )
);

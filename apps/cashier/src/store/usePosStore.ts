import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type {
  CashierOrderLineInput,
  CashierPaymentCollection,
  CashierOrderSource,
  CashierOrderSyncPayload,
  CashierPaymentMethod,
} from '@wrap-roll/contracts';

export interface CartItem extends CashierOrderLineInput {
  cartId: string;
}

interface PosState {
  cart: CartItem[];
  addItem: (item: Omit<CartItem, 'cartId'>) => void;
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
    },
  ) => void;
  clearCart: () => void;
}

export const usePosStore = create<PosState>()(
  persist(
    (set) => ({
      cart: [],
      addItem: (item) =>
        set((state) => {
          const optionsKey = JSON.stringify(
            [...(item.selectedOptions ?? [])].sort((a, b) =>
              `${a.groupName}:${a.label}:${a.priceAdjust}`.localeCompare(
                `${b.groupName}:${b.label}:${b.priceAdjust}`,
              ),
            ),
          );
          const notesKey = (item.notes ?? '').trim();
          const existingIndex = state.cart.findIndex(
            (c) =>
              c.id === item.id &&
              c.unitPrice === item.unitPrice &&
              (c.notes ?? '').trim() === notesKey &&
              JSON.stringify(
                [...(c.selectedOptions ?? [])].sort((a, b) =>
                  `${a.groupName}:${a.label}:${a.priceAdjust}`.localeCompare(
                    `${b.groupName}:${b.label}:${b.priceAdjust}`,
                  ),
                ),
              ) === optionsKey,
          );
          if (existingIndex >= 0) {
            const next = [...state.cart];
            const target = next[existingIndex];
            next[existingIndex] = {
              ...target,
              quantity: target.quantity + Math.max(1, item.quantity),
            };
            return { cart: next };
          }
          return {
            cart: [
              ...state.cart,
              {
                ...item,
                cartId: `cart_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              },
            ],
          };
        }),
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
      pay: (paymentMethod, customer, orderContext) =>
        set((state) => {
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
            createdAt: new Date().toISOString(),
          };

          // This will be called from the component for better handling or here
          // We'll queue it in the background
          import('../lib/sync-queue').then(({ queueOrder }) => {
            queueOrder(orderPayload);
          });

          console.log('Order processed and queued for sync');
          return { cart: [] };
        }),
      clearCart: () => set({ cart: [] }),
    }),
    {
      name: 'cashier-pos-store', // name of the item in the storage (must be unique)
      storage: createJSONStorage(() => localStorage), // (optional) by default, 'localStorage' is used
    }
  )
);

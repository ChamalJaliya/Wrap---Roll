import 'react-native-get-random-values';
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { type MenuItem, type ModifierGroup } from '@wrap-roll/contracts';
import { v4 as uuidv4 } from 'uuid';

const { persist, createJSONStorage } = require('zustand/middleware.js') as typeof import('zustand/middleware');

export interface SelectedModifier {
  groupId: string;
  name: string;
  options: {
    optionId: string;
    label: string;
    priceAdjust: number;
  }[];
}

export interface CartItem {
  cartId: string;
  itemId: string;
  name: string;
  basePrice: number;
  imageUrl?: string;
  quantity: number;
  modifiers: SelectedModifier[];
  totalItemPrice: number;
}

interface MobileCartState {
  cart: CartItem[];
  addToCart: (item: MenuItem, selectedModifiers?: SelectedModifier[]) => void;
  removeFromCart: (cartId: string) => void;
  updateQuantity: (cartId: string, quantity: number) => void;
  clearCart: () => void;
  getTotalPrice: () => number;
}

function sortModsKey(mods: SelectedModifier[]): string {
  return JSON.stringify(
    [...mods].sort((a, b) => a.groupId.localeCompare(b.groupId)).map((g) => ({
      ...g,
      options: [...g.options].sort((x, y) => x.optionId.localeCompare(y.optionId)),
    })),
  );
}

export const useMobileCartStore = create<MobileCartState>()(
  persist(
    (set, get) => ({
      cart: [],
      addToCart: (item, selectedModifiers = []) => {
        const currentCart = get().cart;
        const modifiersPrice = selectedModifiers.reduce(
          (acc, group) =>
            acc + group.options.reduce((optAcc, opt) => optAcc + opt.priceAdjust, 0),
          0,
        );
        const totalItemPrice = item.basePrice + modifiersPrice;
        const configKey = sortModsKey(selectedModifiers);
        const existingItem = currentCart.find(
          (i) =>
            i.itemId === item.itemId &&
            sortModsKey(i.modifiers) === configKey,
        );
        if (existingItem) {
          set({
            cart: currentCart.map((i) =>
              i.cartId === existingItem.cartId ? { ...i, quantity: i.quantity + 1 } : i,
            ),
          });
        } else {
          const newItem: CartItem = {
            cartId: uuidv4(),
            itemId: item.itemId,
            name: item.name,
            basePrice: item.basePrice,
            imageUrl: item.imageUrl,
            quantity: 1,
            modifiers: selectedModifiers,
            totalItemPrice,
          };
          set({ cart: [...currentCart, newItem] });
        }
      },
      removeFromCart: (cartId) => {
        set({ cart: get().cart.filter((i) => i.cartId !== cartId) });
      },
      updateQuantity: (cartId, quantity) => {
        if (quantity <= 0) {
          get().removeFromCart(cartId);
          return;
        }
        set({
          cart: get().cart.map((i) =>
            i.cartId === cartId ? { ...i, quantity } : i,
          ),
        });
      },
      clearCart: () => set({ cart: [] }),
      getTotalPrice: () =>
        get().cart.reduce((total, line) => total + line.totalItemPrice * line.quantity, 0),
    }),
    {
      name: 'wrap-roll-mobile-cart',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

export function defaultModifiersFromItem(item: MenuItem): SelectedModifier[] {
  return item.modifierGroups.map((g: ModifierGroup) => {
    const picked = g.options.filter((o) => o.isDefault);
    if (picked.length > 0) {
      return {
        groupId: g.groupId,
        name: g.name,
        options: picked.map((o) => ({
          optionId: o.optionId,
          label: o.label,
          priceAdjust: o.priceAdjust,
        })),
      };
    }
    if (g.type === 'single' && g.options[0]) {
      const o = g.options[0];
      return {
        groupId: g.groupId,
        name: g.name,
        options: [
          {
            optionId: o.optionId,
            label: o.label,
            priceAdjust: o.priceAdjust,
          },
        ],
      };
    }
    return { groupId: g.groupId, name: g.name, options: [] };
  });
}

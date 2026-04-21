import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { type MenuItem, type ModifierGroup } from '@wrap-roll/contracts';

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
  cartId: string;       // Unique ID for this specific customization
  itemId: string;       // Original MenuItem ID
  name: string;
  basePrice: number;    // Original base price
  imageUrl?: string;
  quantity: number;
  modifiers: SelectedModifier[];
  totalItemPrice: number; // basePrice + sum of modifier adjustments
}

interface ClientState {
  user: any | null;
  cart: CartItem[];
  setUser: (user: any | null) => void;
  addToCart: (item: MenuItem, selectedModifiers?: SelectedModifier[]) => void;
  removeFromCart: (cartId: string) => void;
  updateQuantity: (cartId: string, quantity: number) => void;
  clearCart: () => void;
  getTotalPrice: () => number;
  signOut: () => Promise<void>;
}

export const useClientStore = create<ClientState>()(
  persist(
    (set, get) => ({
      user: null,
      cart: [],
      setUser: (user) => set({ user }),
      addToCart: (item: MenuItem, selectedModifiers = []) => {
        const currentCart = get().cart;
        
        // Calculate total price for this specific item configuration
        const modifiersPrice = selectedModifiers.reduce((acc, group) => 
          acc + group.options.reduce((optAcc, opt) => optAcc + opt.priceAdjust, 0), 0);
        const totalItemPrice = item.basePrice + modifiersPrice;

        // Create a unique key for this configuration to check if it already exists in cart
        const configKey = JSON.stringify(selectedModifiers.sort((a,b) => a.groupId.localeCompare(b.groupId)));
        const existingItem = currentCart.find((i) => 
          i.itemId === item.itemId && 
          JSON.stringify(i.modifiers.sort((a,b) => a.groupId.localeCompare(b.groupId))) === configKey
        );

        if (existingItem) {
          set({
            cart: currentCart.map((i) =>
              i.cartId === existingItem.cartId ? { ...i, quantity: i.quantity + 1 } : i
            ),
          });
        } else {
          const newItem: CartItem = {
            cartId: crypto.randomUUID(),
            itemId: item.itemId,
            name: item.name,
            basePrice: item.basePrice,
            imageUrl: item.imageUrl,
            quantity: 1,
            modifiers: selectedModifiers,
            totalItemPrice: totalItemPrice,
          };
          set({ cart: [...currentCart, newItem] });
        }
      },
      removeFromCart: (cartId: string) => {
        set({
          cart: get().cart.filter((i) => i.cartId !== cartId),
        });
      },
      updateQuantity: (cartId: string, quantity: number) => {
        if (quantity <= 0) {
          get().removeFromCart(cartId);
          return;
        }
        set({
          cart: get().cart.map((i) =>
            i.cartId === cartId ? { ...i, quantity } : i
          ),
        });
      },
      clearCart: () => set({ cart: [] }),
      getTotalPrice: () => {
        return get().cart.reduce(
          (total, item) => total + item.totalItemPrice * item.quantity,
          0
        );
      },
      signOut: async () => {
        set({ user: null });
        // Clear session if needed via Supabase (though usually handled by AuthLayout or similar)
      },
    }),
    {
      name: 'wrap-roll-cart-storage',
    }
  )
);

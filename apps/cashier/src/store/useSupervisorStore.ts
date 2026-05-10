import { create } from 'zustand';
import {
  isElevationExpired,
  type SupervisorElevation,
} from '../lib/supervisor-session';

export type { SupervisorElevation };

type SupervisorStore = {
  elevation: SupervisorElevation | null;
  setElevation: (elevation: SupervisorElevation | null) => void;
  /** Separate scope (`card_collection`) — independent of checkout manual-discount elevation. */
  cardCollectionElevation: SupervisorElevation | null;
  setCardCollectionElevation: (elevation: SupervisorElevation | null) => void;
  getValidCardCollectionElevation: () => SupervisorElevation | null;
  /** Drop elevation if past expiry (skew). Idempotent. */
  clearExpiredElevation: () => void;
  /**
   * Use before attaching a token to checkout — clears stale elevation and returns
   * null if none or expired (fail closed).
   */
  getValidElevation: () => SupervisorElevation | null;
  manualDiscountInput: string;
  setManualDiscountInput: (value: string) => void;
  supervisorEmailInput: string;
  setSupervisorEmailInput: (value: string) => void;
  supervisorPinInput: string;
  setSupervisorPinInput: (value: string) => void;
  /** Cart emptied — drop discounts, elevation, and PIN (keep supervisor email for convenience). */
  resetAfterCartCleared: () => void;
  /** Sign out — clear everything including remembered supervisor email. */
  resetAll: () => void;
};

export const useSupervisorStore = create<SupervisorStore>((set, get) => ({
  elevation: null,
  setElevation: (elevation) => set({ elevation }),
  cardCollectionElevation: null,
  setCardCollectionElevation: (cardCollectionElevation) => set({ cardCollectionElevation }),
  getValidCardCollectionElevation: () => {
    const state = get();
    const { cardCollectionElevation } = state;
    if (!cardCollectionElevation?.token) return null;
    if (isElevationExpired(cardCollectionElevation)) {
      set({ cardCollectionElevation: null });
      return null;
    }
    return cardCollectionElevation;
  },
  clearExpiredElevation: () =>
    set((state) => {
      let elevation = state.elevation;
      let cardCollectionElevation = state.cardCollectionElevation;
      if (elevation && isElevationExpired(elevation)) elevation = null;
      if (cardCollectionElevation && isElevationExpired(cardCollectionElevation))
        cardCollectionElevation = null;
      if (elevation === state.elevation && cardCollectionElevation === state.cardCollectionElevation)
        return state;
      return { elevation, cardCollectionElevation };
    }),
  getValidElevation: () => {
    const state = get();
    const { elevation } = state;
    if (!elevation?.token) return null;
    if (isElevationExpired(elevation)) {
      set({ elevation: null });
      return null;
    }
    return elevation;
  },
  manualDiscountInput: '',
  setManualDiscountInput: (manualDiscountInput) => set({ manualDiscountInput }),
  supervisorEmailInput: '',
  setSupervisorEmailInput: (supervisorEmailInput) => set({ supervisorEmailInput }),
  supervisorPinInput: '',
  setSupervisorPinInput: (supervisorPinInput) => set({ supervisorPinInput }),
  resetAfterCartCleared: () =>
    set({
      manualDiscountInput: '',
      elevation: null,
      supervisorPinInput: '',
    }),
  resetAll: () =>
    set({
      elevation: null,
      cardCollectionElevation: null,
      manualDiscountInput: '',
      supervisorEmailInput: '',
      supervisorPinInput: '',
    }),
}));

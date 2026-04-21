import { create } from 'zustand';
import { MenuItem } from '@wrap-roll/contracts';
import { MenuService } from '../services/api';

interface MenuState {
  items: MenuItem[];
  total: number;
  page: number;
  lastPage: number;
  loading: boolean;
  error: string | null;
  filters: {
    category: string;
    search: string;
    sort: 'price' | 'newest';
    page: number;
  };
  fetchMenu: () => Promise<void>;
  setFilters: (filters: Partial<MenuState['filters']>) => void;
}

export const useMenuStore = create<MenuState>((set, get) => ({
  items: [],
  total: 0,
  page: 1,
  lastPage: 1,
  loading: false,
  error: null,
  filters: {
    category: 'all',
    search: '',
    sort: 'newest',
    page: 1,
  },
  fetchMenu: async () => {
    const { filters } = get();
    console.log('MENU_FETCH_INIT', filters);
    set({ loading: true, error: null });
    try {
      const data = await MenuService.getMenu(filters);
      console.log('MENU_COUNT_RECEIVED:', data.items.length);
      set({ 
        items: data.items, 
        total: data.meta.total, 
        page: data.meta.page, 
        lastPage: data.meta.lastPage,
        loading: false 
      });
    } catch (error) {
      console.error('Menu fetch failure:', error);
      set({ error: 'Failed to load culinary delights.', loading: false });
    }
  },
  setFilters: (newFilters) => {
    set((state) => ({
      filters: { ...state.filters, ...newFilters, page: newFilters.page ?? 1 },
    }));
    get().fetchMenu();
  },
}));

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CartItem, CartState } from '@/types';

interface CartActions {
  addItem: (item: Omit<CartItem, 'id'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  toggleCart: () => void;
  getTotalItems: () => number;
  getTotalPrice: () => number;
  rehydrate: () => void;
}

const getQuantityLimit = (stockQuantity: number) => {
  if (!Number.isFinite(stockQuantity) || stockQuantity <= 0) return 99;
  return Math.min(stockQuantity, 99);
};

const useCartStore = create<CartState & CartActions>()(
  persist(
    (set, get) => ({
      // State
      items: [],
      isOpen: false,
      hasHydrated: false,

      // Actions
      addItem: (item) => {
        const { items } = get();
        const itemType = item.item_type || 'product';
        const existingItem = items.find(
          (i) =>
            i.product_id === item.product_id &&
            i.variant_id === item.variant_id &&
            (i.item_type || 'product') === itemType
        );

        if (existingItem) {
          // Update quantity if item already exists
          const newQuantity = Math.min(
            existingItem.quantity + item.quantity,
            getQuantityLimit(item.stock_quantity)
          );
          
          set({
            items: items.map((i) =>
              i.id === existingItem.id ? { ...i, quantity: newQuantity } : i
            ),
          });
        } else {
          // Add new item
          const newItem: CartItem = {
            ...item,
            item_type: itemType,
            id: `${itemType}-${item.product_id}-${item.variant_id || 'default'}`,
          };
          set({ items: [...items, newItem] });
        }
      },

      removeItem: (id) => {
        const { items } = get();
        set({ items: items.filter((item) => item.id !== id) });
      },

      updateQuantity: (id, quantity) => {
        const { items } = get();
        
        if (quantity <= 0) {
          set({ items: items.filter((item) => item.id !== id) });
          return;
        }

        set({
          items: items.map((item) =>
            item.id === id
              ? { ...item, quantity: Math.min(quantity, getQuantityLimit(item.stock_quantity)) }
              : item
          ),
        });
      },

      clearCart: () => set({ items: [] }),

      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),
      toggleCart: () => set((state) => ({ isOpen: !state.isOpen })),

      getTotalItems: () => {
        const { items } = get();
        return items.reduce((total, item) => total + item.quantity, 0);
      },

      getTotalPrice: () => {
        const { items } = get();
        return items.reduce((total, item) => total + item.price * item.quantity, 0);
      },

      rehydrate: () => {
        // Rehydrate persisted state on the client after mount to avoid SSR/CSR mismatch.
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        (useCartStore as any).persist?.rehydrate?.();
      },
    }),
    {
      name: 'alburj-cart',
      partialize: (state) => ({ items: state.items }),
      skipHydration: true,
      onRehydrateStorage: () => () => {
        useCartStore.setState({ hasHydrated: true });
      },
    }
  )
);

export default useCartStore;

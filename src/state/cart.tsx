import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { MenuItem } from '@/lib/types';

export interface CartLine {
  item: MenuItem;
  quantity: number;
}

interface CartContextValue {
  lines: CartLine[];
  count: number;
  subtotal: number;
  add: (item: MenuItem, quantity?: number) => void;
  setQuantity: (menuItemId: string, quantity: number) => void;
  remove: (menuItemId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);

  const add = useCallback((item: MenuItem, quantity = 1) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.item.id === item.id);
      if (existing) {
        return prev.map((l) =>
          l.item.id === item.id ? { ...l, quantity: l.quantity + quantity } : l,
        );
      }
      return [...prev, { item, quantity }];
    });
  }, []);

  const setQuantity = useCallback((menuItemId: string, quantity: number) => {
    setLines((prev) =>
      prev
        .map((l) => (l.item.id === menuItemId ? { ...l, quantity } : l))
        .filter((l) => l.quantity > 0),
    );
  }, []);

  const remove = useCallback((menuItemId: string) => {
    setLines((prev) => prev.filter((l) => l.item.id !== menuItemId));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartContextValue>(() => {
    const count = lines.reduce((n, l) => n + l.quantity, 0);
    const subtotal = lines.reduce((s, l) => s + l.item.price * l.quantity, 0);
    return { lines, count, subtotal, add, setQuantity, remove, clear };
  }, [lines, add, setQuantity, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}

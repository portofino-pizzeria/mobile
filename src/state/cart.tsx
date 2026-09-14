import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { loadSavedDetails } from '@/lib/saved-details';
import type { Fulfilment, MenuItem, MenuVariant } from '@/lib/types';

/** A cart line is an (item, variant) pair, never an item on its own: a klein
 *  and a groß Margherita are two different purchasable things at two different
 *  prices, and merging them would charge the diner for the wrong one. */
export interface CartLine {
  item: MenuItem;
  variant: MenuVariant;
  quantity: number;
}

/** The identity of a cart line. Also the suffix of the UI Bridge ids the cart
 *  screen derives, so two sizes of one pizza address two distinct controls. */
export function cartLineKey(menuItemId: string, variantId: string): string {
  return `${menuItemId}::${variantId}`;
}

interface CartContextValue {
  lines: CartLine[];
  count: number;
  subtotal: number;
  /** Lieferung or Abholung. Lives with the cart so the cart and the checkout
   *  show the same fee; starts from the diner's saved choice, if any. */
  fulfilment: Fulfilment;
  setFulfilment: (next: Fulfilment) => void;
  add: (item: MenuItem, variant: MenuVariant, quantity?: number) => void;
  setQuantity: (menuItemId: string, variantId: string, quantity: number) => void;
  remove: (menuItemId: string, variantId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

function isLine(line: CartLine, menuItemId: string, variantId: string): boolean {
  return line.item.id === menuItemId && line.variant.id === variantId;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [fulfilment, setFulfilment] = useState<Fulfilment>('delivery');

  // The last order's choice, from this device. Read once; the checkout owns it
  // from then on.
  useEffect(() => {
    let active = true;
    loadSavedDetails().then((saved) => {
      if (active && saved) setFulfilment(saved.fulfilment);
    });
    return () => {
      active = false;
    };
  }, []);

  const add = useCallback(
    (item: MenuItem, variant: MenuVariant, quantity = 1) => {
      setLines((prev) => {
        const existing = prev.find((l) => isLine(l, item.id, variant.id));
        if (existing) {
          return prev.map((l) =>
            isLine(l, item.id, variant.id)
              ? { ...l, quantity: l.quantity + quantity }
              : l,
          );
        }
        return [...prev, { item, variant, quantity }];
      });
    },
    [],
  );

  const setQuantity = useCallback(
    (menuItemId: string, variantId: string, quantity: number) => {
      setLines((prev) =>
        prev
          .map((l) => (isLine(l, menuItemId, variantId) ? { ...l, quantity } : l))
          .filter((l) => l.quantity > 0),
      );
    },
    [],
  );

  const remove = useCallback((menuItemId: string, variantId: string) => {
    setLines((prev) => prev.filter((l) => !isLine(l, menuItemId, variantId)));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartContextValue>(() => {
    const count = lines.reduce((n, l) => n + l.quantity, 0);
    // Prices live on the variant — the item has none.
    const subtotal = lines.reduce((s, l) => s + l.variant.price * l.quantity, 0);
    return { lines, count, subtotal, fulfilment, setFulfilment, add, setQuantity, remove, clear };
  }, [lines, fulfilment, add, setQuantity, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}

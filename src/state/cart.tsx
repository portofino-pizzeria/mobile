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

/** An extra ingredient on a cart line, with the price it costs on the line's
 *  size. The server re-prices it from its own rows; this copy is only what
 *  the cart shows before the order is placed. */
export interface CartExtra {
  id: string;
  name: string;
  price: number;
}

/** A cart line is an (item, variant, extras) triple, never an item on its own:
 *  a klein and a groß Margherita are two different purchasable things at two
 *  different prices, and so are a Margherita with and without extra cheese —
 *  merging them would charge the diner for the wrong one. */
export interface CartLine {
  item: MenuItem;
  variant: MenuVariant;
  /** In the order the diner will read them; empty for a plain dish. */
  extras: CartExtra[];
  quantity: number;
}

/** One unit of a line: the size's price plus every extra on it. */
export function lineUnitPrice(line: Pick<CartLine, 'variant' | 'extras'>): number {
  return line.variant.price + line.extras.reduce((sum, e) => sum + e.price, 0);
}

/** The identity of a cart line. Also the suffix of the UI Bridge ids the cart
 *  screen derives, so two sizes of one pizza address two distinct controls. A
 *  plain line keeps the key it had before extras existed. */
export function cartLineKey(menuItemId: string, variantId: string, extraIds: string[] = []): string {
  const base = `${menuItemId}::${variantId}`;
  return extraIds.length ? `${base}::${[...extraIds].sort().join('+')}` : base;
}

/** The key of an existing line. */
export function keyOf(line: Pick<CartLine, 'item' | 'variant' | 'extras'>): string {
  return cartLineKey(
    line.item.id,
    line.variant.id,
    line.extras.map((e) => e.id),
  );
}

/** The UI Bridge suffix of a line's controls: `<item>-<variant>` for a plain
 *  line (the ids the cart always had), then each extra's id. */
export function lineUiId(line: Pick<CartLine, 'item' | 'variant' | 'extras'>): string {
  return [line.item.id, line.variant.id, ...line.extras.map((e) => e.id).sort()].join('-');
}

interface CartContextValue {
  lines: CartLine[];
  count: number;
  subtotal: number;
  /** Lieferung or Abholung. Lives with the cart so the cart and the checkout
   *  show the same fee; starts from the diner's saved choice, if any. */
  fulfilment: Fulfilment;
  setFulfilment: (next: Fulfilment) => void;
  add: (item: MenuItem, variant: MenuVariant, quantity?: number, extras?: CartExtra[]) => void;
  /** Addressed by `keyOf(line)`. */
  setQuantity: (lineKey: string, quantity: number) => void;
  remove: (lineKey: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

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
    (item: MenuItem, variant: MenuVariant, quantity = 1, extras: CartExtra[] = []) => {
      const key = keyOf({ item, variant, extras });
      setLines((prev) => {
        const existing = prev.find((l) => keyOf(l) === key);
        if (existing) {
          return prev.map((l) =>
            keyOf(l) === key ? { ...l, quantity: l.quantity + quantity } : l,
          );
        }
        return [...prev, { item, variant, extras, quantity }];
      });
    },
    [],
  );

  const setQuantity = useCallback((lineKey: string, quantity: number) => {
    setLines((prev) =>
      prev
        .map((l) => (keyOf(l) === lineKey ? { ...l, quantity } : l))
        .filter((l) => l.quantity > 0),
    );
  }, []);

  const remove = useCallback((lineKey: string) => {
    setLines((prev) => prev.filter((l) => keyOf(l) !== lineKey));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartContextValue>(() => {
    const count = lines.reduce((n, l) => n + l.quantity, 0);
    // Prices live on the variant and the extras — the item has none.
    const subtotal = lines.reduce((s, l) => s + lineUnitPrice(l) * l.quantity, 0);
    return { lines, count, subtotal, fulfilment, setFulfilment, add, setQuantity, remove, clear };
  }, [lines, fulfilment, add, setQuantity, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}

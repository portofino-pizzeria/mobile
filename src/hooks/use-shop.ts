import { useEffect, useState } from 'react';

import { api } from '@/lib/api';
import type { Fulfilment, ShopInfo } from '@/lib/types';

/** How often the open/closed status is read again while a screen is open. A
 *  diner who opens the app at 21:59 must not still be shown "Lieferung
 *  möglich" at 22:05. */
const REFRESH_MS = 60_000;

export interface ShopState {
  shop: ShopInfo | null;
  /** True while the last read failed. The order route still enforces the
   *  hours, so a failed read never blocks ordering on its own. */
  unavailable: boolean;
}

/** The shop's details and live status from `GET /api/shop`, kept fresh. */
export function useShop(): ShopState {
  const [shop, setShop] = useState<ShopInfo | null>(null);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let active = true;
    const load = () =>
      api
        .getShop()
        .then((next) => {
          if (!active) return;
          setShop(next);
          setUnavailable(false);
        })
        .catch(() => {
          if (active) setUnavailable(true);
        });
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  return { shop, unavailable };
}

/** The German sentence for an order kind that is not taken now, or null. The
 *  same wording the order route refuses with, so the diner reads one message
 *  whether the button or the server stopped them. */
export function closedReason(shop: ShopInfo, mode: Fulfilment): string | null {
  const s = shop.status[mode];
  if (s.available) return null;
  const when = s.next ? ` Wieder möglich ab ${s.next.weekday}, ${s.next.time} Uhr.` : '';
  if (mode === 'delivery' && shop.status.pickup.available) {
    return `Lieferungen nehmen wir heute nur bis ${shop.deliveryUntil} Uhr an. Abholung ist noch bis ${shop.status.pickup.until} Uhr möglich.${when}`;
  }
  return `Wir haben gerade geschlossen und nehmen keine Bestellungen an.${when}`;
}

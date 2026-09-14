import type { Fulfilment } from './types';

/** MIRRORS the backend's `config.deliveryFeeCents`, which is what is charged.
 *  This copy only shows the diner the total before the order exists. */
export const DELIVERY_FEE_CENTS = 299;

/** The fee for one kind of order: a pickup pays none. */
export function deliveryFeeFor(fulfilment: Fulfilment): number {
  return fulfilment === 'delivery' ? DELIVERY_FEE_CENTS : 0;
}

// Which extra ingredients a dish offers, and what each costs on a given size.
//
// Mirrors `sizeKey` / `extraPriceFor` in backend/src/lib/menu-service.ts. The
// server re-prices every extra from its own rows when the order is placed, so
// this copy only decides what the diner is SHOWN. It still has to agree with
// the server: an extra shown here that the server refuses is a dead end at
// checkout, and the checkout refuses to charge a total the server disagrees
// with.

import type { Menu, MenuExtra, MenuExtraPrice, MenuItem, MenuVariant } from './types';

/** A variant label, trimmed and lower-cased: "Groß 28cm" and "groß 28cm" are
 *  one size. */
export function sizeKey(label: string): string {
  return label.trim().toLocaleLowerCase('de-DE');
}

/** The price of an extra on the variant labelled `variantLabel`, or `null`
 *  when the extra is not offered on that size — never zero. */
export function extraPriceFor(prices: MenuExtraPrice[], variantLabel: string): number | null {
  const key = sizeKey(variantLabel);
  return prices.find((p) => sizeKey(p.size) === key)?.price ?? null;
}

/** An extra as offered on one size of one dish. */
export interface OfferedExtra {
  extra: MenuExtra;
  price: number;
}

/** Whether the dish's category takes extras at all. */
export function categoryOffersExtras(menu: Menu, item: MenuItem): boolean {
  return menu.categories.some((c) => c.id === item.categoryId && c.offersExtras === true);
}

/** The extras a diner can add to `variant` of `item`, in menu order. Empty
 *  when the category takes none or no extra is priced for this size. */
export function extrasOffered(menu: Menu, item: MenuItem, variant: MenuVariant): OfferedExtra[] {
  if (!categoryOffersExtras(menu, item)) return [];
  const out: OfferedExtra[] = [];
  for (const extra of menu.extras ?? []) {
    const price = extraPriceFor(extra.prices, variant.label);
    if (price !== null) out.push({ extra, price });
  }
  return out;
}

/** Whether ANY size of the dish takes ANY extra — whether to show the picker's
 *  button at all. */
export function dishTakesExtras(menu: Menu, item: MenuItem): boolean {
  return item.variants.some((v) => extrasOffered(menu, item, v).length > 0);
}

// Mirrors the backend domain types (../../backend/src/types.ts).
// Money is always an integer number of cents.
//
// German is authoritative throughout: `label` / `name` / `description` hold the
// text as Portofino prints it, and the `*En` fields are optional additions. A
// missing translation renders the German, never a gap.

/** A menu category. Data, not a closed union — the owner adds and reorders
 *  these, and the API returns them in the order they should be rendered. */
export interface MenuCategory {
  id: string;
  label: string;
  labelEn?: string;
  sortOrder: number;
}

/** One real purchasable thing: a size ("klein"/"groß"/"Blech") or a meat
 *  choice ("Schwein"/"Pute"). An item with a single price has exactly one
 *  variant. `price` is always present — a variant without a price cannot
 *  exist. */
export interface MenuVariant {
  id: string;
  label: string;
  sortOrder: number;
  price: number;
}

export interface MenuItem {
  id: string;
  /** The number printed on the menu ("1", "76a"). Absent if the menu does not
   *  number this item — never invented. */
  number?: string;
  name: string;
  nameEn?: string;
  description: string;
  descriptionEn?: string;
  categoryId: string;
  /** At least one, in render order. Prices live here, never on the item. */
  variants: MenuVariant[];
  /** Verbatim as printed. Resolve against `Menu.allergenLegend`; every code
   *  here has an entry there, possibly an unresolved one. */
  allergenCodes: string[];
  imageUrl?: string;
}

/** A legend entry for one allergen code. `resolved: false` means Portofino
 *  prints this code but we have no label for it — the entry is still returned,
 *  carrying the explicit "unbekannt" label. Codes are never dropped. */
export interface AllergenLegendEntry {
  code: string;
  label: string;
  labelEn?: string;
  resolved: boolean;
}

/** The GET /api/menu payload. */
export interface Menu {
  categories: MenuCategory[];
  items: MenuItem[];
  allergenLegend: AllergenLegendEntry[];
}

/** An item as the owner's editor sees it: everything a diner sees, plus the
 *  two fields that decide whether a diner sees it at all. */
export interface AdminMenuItem extends MenuItem {
  available: boolean;
  sortOrder: number;
}

/** The GET /api/admin/menu payload — the same three collections as `Menu`,
 *  including the items the public menu filters out. */
export interface AdminMenu {
  categories: MenuCategory[];
  items: AdminMenuItem[];
  allergenLegend: AllergenLegendEntry[];
}

export type PaymentProvider = 'stripe' | 'paypal' | 'mock';

export type OrderStatus =
  | 'pending_payment'
  | 'paid'
  | 'preparing'
  | 'ready'
  | 'cancelled';

/** Snapshotted at order time, so a historical order still reads
 *  "Margherita, groß" at the price that was charged. */
export interface OrderLine {
  menuItemId: string;
  variantId: string;
  name: string;
  variantLabel: string;
  unitPrice: number;
  quantity: number;
}

/** Customer details as an order READ returns them: orders placed before
 *  contact details were required can carry none, so every field is optional. */
export interface CustomerInfo {
  name?: string;
  phone?: string;
  address?: string;
  notes?: string;
}

/** Customer details as an order REQUEST must send them. Checkout refuses an
 *  order without a name, phone number and delivery address, and the API will
 *  as well once backend#9 lands, so a request type with optional fields would
 *  type-check a call that checkout never makes. */
export interface CustomerRequest {
  name: string;
  phone: string;
  address: string;
  notes?: string;
}

export interface Order {
  id: string;
  lines: OrderLine[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  currency: string;
  status: OrderStatus;
  customer?: CustomerInfo;
  payment?: { provider: PaymentProvider; reference?: string; paidAt?: string };
  createdAt: string;
  updatedAt: string;
}

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
  /** Sold only to diners who collect ("für Selbstabholer"). Absent = false. */
  pickupOnly?: boolean;
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

/** Lieferung or Abholung. A pickup pays no delivery fee and gives no address. */
export type Fulfilment = 'delivery' | 'pickup';

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

/** Customer details as an order REQUEST sends them. Name and phone are
 *  required for every order; the address only for a delivery, which the API
 *  enforces. */
export interface CustomerRequest {
  name: string;
  phone: string;
  address?: string;
  notes?: string;
}

export interface Order {
  id: string;
  lines: OrderLine[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  currency: string;
  /** Absent only from an API that predates pickup, where every order was a
   *  delivery. Read it through `fulfilmentOf`. */
  fulfilment?: Fulfilment;
  status: OrderStatus;
  customer?: CustomerInfo;
  /**
   * Set — and only ever set to `true` — when the customer block was withheld
   * because this read carried no order access token (backend decision D3).
   * Distinguishes "we are not showing you this" from "there is nothing to
   * show": without it, a delivery order with no `customer` reads exactly like
   * one whose address is genuinely missing. Absent on an authorised read and
   * on an order whose personal data was erased on request (`/forget`).
   */
  customerRedacted?: true;
  payment?: { provider: PaymentProvider; reference?: string; paidAt?: string };
  createdAt: string;
  updatedAt: string;
}

/** How an order is fulfilled, reading an absent field the way the API meant it. */
export function fulfilmentOf(order: Pick<Order, 'fulfilment'>): Fulfilment {
  return order.fulfilment === 'pickup' ? 'pickup' : 'delivery';
}

/** One service window, as local `HH:MM` strings. */
export interface ShopWindow {
  open: string;
  close: string;
}

/** Whether one kind of order is taken right now. */
export interface ShopModeStatus {
  available: boolean;
  /** While available: when it stops being taken today (`HH:MM`). */
  until?: string;
  /** While not available: when it is next taken. */
  next?: { date: string; weekday: string; time: string };
}

/** One date's hours as the server resolves them (weekly hours, NRW public
 *  holidays and the owner's special days). */
export interface ShopDayHours {
  /** `YYYY-MM-DD`, Berlin. */
  date: string;
  /** ISO weekday, 1 = Montag … 7 = Sonntag. */
  weekday: number;
  /** The NRW public holiday on this date, if any. */
  holiday?: string;
  /** The note of the owner's special day that decided this date, e.g.
   *  "Heiligabend: geöffnet bis 14:00 Uhr". */
  special?: string;
  /** Open..close; null = closed all day. */
  pickup: ShopWindow | null;
  /** Open..the day's delivery close; null = no delivery that day. */
  delivery: ShopWindow | null;
}

/** The legal notice facts (Impressum), as `GET /api/shop` returns them. A
 *  null or absent field is a fact the owner has not entered yet — it is shown
 *  as a gap, never filled in. */
export interface ShopLegal {
  ownerName: string | null;
  legalForm: string | null;
  email: string | null;
  vatId?: string;
  registerCourt?: string;
  registerNumber?: string;
  /** ownerName and email are both set. */
  complete: boolean;
  /** The names of the fields still missing, e.g. ["legalOwnerName", "email"]. */
  missing: string[];
}

/** The live status part of `GET /api/shop` (and of the owner's preview). */
export interface ShopStatus {
  now: string;
  today: {
    date: string;
    weekday?: number;
    holiday?: string;
    /** The special day's note, when one decided today's hours. Absent from
     *  an older API. */
    special?: string;
    pickup: ShopWindow | null;
    delivery: ShopWindow | null;
  };
  pickup: ShopModeStatus;
  delivery: ShopModeStatus;
}

/** The GET /api/shop payload. */
export interface ShopInfo {
  name: string;
  street: string;
  postalCode: string;
  city: string;
  phoneDisplay: string;
  phoneE164: string;
  timeZone: string;
  hours: { days: string; hours: string }[];
  deliveryUntil: string;
  status: ShopStatus;
  /** The dates in the next 30 days (today included) whose hours a special day
   *  decided, in date order. Absent from an older API. */
  specialDays?: ShopDayHours[];
  /** The Impressum facts. Absent from an older API. */
  legal?: ShopLegal;
}

// --- The owner's restaurant editor (GET /api/admin/shop) --------------------

/** One weekday of the regular week. `open` and `close` both null = Ruhetag. */
export interface AdminWeekday {
  /** ISO weekday, 1 = Montag … 7 = Sonntag. */
  weekday: number;
  open: string | null;
  close: string | null;
}

/** A special day: a dated one (`date`) or a recurring one (`monthDay`,
 *  every year). Exactly one of the two is set. */
export interface AdminSpecialDay {
  id: number;
  date: string | null;
  monthDay: string | null;
  closed: boolean;
  /** Null on a recurring row = the weekday's normal opening. */
  open: string | null;
  close: string | null;
  deliveryUntil: string | null;
  note: string;
  /** False = a default nobody has checked yet ("Vorbelegt – bitte prüfen"). */
  confirmed: boolean;
}

export interface AdminShopProfile {
  name: string;
  street: string;
  postalCode: string;
  city: string;
  phoneDisplay: string;
  /** Derived by the server from `phoneDisplay`; never sent by the app. */
  phoneE164: string;
  deliveryUntil: string;
  holidayOpen: string;
  holidayClose: string;
  ruhetagBeatsHoliday: boolean;
}

export interface AdminShopLegal {
  legalOwnerName: string | null;
  legalForm: string | null;
  email: string | null;
  vatId: string | null;
  registerCourt: string | null;
  registerNumber: string | null;
  /** ISO timestamp of the last confirmed save. */
  confirmedAt: string | null;
}

/** The GET /api/admin/shop payload; every shop write answers with it too. */
export interface AdminShop {
  /** Sent back with every write; a stale one is refused with a 409. */
  version: number;
  canUndo: boolean;
  profile: AdminShopProfile;
  legal: AdminShopLegal;
  /** 7 rows, weekday 1..7. */
  weekly: AdminWeekday[];
  /** Dated rows in the past are included. */
  specialDays: AdminSpecialDay[];
}

/** The POST /api/admin/shop/preview answer: what diners would see. */
export interface ShopPreview {
  display: { days: string; hours: string }[];
  status: ShopStatus;
  /** Today and the next 7 days. */
  days: ShopDayHours[];
}

// --- The owner's data-subject surface (GET/POST /api/admin/orders/*) -------

/** One row of the owner's phone-number search. */
export interface OrderSearchHit {
  id: string;
  createdAt: string;
  status: OrderStatus;
  fulfilment: Fulfilment;
  total: number;
  currency: string;
  name: string | null;
  phone: string | null;
  address: string | null;
  personalDataErasedAt: string | null;
}

/** The Art. 15 extract for one order. */
export interface PersonalDataExtract {
  orderId: string;
  createdAt: string;
  updatedAt: string;
  status: OrderStatus;
  fulfilment: Fulfilment;
  customer: {
    name: string | null;
    phone: string | null;
    address: string | null;
    notes: string | null;
  };
  order: {
    subtotal: number;
    deliveryFee: number;
    total: number;
    currency: string;
    lines: { name: string; variantLabel: string; unitPrice: number; quantity: number }[];
  };
  payment: {
    provider: PaymentProvider | null;
    reference: string | null;
    paidAt: string | null;
  };
  personalDataErasedAt: string | null;
  /** What this extract does not and cannot contain (Stripe, the device, backups). */
  hinweise: string[];
}

/** The POST /api/admin/orders/:id/forget answer (Art. 17). */
export interface ForgetResult {
  orderId: string;
  /** False when the order had already been erased — the call is idempotent. */
  erased: boolean;
  personalDataErasedAt: string;
  /** German, for the admin screen to show verbatim. */
  meldung: string;
}

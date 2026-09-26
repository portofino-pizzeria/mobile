import { API_BASE_URL } from './config';
import { getOrderToken } from './my-orders';
import type { CustomerRequest, Fulfilment, Menu, Order, PaymentProvider, ShopInfo } from './types';

/**
 * A non-2xx answer from the API. `status` lets a caller tell a refusal (4xx)
 * from a failure whose outcome is unknown (5xx). A request that got no answer
 * at all never reaches this class: fetch rejects with its own TypeError. The
 * kitchen's and the menu editor's clients throw subclasses of it, so
 * `errorReason` reads their answers the same way.
 */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * `Content-Type: application/json` for a request that carries a body, and
 * nothing for one that does not. The backend (Fastify) refuses a request that
 * claims a JSON body and sends none, with "Body cannot be empty when
 * content-type is set to 'application/json'" (an empty string counts as
 * none), so a bodyless POST or DELETE that sent the header unconditionally
 * never reached its route: the owner's Art. 17 erasure and every delete in
 * the editors failed that way. Every client here builds its headers through
 * this.
 */
export function jsonContentType(init?: RequestInit): Record<string, string> {
  return init?.body ? { 'Content-Type': 'application/json' } : {};
}

/**
 * Why a request failed, as a reason to put in front of a diner, a cook or the
 * owner. A 4xx carries the server's own message: it names what the request got
 * wrong, although some of the backend's refusals are still English, and a
 * screen that knows what a status means there can say it better (the order
 * screen's 404). A 5xx gets a German reason, because the backend's error
 * handler forwards internal error text. Anything else (no answer, an
 * unreadable one) gets a German reason instead of fetch's or the JSON
 * parser's English one. Dev builds log the original error, which is the
 * detail those replacements hide; `info` rather than `warn`, so a native dev
 * build shows no LogBox banner over the screen's bottom controls.
 */
export function errorReason(e: unknown): string {
  if (__DEV__) console.info('[api] request failed:', e);
  if (!(e instanceof ApiError)) return 'Keine verwertbare Antwort.';
  if (e.status >= 500) return `Fehler auf dem Server (${e.status}).`;
  return e.message || `Anfrage fehlgeschlagen (${e.status}).`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { ...jsonContentType(init), ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let message = `Anfrage fehlgeschlagen (${res.status}).`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      // non-JSON error body; keep the status message
    }
    throw new ApiError(message, res.status);
  }
  return (await res.json()) as T;
}

export interface PaymentProviders {
  stripe: boolean;
  paypal: boolean;
  mockFallback: boolean;
}

/** One line of a new order. The price lives on the variant, so a line that does
 *  not name one cannot be priced — the API rejects it at the door rather than
 *  guessing which size the diner meant. */
export interface OrderLineRequest {
  menuItemId: string;
  variantId: string;
  quantity: number;
}

export const api = {
  /** The whole menu payload — categories (in render order), items with their
   *  variants and allergen codes, and the legend those codes resolve against.
   *  All three are needed to render one item honestly, so none of them is
   *  dropped here. */
  async getMenu(): Promise<Menu> {
    return request<Menu>('/api/menu');
  },

  /** The shop's address, phone, printed hours, and whether pickup and
   *  delivery orders are taken right now — the same answer the order route
   *  enforces. */
  async getShop(): Promise<ShopInfo> {
    return request<ShopInfo>('/api/shop');
  },

  // The API refuses an order without a name and phone number, a delivery
  // without an address, and any order its kind is not taken for right now.
  //
  // `accessToken` is returned exactly once, here (backend decision D3) — the
  // caller is responsible for keeping it (`saveOrderToken`) if this device is
  // meant to read its own order back with the customer block included.
  async createOrder(
    items: OrderLineRequest[],
    fulfilment: Fulfilment,
    customer: CustomerRequest,
  ): Promise<{ order: Order; accessToken: string }> {
    return request<{ order: Order; accessToken: string }>('/api/orders', {
      method: 'POST',
      body: JSON.stringify({ items, fulfilment, customer }),
    });
  },

  async getOrder(id: string): Promise<Order> {
    // The order access token this device holds for this id, if any (D3). Sent
    // as a Bearer header — never a query parameter, which would land in the
    // request log, browser history and the Referer header. Its absence is not
    // an error: an order this device did not place, or one whose token was
    // never saved, simply gets the redacted read (`order.customerRedacted`).
    const token = await getOrderToken(id);
    // Encoded, so an id from a link can only ever name an order.
    const { order } = await request<{ order?: Order }>(
      `/api/orders/${encodeURIComponent(id)}`,
      token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
    );
    // A 2xx without an order is an answer nobody can use, not an order.
    if (!order) throw new Error('The order read answered without an order.');
    return order;
  },

  async getPaymentProviders(): Promise<PaymentProviders> {
    return request<PaymentProviders>('/api/payments/providers');
  },

  async startCheckout(
    orderId: string,
    provider: PaymentProvider,
  ): Promise<{ url: string; provider: PaymentProvider }> {
    return request<{ url: string; provider: PaymentProvider }>(
      '/api/payments/checkout',
      { method: 'POST', body: JSON.stringify({ orderId, provider }) },
    );
  },
};

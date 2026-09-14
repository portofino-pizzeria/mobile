import { API_BASE_URL } from './config';
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
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
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
  async createOrder(
    items: OrderLineRequest[],
    fulfilment: Fulfilment,
    customer: CustomerRequest,
  ): Promise<Order> {
    const { order } = await request<{ order: Order }>('/api/orders', {
      method: 'POST',
      body: JSON.stringify({ items, fulfilment, customer }),
    });
    return order;
  },

  async getOrder(id: string): Promise<Order> {
    // Encoded, so an id from a link can only ever name an order.
    const { order } = await request<{ order?: Order }>(`/api/orders/${encodeURIComponent(id)}`);
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

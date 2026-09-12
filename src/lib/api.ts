import { API_BASE_URL } from './config';
import type { CustomerRequest, Menu, Order, PaymentProvider } from './types';

/**
 * A non-2xx answer from the API. `status` lets a caller tell a refusal (4xx)
 * from a failure whose outcome is unknown (5xx). A request that got no answer
 * at all never reaches this class: fetch rejects with its own TypeError.
 */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
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

  // `customer` is required: the order API refuses an order without a name,
  // phone number and delivery address, so an optional parameter would type-check
  // a call that can only ever 400.
  async createOrder(
    items: OrderLineRequest[],
    customer: CustomerRequest,
  ): Promise<Order> {
    const { order } = await request<{ order: Order }>('/api/orders', {
      method: 'POST',
      body: JSON.stringify({ items, customer }),
    });
    return order;
  },

  async getOrder(id: string): Promise<Order> {
    const { order } = await request<{ order: Order }>(`/api/orders/${id}`);
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

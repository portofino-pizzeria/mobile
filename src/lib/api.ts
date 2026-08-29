import { API_BASE_URL } from './config';
import type { CustomerInfo, Menu, Order, PaymentProvider } from './types';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      // non-JSON error body; keep the status message
    }
    throw new Error(message);
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

  async createOrder(
    items: OrderLineRequest[],
    customer?: CustomerInfo,
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

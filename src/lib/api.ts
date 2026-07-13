import { API_BASE_URL } from './config';
import type { CustomerInfo, MenuItem, Order, PaymentProvider } from './types';

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

export const api = {
  async getMenu(): Promise<MenuItem[]> {
    const { items } = await request<{ items: MenuItem[] }>('/api/menu');
    return items;
  },

  async createOrder(
    items: { menuItemId: string; quantity: number }[],
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

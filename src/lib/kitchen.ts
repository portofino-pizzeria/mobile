import { API_BASE_URL } from './config';
import type { Order } from './types';

// The kitchen dashboard is a staff tool. The backend requires a shared token
// (KITCHEN_TOKEN) sent as a Bearer header, and its guard FAILS CLOSED: a
// backend with no token configured answers 401 to everything rather than
// serving order data unauthenticated (backend/src/routes/kitchen.ts). Local
// dev opts out with KITCHEN_AUTH_DISABLED=1 on the backend side; there is
// nothing to configure here. The operator enters the token once and we persist
// it in the browser (web is the primary target for this screen).
//
// A 401 therefore has two causes the screen must tell apart: the token was
// wrong, or the server has none at all — and in the second case no entry can
// ever succeed. The server says which in its `error` body; `KitchenApiError`
// carries it so the token gate can show it.

const TOKEN_KEY = 'portofino.kitchenToken';

function hasLocalStorage(): boolean {
  return typeof localStorage !== 'undefined';
}

export function getKitchenToken(): string {
  if (!hasLocalStorage()) return '';
  return localStorage.getItem(TOKEN_KEY) ?? '';
}

export function setKitchenToken(token: string): void {
  if (!hasLocalStorage()) return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

/** An HTTP error that carries the status so the UI can react to 401 → prompt. */
export class KitchenApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'KitchenApiError';
    this.status = status;
  }
}

async function kreq<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getKitchenToken();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      // keep the status message
    }
    throw new KitchenApiError(res.status, message);
  }
  return (await res.json()) as T;
}

export type KitchenStatus = 'preparing' | 'ready' | 'cancelled';

export const kitchenApi = {
  async list(scope: 'active' | 'all' = 'active'): Promise<Order[]> {
    const { orders } = await kreq<{ orders: Order[] }>(
      `/api/kitchen/orders?scope=${scope}`,
    );
    return orders;
  },

  async setStatus(id: string, status: KitchenStatus): Promise<Order> {
    const { order } = await kreq<{ order: Order }>(
      `/api/kitchen/orders/${id}/status`,
      { method: 'POST', body: JSON.stringify({ status }) },
    );
    return order;
  },
};

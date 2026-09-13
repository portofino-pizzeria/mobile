import { ApiError } from './api';
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
// carries it, together with whether THIS request carried a token at all —
// decided when the request is built, because by the time the 401 lands the
// operator may have stored one, and a "wrong token" message about a request
// that sent none would be a lie.

const TOKEN_KEY = 'portofino.kitchenToken';

/** localStorage, or null where it is absent or blocked. With site data
 *  blocked, even reading the global throws, so the probe is guarded too. */
function tokenStore(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function getKitchenToken(): string {
  try {
    return tokenStore()?.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

export function setKitchenToken(token: string): void {
  try {
    const store = tokenStore();
    if (token) store?.setItem(TOKEN_KEY, token);
    else store?.removeItem(TOKEN_KEY);
  } catch {
    // Not persisted: the operator enters the token again on the next visit.
  }
}

/** An HTTP error that carries the status so the UI can react to 401 → prompt.
 *  An `ApiError`, so `errorReason` reads it like any other answer. */
export class KitchenApiError extends ApiError {
  /** Whether the failed request carried a Bearer token. Fixed at send time. */
  tokenSent: boolean;
  constructor(status: number, message: string, tokenSent: boolean) {
    super(message, status);
    this.name = 'KitchenApiError';
    this.tokenSent = tokenSent;
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
    let message = `Anfrage fehlgeschlagen (${res.status}).`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      // keep the status message
    }
    throw new KitchenApiError(res.status, message, token !== '');
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
      // Encoded, as the diner's order read and the menu editor's paths are.
      `/api/kitchen/orders/${encodeURIComponent(id)}/status`,
      { method: 'POST', body: JSON.stringify({ status }) },
    );
    return order;
  },
};

// The owner's menu editor — API client and credential.
//
// Deliberately separate from `kitchen.ts`: the kitchen screen is a staff tool
// behind the counter whose backend guard turns itself off when unconfigured,
// while this one writes the allergens and prices a diner reads and its backend
// guard fails closed (see backend/src/routes/admin-menu.ts). Nothing here is
// shared with the kitchen token.
//
// The credential is kept in the same tiny key/value store the offline menu
// cache uses, so the owner types it once per device instead of once per shift —
// on web that is localStorage, on a phone a file in the app's document
// directory.

import { ApiError } from './api';
import { API_BASE_URL } from './config';
import { readStoredText, writeStoredText } from './storage';
import type {
  AdminMenu,
  AdminMenuItem,
  AllergenLegendEntry,
  MenuCategory,
} from './types';

const TOKEN_KEY = 'portofino.ownerMenuToken';

/** Read once at start-up, then kept here so every request is synchronous. */
let cachedToken = '';

export async function loadOwnerToken(): Promise<string> {
  cachedToken = (await readStoredText(TOKEN_KEY)) ?? '';
  return cachedToken;
}

export function getOwnerToken(): string {
  return cachedToken;
}

export async function setOwnerToken(token: string): Promise<void> {
  cachedToken = token;
  await writeStoredText(TOKEN_KEY, token);
}

/** An HTTP error carrying the status, so the screen can tell "wrong password"
 *  (401 → ask again) from "that is not allowed" (400/409 → show the reason).
 *  An `ApiError`, so `errorReason` reads it like any other answer. */
export class AdminApiError extends ApiError {
  constructor(status: number, message: string) {
    super(message, status);
    this.name = 'AdminApiError';
  }
}

async function areq<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(cachedToken ? { Authorization: `Bearer ${cachedToken}` } : {}),
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
    throw new AdminApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** One purchasable size and its price, as the editor sends it. */
export interface VariantDraft {
  id?: string;
  label: string;
  priceCents: number;
  sortOrder?: number;
}

export interface ItemDraft {
  id?: string;
  number?: string | null;
  name: string;
  description?: string;
  categoryId: string;
  /** Always sent by the editor, because the form owns the whole list. */
  allergenCodes: string[];
  /** Required by the API whenever `allergenCodes` is empty — saving a dish
   *  with no allergen information has to be a deliberate act. */
  confirmNoAllergens?: boolean;
  available?: boolean;
  variants: VariantDraft[];
}

export const adminApi = {
  /** The whole menu including the items diners cannot see. */
  async getMenu(): Promise<AdminMenu> {
    return areq<AdminMenu>('/api/admin/menu');
  },

  async createItem(draft: ItemDraft): Promise<AdminMenuItem> {
    const { item } = await areq<{ item: AdminMenuItem }>('/api/admin/menu/items', {
      method: 'POST',
      body: JSON.stringify(draft),
    });
    return item;
  },

  async updateItem(id: string, draft: Omit<ItemDraft, 'id'>): Promise<AdminMenuItem> {
    const { item } = await areq<{ item: AdminMenuItem }>(
      `/api/admin/menu/items/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(draft) },
    );
    return item;
  },

  async setAvailable(id: string, available: boolean): Promise<AdminMenuItem> {
    const { item } = await areq<{ item: AdminMenuItem }>(
      `/api/admin/menu/items/${encodeURIComponent(id)}/available`,
      { method: 'POST', body: JSON.stringify({ available }) },
    );
    return item;
  },

  async deleteItem(id: string): Promise<void> {
    await areq<{ deleted: string }>(`/api/admin/menu/items/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  async createCategory(input: {
    id?: string;
    label: string;
    sortOrder?: number;
  }): Promise<MenuCategory> {
    const { category } = await areq<{ category: MenuCategory }>(
      '/api/admin/menu/categories',
      { method: 'POST', body: JSON.stringify(input) },
    );
    return category;
  },

  async renameCategory(id: string, label: string): Promise<MenuCategory> {
    const { category } = await areq<{ category: MenuCategory }>(
      `/api/admin/menu/categories/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify({ label }) },
    );
    return category;
  },

  async reorderCategories(ids: string[]): Promise<MenuCategory[]> {
    const { categories } = await areq<{ categories: MenuCategory[] }>(
      '/api/admin/menu/categories/reorder',
      { method: 'POST', body: JSON.stringify({ ids }) },
    );
    return categories;
  },

  async deleteCategory(id: string): Promise<void> {
    await areq<{ deleted: string }>(
      `/api/admin/menu/categories/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    );
  },

  async saveAllergen(input: {
    code: string;
    labelDe: string;
    labelEn?: string | null;
    sortOrder?: number;
  }): Promise<AllergenLegendEntry> {
    const { allergen } = await areq<{
      allergen: { code: string; labelDe: string; labelEn: string | null };
    }>('/api/admin/menu/allergens', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return {
      code: allergen.code,
      label: allergen.labelDe,
      ...(allergen.labelEn ? { labelEn: allergen.labelEn } : {}),
      resolved: true,
    };
  },

  async deleteAllergen(code: string): Promise<{ stillUsedBy: string[] }> {
    return areq<{ deleted: string; stillUsedBy: string[] }>(
      `/api/admin/menu/allergens/${encodeURIComponent(code)}`,
      { method: 'DELETE' },
    );
  },
};

// --- Price entry -----------------------------------------------------------

/** Cents as the owner types them: "7,90". Empty for a price that is not set
 *  yet, never "0,00" — a zero price is a mistake, not a default. */
export function centsToInput(cents: number | null): string {
  if (cents === null || Number.isNaN(cents)) return '';
  return (cents / 100).toFixed(2).replace('.', ',');
}

/**
 * Read a typed price into integer cents. Accepts "7,90", "7.90", "7" and
 * " 7,9 ". Returns `null` for anything that is not a price — the caller shows
 * the German error rather than guessing a number, because a guessed price is
 * charged to a diner.
 */
export function inputToCents(text: string): number | null {
  const cleaned = text.trim().replace(/\s/g, '').replace(',', '.');
  if (!cleaned) return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const cents = Math.round(Number(cleaned) * 100);
  if (!Number.isInteger(cents) || cents <= 0) return null;
  return cents;
}

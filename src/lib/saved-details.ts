import { readStoredText, removeStoredText, writeStoredText } from './storage';
import type { Fulfilment } from './types';

// The diner's details from their last order, kept ON THIS DEVICE only, so the
// next order is not typed from scratch. `audience_profile/hungry-diner`:
// re-entering an address "Once is tolerable at signup. Twice ends it."
//
// Nothing here leaves the device: no account, no server copy. The checkout
// saves only when the diner leaves "Angaben merken" ticked, and offers to
// forget them.

const KEY = 'checkout-details-v1';

export interface SavedDetails {
  fulfilment: Fulfilment;
  name: string;
  phone: string;
  address: string;
  notes: string;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

/** The saved details, or null when there are none (or they cannot be read). */
export async function loadSavedDetails(): Promise<SavedDetails | null> {
  const raw = await readStoredText(KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const details: SavedDetails = {
      fulfilment: parsed.fulfilment === 'pickup' ? 'pickup' : 'delivery',
      name: text(parsed.name),
      phone: text(parsed.phone),
      address: text(parsed.address),
      notes: text(parsed.notes),
    };
    return details.name || details.phone || details.address ? details : null;
  } catch {
    return null;
  }
}

export function saveDetails(details: SavedDetails): Promise<void> {
  return writeStoredText(KEY, JSON.stringify(details));
}

export function forgetSavedDetails(): Promise<void> {
  return removeStoredText(KEY);
}

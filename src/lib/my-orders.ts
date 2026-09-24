import { readStoredText, writeStoredText } from './storage';

// The order access token the server hands back exactly once, from
// `POST /api/orders` (backend decision D3). Kept on THIS DEVICE only, one
// entry per order, so the device that placed an order can read its own
// customer block back — the service the diner asked for, not something they
// opted into, so unlike `saved-details.ts` it is not consent-gated and is
// never erased by "Gespeicherte Angaben löschen".
//
// A separate store from `checkout-details-v1`: that one is written only while
// "Angaben merken" is ticked and is erased on request; a token must survive
// both regardless, or the diner's own order screen loses their own address.

const KEY = 'orders-v1';

type TokenMap = Record<string, string>;

async function readMap(): Promise<TokenMap> {
  const raw = await readStoredText(KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as TokenMap;
    }
    return {};
  } catch {
    return {};
  }
}

/** Record the token for an order this device just placed. Best-effort, like
 *  every operation in `./storage`: a token we failed to save simply is not
 *  available on the next read, which degrades to the redacted shape rather
 *  than failing anything. */
export async function saveOrderToken(orderId: string, accessToken: string): Promise<void> {
  const map = await readMap();
  map[orderId] = accessToken;
  await writeStoredText(KEY, JSON.stringify(map));
}

/** The token for an order, or null when this device never placed it (or the
 *  store could not be read). */
export async function getOrderToken(orderId: string): Promise<string | null> {
  const map = await readMap();
  return map[orderId] ?? null;
}

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

/**
 * How many orders' tokens this device keeps.
 *
 * The store had no bound at all. Much of what lands in it is an order that was
 * never paid — a refused payment, a browser that would not open, a price the
 * server quoted differently — and each one was a permanent entry for an order
 * the diner will never open again. Insertion order is preserved by
 * `JSON.stringify`, so the oldest go first; a diner with more than this many
 * live orders at once is not a case this restaurant has.
 */
const MAX_TOKENS = 25;

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
  // Re-inserted, so an order written again moves to the newest end.
  delete map[orderId];
  map[orderId] = accessToken;
  const ids = Object.keys(map);
  for (const stale of ids.slice(0, Math.max(0, ids.length - MAX_TOKENS))) delete map[stale];
  await writeStoredText(KEY, JSON.stringify(map));
}

/** The token for an order, or null when this device never placed it (or the
 *  store could not be read). */
export async function getOrderToken(orderId: string): Promise<string | null> {
  const map = await readMap();
  return map[orderId] ?? null;
}

// A tiny text key/value store, web half — see `storage.ts` for the native half
// and the rationale. localStorage can throw (private mode, blocked site data)
// as well as be absent, so both are handled.

/** localStorage, or null where it is absent or blocked. With site data
 *  blocked, even reading the global throws, so the probe is guarded too. */
function store(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function readStoredText(key: string): Promise<string | null> {
  try {
    return Promise.resolve(store()?.getItem(key) ?? null);
  } catch {
    return Promise.resolve(null);
  }
}

export function removeStoredText(key: string): Promise<void> {
  try {
    store()?.removeItem(key);
  } catch {
    // Best-effort, like every operation here.
  }
  return Promise.resolve();
}

export function writeStoredText(key: string, value: string): Promise<void> {
  try {
    store()?.setItem(key, value);
  } catch {
    // Best-effort: a menu we could not cache simply is not cached.
  }
  return Promise.resolve();
}

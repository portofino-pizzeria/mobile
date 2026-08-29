// A tiny text key/value store, web half — see `storage.ts` for the native half
// and the rationale. localStorage is the same mechanism `kitchen.ts` uses, and
// it can throw (private mode, blocked site data) as well as be absent, so both
// are handled.

function hasLocalStorage(): boolean {
  return typeof localStorage !== 'undefined';
}

export function readStoredText(key: string): Promise<string | null> {
  if (!hasLocalStorage()) return Promise.resolve(null);
  try {
    return Promise.resolve(localStorage.getItem(key));
  } catch {
    return Promise.resolve(null);
  }
}

export function writeStoredText(key: string, value: string): Promise<void> {
  if (!hasLocalStorage()) return Promise.resolve();
  try {
    localStorage.setItem(key, value);
  } catch {
    // Best-effort: a menu we could not cache simply is not cached.
  }
  return Promise.resolve();
}

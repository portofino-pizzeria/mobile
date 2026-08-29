import { readStoredText, writeStoredText } from './storage';
import type { Menu } from './types';

// The offline menu cache (domain_spec/menu (6)): the last menu the API actually
// served, kept so the app can still show a menu with no network. What it must
// never do is pretend the cached copy is live — `formatCacheAge` exists so the
// screen can say how old the thing on it is.

const CACHE_KEY = 'portofino.menuCache';

/** Bumped when the cached shape changes; an envelope from an older format is
 *  discarded rather than coerced. */
const CACHE_FORMAT = 1;

interface CacheEnvelope {
  format: number;
  /** ISO 8601, the moment the API served this menu. */
  cachedAt: string;
  menu: Menu;
}

export interface CachedMenu {
  menu: Menu;
  cachedAt: Date;
}

function looksLikeMenu(value: unknown): value is Menu {
  const menu = value as Menu | null | undefined;
  return (
    !!menu &&
    Array.isArray(menu.categories) &&
    Array.isArray(menu.items) &&
    Array.isArray(menu.allergenLegend)
  );
}

export function writeCachedMenu(menu: Menu): Promise<void> {
  const envelope: CacheEnvelope = {
    format: CACHE_FORMAT,
    cachedAt: new Date().toISOString(),
    menu,
  };
  return writeStoredText(CACHE_KEY, JSON.stringify(envelope));
}

/** The cached menu, or null if there is none / it is unreadable. A corrupt or
 *  older-format envelope is *not* a menu, and half a menu is worse than none on
 *  a surface that carries allergens and prices. */
export async function readCachedMenu(): Promise<CachedMenu | null> {
  const raw = await readStoredText(CACHE_KEY);
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  const envelope = parsed as Partial<CacheEnvelope> | null;
  if (
    !envelope ||
    envelope.format !== CACHE_FORMAT ||
    typeof envelope.cachedAt !== 'string' ||
    !looksLikeMenu(envelope.menu)
  ) {
    return null;
  }

  const cachedAt = new Date(envelope.cachedAt);
  if (Number.isNaN(cachedAt.getTime())) return null;

  return { menu: envelope.menu, cachedAt };
}

/** How old the cached menu is, in German, at human scale: "gerade eben",
 *  "vor 7 Minuten", "vor 3 Stunden", "vor 2 Tagen". */
export function formatCacheAge(cachedAt: Date, now: Date = new Date()): string {
  const minutes = Math.max(0, Math.floor((now.getTime() - cachedAt.getTime()) / 60_000));
  if (minutes < 1) return 'gerade eben';
  if (minutes < 60) return `vor ${minutes} ${minutes === 1 ? 'Minute' : 'Minuten'}`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `vor ${hours} ${hours === 1 ? 'Stunde' : 'Stunden'}`;

  const days = Math.floor(hours / 24);
  return `vor ${days} ${days === 1 ? 'Tag' : 'Tagen'}`;
}

// Dates and times as the restaurant screens show and send them.
//
// Every date here is a calendar date (`YYYY-MM-DD`) in Berlin, the shop's own
// time zone, and is computed with UTC arithmetic so that no device time zone
// or daylight-saving switch can move a day. Times are `HH:MM`, 24 h.

export const WEEKDAYS = [
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
  'Sonntag',
] as const;

const WEEKDAYS_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const;

/** `HH:MM` → minutes since midnight, or null for anything else. */
export function toMinutes(time: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(time);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** Minutes since midnight → `HH:MM`, clamped to the day. */
export function fromMinutes(total: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 45, total));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Moves a time by `delta` minutes, landing on the 15-minute grid. */
export function stepTime(time: string, delta: number): string {
  const current = toMinutes(time) ?? 12 * 60;
  const snapped = delta > 0 ? Math.floor(current / 15) * 15 : Math.ceil(current / 15) * 15;
  return fromMinutes(snapped + delta);
}

function parts(date: string): [number, number, number] | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function utc(date: string): Date | null {
  const p = parts(date);
  if (!p) return null;
  const d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  // Reject 2026-02-31 and friends rather than rolling them over.
  if (d.getUTCFullYear() !== p[0] || d.getUTCMonth() !== p[1] - 1 || d.getUTCDate() !== p[2]) {
    return null;
  }
  return d;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** A real calendar date in `YYYY-MM-DD`? */
export function isDate(date: string): boolean {
  return utc(date) !== null;
}

export function addDays(date: string, days: number): string {
  const d = utc(date);
  if (!d) return date;
  d.setUTCDate(d.getUTCDate() + days);
  return iso(d);
}

/** Inclusive list of dates from `from` to `to`; empty when `to` is earlier. */
export function dateRange(from: string, to: string, max = 400): string[] {
  const out: string[] = [];
  let cur = from;
  while (cur <= to && out.length < max) {
    out.push(cur);
    cur = addDays(cur, 1);
  }
  return out;
}

/** Today's date in Berlin. Falls back to the device's own date where the
 *  platform's Intl cannot name a time zone. */
export function berlinToday(now: Date = new Date()): string {
  try {
    const text = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Berlin',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
    if (isDate(text)) return text;
  } catch {
    // fall through
  }
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** "Mi" for a date. */
export function weekdayShort(date: string): string {
  const d = utc(date);
  if (!d) return '';
  return WEEKDAYS_SHORT[(d.getUTCDay() + 6) % 7] ?? '';
}

/** "Mi, 24.12." */
export function formatDayShort(date: string): string {
  const p = parts(date);
  if (!p) return date;
  return `${weekdayShort(date)}, ${String(p[2]).padStart(2, '0')}.${String(p[1]).padStart(2, '0')}.`;
}

/** "Mi, 24.12.2026" */
export function formatDayLong(date: string): string {
  const p = parts(date);
  if (!p) return date;
  return `${formatDayShort(date)}${p[0]}`;
}

/** "24.12." for a recurring `MM-DD`. */
export function formatMonthDay(monthDay: string): string {
  const m = /^(\d{2})-(\d{2})$/.exec(monthDay);
  if (!m) return monthDay;
  return `${m[2]}.${m[1]}.`;
}

/** The next date (today or later) a recurring `MM-DD` falls on. */
export function nextOccurrence(monthDay: string, today: string): string {
  const year = Number(today.slice(0, 4));
  for (const y of [year, year + 1, year + 2, year + 3, year + 4]) {
    const candidate = `${y}-${monthDay}`;
    if (isDate(candidate) && candidate >= today) return candidate;
  }
  return `${year + 1}-${monthDay}`;
}

/**
 * A date as the owner types it: "24.12.2026", "24.12.26", "1.8.2026" or
 * "2026-12-24". Returns `YYYY-MM-DD`, or null for anything that is not a real
 * date — a guessed date would close the shop on the wrong day.
 */
export function parseGermanDate(text: string): string | null {
  const t = text.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return isDate(t) ? t : null;
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{2}|\d{4})$/.exec(t);
  if (!m) return null;
  const year = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const out = `${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return isDate(out) ? out : null;
}

/** `YYYY-MM-DD` → "24.12.2026", the form `parseGermanDate` reads back. */
export function toGermanDate(date: string): string {
  const p = parts(date);
  if (!p) return date;
  return `${String(p[2]).padStart(2, '0')}.${String(p[1]).padStart(2, '0')}.${p[0]}`;
}

/** ISO timestamp → "19.09.2026, 14:03 Uhr" in Berlin time. */
export function formatTimestamp(isoText: string): string {
  const d = new Date(isoText);
  if (Number.isNaN(d.getTime())) return isoText;
  try {
    return (
      new Intl.DateTimeFormat('de-DE', {
        timeZone: 'Europe/Berlin',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d) + ' Uhr'
    );
  } catch {
    return d.toLocaleString();
  }
}

// The owner's restaurant editor: special days and holidays, the regular week,
// address and phone, and the Impressum.
//
// Same audience and the same rules as the menu editor: one person, on a phone,
// maybe six months after the last visit. So the most common task (a day off,
// a holiday) comes first; times are CHOSEN, never typed; the week shows what
// diners will see before it is saved; every save can be undone for 30
// seconds; and every destructive step is asked twice.
//
// Every write carries the `version` this screen read. When someone else saved
// in between, the server refuses with a German sentence and the screen offers
// to reload rather than overwriting their change.

import { useUIComponent } from '@qontinui/ui-bridge-native';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  AdminButton,
  AdminField,
  ConfirmAction,
  DANGER,
  Notice,
  OK,
  WARNING,
} from '@/components/admin-ui';
import { BridgeButton } from '@/components/bridge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  AdminApiError,
  adminShopApi,
  loadOwnerToken,
  setOwnerToken,
  type ShopHoursDraft,
  type SpecialDayDraft,
} from '@/lib/admin';
import { errorReason } from '@/lib/api';
import { openLink } from '@/lib/links';
import {
  addDays,
  berlinToday,
  dateRange,
  formatDayLong,
  formatDayShort,
  formatMonthDay,
  formatTimestamp,
  fromMinutes,
  nextOccurrence,
  parseGermanDate,
  stepTime,
  toGermanDate,
  toMinutes,
  WEEKDAYS,
} from '@/lib/shop-dates';
import type { AdminShop, AdminSpecialDay, ShopDayHours, ShopPreview, ShopStatus } from '@/lib/types';

// --- Drafts -----------------------------------------------------------------

type Section = 'special' | 'hours' | 'profile' | 'legal';

interface ProfileForm {
  name: string;
  street: string;
  postalCode: string;
  city: string;
  phoneDisplay: string;
}

const LEGAL_FORMS = [
  { key: 'einzelunternehmen', title: 'Einzelunternehmen' },
  { key: 'gbr', title: 'GbR' },
  { key: 'gmbh', title: 'GmbH' },
  { key: 'ug', title: 'UG (haftungsbeschränkt)' },
] as const;
const OTHER_FORM = 'andere';

interface LegalForm {
  legalOwnerName: string;
  /** A key of LEGAL_FORMS, OTHER_FORM, or null when nothing is chosen yet. */
  formChoice: string | null;
  formOther: string;
  email: string;
  vatId: string;
  registerCourt: string;
  registerNumber: string;
  /** "Diese Angaben sind korrekt und vollständig" — cleared by every edit. */
  confirmed: boolean;
}

interface DayForm {
  /** The row being edited, or null for a new day. */
  editId: number | null;
  /** Set for a recurring row (never typed: recurring rows are seeded). */
  monthDay: string | null;
  dateText: string;
  closed: boolean;
  open: string | null;
  close: string;
  deliveryUntil: string | null;
  note: string;
}

interface VacationForm {
  fromText: string;
  toText: string;
  note: string;
}

const MAX_VACATION_DAYS = 62;
const UNDO_SECONDS = 30;
const PREVIEW_DEBOUNCE_MS = 500;

function hoursFromShop(shop: AdminShop): ShopHoursDraft {
  const weekly = [1, 2, 3, 4, 5, 6, 7].map((weekday) => {
    const row = shop.weekly.find((w) => w.weekday === weekday);
    return { weekday, open: row?.open ?? null, close: row?.close ?? null };
  });
  return {
    weekly,
    deliveryUntil: shop.profile.deliveryUntil,
    holidayOpen: shop.profile.holidayOpen,
    holidayClose: shop.profile.holidayClose,
    ruhetagBeatsHoliday: shop.profile.ruhetagBeatsHoliday,
  };
}

function profileFromShop(shop: AdminShop): ProfileForm {
  const { name, street, postalCode, city, phoneDisplay } = shop.profile;
  return { name, street, postalCode, city, phoneDisplay };
}

function legalFromShop(shop: AdminShop): LegalForm {
  const form = shop.legal.legalForm;
  const known = LEGAL_FORMS.find((f) => f.title === form);
  return {
    legalOwnerName: shop.legal.legalOwnerName ?? '',
    formChoice: known ? known.key : form ? OTHER_FORM : null,
    formOther: known || !form ? '' : form,
    email: shop.legal.email ?? '',
    vatId: shop.legal.vatId ?? '',
    registerCourt: shop.legal.registerCourt ?? '',
    registerNumber: shop.legal.registerNumber ?? '',
    confirmed: false,
  };
}

function legalFormText(form: LegalForm): string {
  if (form.formChoice === OTHER_FORM) return form.formOther.trim();
  return LEGAL_FORMS.find((f) => f.key === form.formChoice)?.title ?? '';
}

/** A stable handle for a special day in ids: `d-2026-12-24` or `md-12-31`. */
function dayKey(day: Pick<AdminSpecialDay, 'date' | 'monthDay'>): string {
  return day.date ? `d-${day.date}` : `md-${day.monthDay ?? ''}`;
}

/** When a special day next applies — for sorting and for the past filter. */
function effectiveDate(day: AdminSpecialDay, today: string): string {
  return day.date ?? nextOccurrence(day.monthDay ?? '01-01', today);
}

function describeSpecial(day: Pick<AdminSpecialDay, 'closed' | 'open' | 'close' | 'deliveryUntil'>): string {
  if (day.closed) return 'Ganztägig geschlossen';
  const open = day.open ?? 'normale Öffnung';
  const delivery = day.deliveryUntil ? `Lieferung bis ${day.deliveryUntil} Uhr` : 'Lieferung: keine eigene Angabe';
  return `${open}–${day.close ?? '?'} Uhr · ${delivery}`;
}

function suggestedNote(form: DayForm): string {
  if (form.closed) return 'Heute geschlossen';
  return `Geöffnet bis ${form.close} Uhr`;
}

/** Why a set of hours cannot be saved, or null. */
function windowProblem(open: string | null, close: string | null): string | null {
  if (open === null || close === null) return null;
  const o = toMinutes(open);
  const c = toMinutes(close);
  if (o === null || c === null) return 'Ungültige Uhrzeit.';
  if (c <= o) return 'Die Schließzeit muss nach der Öffnungszeit liegen.';
  return null;
}

function statusSentence(status: ShopStatus): string {
  const { pickup, delivery } = status;
  if (delivery.available) {
    return `Jetzt geöffnet · Lieferung bis ${delivery.until} Uhr · Abholung bis ${pickup.until} Uhr`;
  }
  if (pickup.available) return `Jetzt nur Abholung · bis ${pickup.until} Uhr`;
  if (pickup.next) {
    return `Geschlossen · Bestellungen wieder ab ${pickup.next.weekday}, ${pickup.next.time} Uhr`;
  }
  return 'Geschlossen';
}

function dayLines(day: ShopDayHours): string {
  if (!day.pickup) return 'Geschlossen – keine Bestellungen';
  const open = `Geöffnet ${day.pickup.open}–${day.pickup.close} Uhr`;
  const delivery = day.delivery
    ? `Lieferung ${day.delivery.open}–${day.delivery.close} Uhr`
    : 'keine Lieferung an diesem Tag (nur Abholung)';
  return `${open} · ${delivery}`;
}

/** State plus a ref that always holds the latest value, so a UI Bridge action
 *  that sets a draft and saves it in the next call reads what it just set. */
function useLatest<T>(initial: T): [T, (next: T) => void, { readonly current: T }] {
  const [value, setValue] = useState(initial);
  const ref = useRef(initial);
  const set = useCallback((next: T) => {
    ref.current = next;
    setValue(next);
  }, []);
  return [value, set, ref];
}

// --- Screen -----------------------------------------------------------------

export default function AdminRestaurantScreen() {
  const theme = useTheme();

  const [shop, setShopState, shopRef] = useLatest<AdminShop | null>(null);
  const [needsToken, setNeedsToken] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Section | 'undo' | 'load' | null>(null);
  const [today, setToday] = useState(() => berlinToday());

  /** A write refused because someone else saved first: the server's sentence. */
  const [conflict, setConflict] = useState<string | null>(null);
  const [sectionError, setSectionError] = useState<Partial<Record<Section, string>>>({});
  /** Seconds the "Rückgängig" offer is still open; 0 = hidden. */
  const [undoLeft, setUndoLeft] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);

  const [hours, setHours, hoursRef] = useLatest<ShopHoursDraft | null>(null);
  const [profile, setProfile, profileRef] = useLatest<ProfileForm | null>(null);
  const [profileReview, setProfileReview] = useState(false);
  const [legal, setLegal, legalRef] = useLatest<LegalForm | null>(null);
  const [dayForm, setDayForm] = useState<DayForm | null>(null);
  const [vacation, setVacation] = useState<VacationForm | null>(null);

  const [preview, setPreview] = useState<ShopPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewSeq = useRef(0);

  // --- Loading --------------------------------------------------------------

  const resetDrafts = useCallback(
    (next: AdminShop, sections: Section[]) => {
      if (sections.includes('hours')) setHours(hoursFromShop(next));
      if (sections.includes('profile')) {
        setProfile(profileFromShop(next));
        setProfileReview(false);
      }
      if (sections.includes('legal')) setLegal(legalFromShop(next));
      if (sections.includes('special')) {
        setDayForm(null);
        setVacation(null);
      }
    },
    [setHours, setProfile, setLegal],
  );

  const load = useCallback(async (): Promise<AdminShop | null> => {
    setBusy('load');
    try {
      const next = await adminShopApi.get();
      setShopState(next);
      resetDrafts(next, ['special', 'hours', 'profile', 'legal']);
      setNeedsToken(false);
      setLoadError(null);
      setConflict(null);
      setSectionError({});
      setToday(berlinToday());
      return next;
    } catch (e) {
      if (e instanceof AdminApiError && e.status === 401) {
        setNeedsToken(true);
        setLoadError(e.message);
      } else {
        setLoadError(errorReason(e));
      }
      return null;
    } finally {
      setBusy(null);
    }
  }, [resetDrafts, setShopState]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const first = setTimeout(async () => {
        const token = await loadOwnerToken();
        if (!active) return;
        if (!token) {
          setNeedsToken(true);
          return;
        }
        await load();
      }, 0);
      return () => {
        active = false;
        clearTimeout(first);
      };
    }, [load]),
  );

  // The "Rückgängig" countdown.
  useEffect(() => {
    if (undoLeft <= 0) return;
    const t = setTimeout(() => setUndoLeft((n) => Math.max(0, n - 1)), 1000);
    return () => clearTimeout(t);
  }, [undoLeft]);

  // "So sehen es Ihre Gäste": the week draft through the server's own rules,
  // debounced so that stepping through times does not send a request per tap.
  useEffect(() => {
    if (!hours || !shop) return;
    const seq = ++previewSeq.current;
    const t = setTimeout(async () => {
      try {
        const next = await adminShopApi.preview(hours);
        if (seq !== previewSeq.current) return;
        setPreview(next);
        setPreviewError(null);
      } catch (e) {
        if (seq !== previewSeq.current) return;
        setPreviewError(errorReason(e));
      }
    }, PREVIEW_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [hours, shop]);

  // --- Writing --------------------------------------------------------------

  /**
   * One write: sends the version this screen read, takes the shop the server
   * answers with, resets the drafts of the part that was saved (the others
   * keep what the owner is typing), and offers "Rückgängig". Throws the
   * refusal after showing it, so a UI Bridge action fails with the reason.
   */
  async function write(
    section: Section,
    fn: (version: number) => Promise<AdminShop>,
    done: string,
  ): Promise<AdminShop> {
    const current = shopRef.current;
    if (!current) throw new Error('Die Angaben sind noch nicht geladen.');
    setBusy(section);
    setSectionError((prev) => ({ ...prev, [section]: undefined }));
    try {
      const next = await fn(current.version);
      setShopState(next);
      resetDrafts(next, [section]);
      setConflict(null);
      setFlash(done);
      setUndoLeft(UNDO_SECONDS);
      return next;
    } catch (e) {
      if (e instanceof AdminApiError && e.status === 401) {
        setNeedsToken(true);
        setLoadError(e.message);
      } else if (e instanceof AdminApiError && e.status === 409) {
        setConflict(e.message);
      } else {
        setSectionError((prev) => ({ ...prev, [section]: errorReason(e) }));
      }
      throw e instanceof Error ? e : new Error(String(e));
    } finally {
      setBusy(null);
    }
  }

  async function undo(): Promise<AdminShop | null> {
    const current = shopRef.current;
    if (!current) throw new Error('Die Angaben sind noch nicht geladen.');
    setBusy('undo');
    try {
      await adminShopApi.undo(current.version);
      setUndoLeft(0);
      setFlash('Rückgängig gemacht.');
    } catch (e) {
      if (e instanceof AdminApiError && e.status === 409) setConflict(e.message);
      else setFlash(errorReason(e));
      setUndoLeft(0);
      throw e instanceof Error ? e : new Error(String(e));
    } finally {
      setBusy(null);
    }
    // Then read everything again: the undo can have touched any part.
    return load();
  }

  const quiet = (p: Promise<unknown>) => {
    p.catch(() => {});
  };

  // --- Special days ---------------------------------------------------------

  function findDay(ref: { id?: number; date?: string; monthDay?: string }): AdminSpecialDay {
    const list = shopRef.current?.specialDays ?? [];
    const day =
      ref.id !== undefined
        ? list.find((d) => d.id === ref.id)
        : ref.date
          ? list.find((d) => d.date === ref.date)
          : ref.monthDay
            ? list.find((d) => d.monthDay === ref.monthDay)
            : undefined;
    if (!day) {
      throw new Error(
        `Kein Sondertag für ${ref.id ?? ref.date ?? ref.monthDay ?? '(nichts angegeben)'} gefunden.`,
      );
    }
    return day;
  }

  function draftFromRow(day: AdminSpecialDay): SpecialDayDraft {
    return {
      ...(day.date ? { date: day.date } : { monthDay: day.monthDay ?? undefined }),
      closed: day.closed,
      ...(day.closed
        ? {}
        : {
            ...(day.open ? { open: day.open } : {}),
            ...(day.close ? { close: day.close } : {}),
            ...(day.deliveryUntil ? { deliveryUntil: day.deliveryUntil } : {}),
          }),
      note: day.note,
    };
  }

  function draftFromForm(form: DayForm): SpecialDayDraft | string {
    let date: string | undefined;
    if (!form.monthDay) {
      const parsed = parseGermanDate(form.dateText);
      if (!parsed) return 'Bitte ein Datum im Format TT.MM.JJJJ eingeben.';
      if (parsed < today) return 'Das Datum liegt in der Vergangenheit.';
      const clash = (shopRef.current?.specialDays ?? []).find(
        (d) => d.date === parsed && d.id !== form.editId,
      );
      if (clash) return `Für ${formatDayLong(parsed)} gibt es schon einen Eintrag – bitte dort ändern.`;
      date = parsed;
    }
    const note = form.note.trim() || suggestedNote(form);
    if (!form.closed) {
      const problem = windowProblem(form.open, form.close);
      if (problem) return problem;
      if (form.deliveryUntil && (toMinutes(form.deliveryUntil) ?? 0) > (toMinutes(form.close) ?? 0)) {
        return 'Die letzte Lieferung darf nicht nach der Schließzeit liegen.';
      }
    }
    return {
      ...(date ? { date } : { monthDay: form.monthDay ?? undefined }),
      closed: form.closed,
      ...(form.closed
        ? {}
        : {
            ...(form.open ? { open: form.open } : {}),
            close: form.close,
            ...(form.deliveryUntil ? { deliveryUntil: form.deliveryUntil } : {}),
          }),
      note,
    };
  }

  function saveDayForm(form: DayForm) {
    const draft = draftFromForm(form);
    if (typeof draft === 'string') {
      setSectionError((prev) => ({ ...prev, special: draft }));
      return Promise.reject(new Error(draft));
    }
    return write(
      'special',
      (v) =>
        form.editId !== null
          ? adminShopApi.updateSpecialDay(form.editId, draft, v)
          : adminShopApi.addSpecialDays([draft], v),
      'Sondertag gespeichert.',
    );
  }

  function vacationDays(form: VacationForm, existing: AdminSpecialDay[]): SpecialDayDraft[] | string {
    const from = parseGermanDate(form.fromText);
    const to = parseGermanDate(form.toText);
    if (!from || !to) return 'Bitte „von“ und „bis“ im Format TT.MM.JJJJ eingeben.';
    if (from < today) return 'Der erste Urlaubstag liegt in der Vergangenheit.';
    if (to < from) return '„bis“ liegt vor „von“.';
    const dates = dateRange(from, to, MAX_VACATION_DAYS + 1);
    if (dates.length > MAX_VACATION_DAYS) {
      return `Höchstens ${MAX_VACATION_DAYS} Tage auf einmal – bitte in zwei Teilen eintragen.`;
    }
    const taken = new Set(existing.map((d) => d.date));
    const clash = dates.find((d) => taken.has(d));
    if (clash) {
      return `Für ${formatDayLong(clash)} gibt es schon einen Eintrag – bitte zuerst dort löschen oder den Zeitraum anpassen.`;
    }
    const note = form.note.trim() || 'Betriebsurlaub';
    return dates.map((date) => ({ date, closed: true, note }));
  }

  function saveVacation(form: VacationForm) {
    const days = vacationDays(form, shopRef.current?.specialDays ?? []);
    if (typeof days === 'string') {
      setSectionError((prev) => ({ ...prev, special: days }));
      return Promise.reject(new Error(days));
    }
    return write(
      'special',
      (v) => adminShopApi.addSpecialDays(days, v),
      days.length === 1 ? 'Urlaubstag eingetragen.' : `${days.length} Urlaubstage eingetragen.`,
    );
  }

  function newDayForm(): DayForm {
    const current = shopRef.current;
    return {
      editId: null,
      monthDay: null,
      dateText: '',
      closed: true,
      open: current?.profile.holidayOpen ?? '12:00',
      close: current?.profile.holidayClose ?? '22:00',
      deliveryUntil: current?.profile.deliveryUntil ?? null,
      note: '',
    };
  }

  function editDayForm(day: AdminSpecialDay): DayForm {
    const current = shopRef.current;
    return {
      editId: day.id,
      monthDay: day.monthDay,
      dateText: day.date ? toGermanDate(day.date) : '',
      closed: day.closed,
      open: day.open ?? (day.monthDay ? null : (current?.profile.holidayOpen ?? '12:00')),
      close: day.close ?? current?.profile.holidayClose ?? '22:00',
      deliveryUntil: day.deliveryUntil,
      note: day.note,
    };
  }

  // --- Hours / profile / legal ----------------------------------------------

  function saveHours(confirmAllClosed: boolean) {
    const draft = hoursRef.current;
    if (!draft) return Promise.reject(new Error('Die Öffnungszeiten sind noch nicht geladen.'));
    return write(
      'hours',
      (v) => adminShopApi.saveHours(draft, v, confirmAllClosed),
      'Öffnungszeiten gespeichert.',
    );
  }

  function saveProfile() {
    const draft = profileRef.current;
    if (!draft) return Promise.reject(new Error('Die Adresse ist noch nicht geladen.'));
    const trimmed = {
      name: draft.name.trim(),
      street: draft.street.trim(),
      postalCode: draft.postalCode.trim(),
      city: draft.city.trim(),
      phoneDisplay: draft.phoneDisplay.trim(),
    };
    return write('profile', (v) => adminShopApi.saveProfile(trimmed, v), 'Adresse und Telefon gespeichert.');
  }

  function saveLegal() {
    const form = legalRef.current;
    if (!form) return Promise.reject(new Error('Das Impressum ist noch nicht geladen.'));
    if (!form.confirmed) {
      const reason = 'Bitte bestätigen: „Diese Angaben sind korrekt und vollständig“.';
      setSectionError((prev) => ({ ...prev, legal: reason }));
      return Promise.reject(new Error(reason));
    }
    const opt = (s: string) => (s.trim() ? s.trim() : undefined);
    const draft = {
      legalOwnerName: form.legalOwnerName.trim(),
      legalForm: legalFormText(form),
      email: form.email.trim(),
      ...(opt(form.vatId) ? { vatId: opt(form.vatId) } : {}),
      ...(opt(form.registerCourt) ? { registerCourt: opt(form.registerCourt) } : {}),
      ...(opt(form.registerNumber) ? { registerNumber: opt(form.registerNumber) } : {}),
    };
    return write('legal', (v) => adminShopApi.saveLegal(draft, v), 'Impressum gespeichert.');
  }

  // --- UI Bridge ------------------------------------------------------------

  function editorStatus() {
    const current = shopRef.current;
    return {
      signedIn: current !== null,
      version: current?.version ?? null,
      canUndo: current?.canUndo ?? false,
      undoOfferSeconds: undoLeft,
      conflict,
      errors: sectionError,
      profile: current?.profile ?? null,
      legal: current?.legal ?? null,
      weekly: current?.weekly ?? [],
      specialDays: current?.specialDays ?? [],
      hoursDraft: hoursRef.current,
    };
  }

  async function refreshPreview(): Promise<ShopPreview> {
    const draft = hoursRef.current;
    if (!draft) throw new Error('Die Öffnungszeiten sind noch nicht geladen.');
    const seq = ++previewSeq.current;
    const next = await adminShopApi.preview(draft);
    if (seq === previewSeq.current) {
      setPreview(next);
      setPreviewError(null);
    }
    return next;
  }

  const bridge = {
    load,
    editorStatus,
    refreshPreview,
    undo,
    write,
    findDay,
    draftFromRow,
    saveVacation,
    saveHours,
    saveProfile,
    saveLegal,
  };
  const bridgeRef = useRef(bridge);
  useEffect(() => {
    bridgeRef.current = bridge;
  });

  useUIComponent({
    id: 'admin-shop',
    name: 'Restaurant-Editor',
    actions: [
      {
        id: 'signIn',
        label: 'Sign the owner in to the restaurant editor',
        description: 'Params: { token: string }. Stores the owner credential and loads.',
        handler: async (params) => {
          const { token } = (params ?? {}) as { token?: string };
          if (!token) throw new Error('signIn: token is required.');
          await setOwnerToken(token);
          const next = await bridgeRef.current.load();
          return { signedIn: next !== null };
        },
      },
      {
        id: 'load',
        label: 'Read the restaurant facts from the server again',
        description:
          'No params. Discards unsaved drafts. Returns the same shape as getEditorStatus.',
        handler: async () => {
          await bridgeRef.current.load();
          return bridgeRef.current.editorStatus();
        },
      },
      {
        id: 'getEditorStatus',
        label: 'Report what the restaurant editor holds',
        description:
          'No params. Returns { signedIn, version, canUndo, undoOfferSeconds, conflict, ' +
          'errors, profile, legal, weekly, specialDays, hoursDraft }.',
        handler: async () => bridgeRef.current.editorStatus(),
      },
      {
        id: 'getPreview',
        label: 'Show what diners would see with the current week draft',
        description:
          'No params. Runs the current Öffnungszeiten draft through POST /api/admin/shop/preview ' +
          'and returns { display, status, days } (days: today + next 7).',
        handler: async () => bridgeRef.current.refreshPreview(),
      },
      {
        id: 'setSpecialDayClose',
        label: 'Change when a special day closes, and save it',
        description:
          'Params: { id?: number, date?: "YYYY-MM-DD", monthDay?: "MM-DD", close: "HH:MM", ' +
          'deliveryUntil?: "HH:MM", open?: "HH:MM" } — one of id/date/monthDay names the row. ' +
          'Saves the whole row at once (marking it checked). When deliveryUntil is not given ' +
          'and the stored one would be after the new close, it becomes close − 30 min. ' +
          'Returns { specialDay, version }.',
        handler: async (params) => {
          const p = (params ?? {}) as {
            id?: number;
            date?: string;
            monthDay?: string;
            close?: string;
            open?: string;
            deliveryUntil?: string;
          };
          if (!p.close || toMinutes(p.close) === null) {
            throw new Error('setSpecialDayClose: close ("HH:MM") is required.');
          }
          const b = bridgeRef.current;
          const row = b.findDay(p);
          const closeMin = toMinutes(p.close) ?? 0;
          let deliveryUntil = p.deliveryUntil ?? row.deliveryUntil ?? undefined;
          if (!p.deliveryUntil && deliveryUntil && (toMinutes(deliveryUntil) ?? 0) > closeMin) {
            deliveryUntil = fromMinutes(closeMin - 30);
          }
          const draft: SpecialDayDraft = {
            ...b.draftFromRow(row),
            closed: false,
            close: p.close,
            ...(p.open ? { open: p.open } : row.open ? { open: row.open } : {}),
            ...(deliveryUntil ? { deliveryUntil } : {}),
          };
          if (!p.open && !row.open) delete draft.open;
          const next = await b.write(
            'special',
            (v) => adminShopApi.updateSpecialDay(row.id, draft, v),
            'Sondertag gespeichert.',
          );
          return {
            specialDay: next.specialDays.find((d) => d.id === row.id) ?? null,
            version: next.version,
          };
        },
      },
      {
        id: 'saveSpecialDay',
        label: 'Create or replace one special day, and save it',
        description:
          'Params: { id?: number, date?: "YYYY-MM-DD", monthDay?: "MM-DD", closed: boolean, ' +
          'open?, close?, deliveryUntil?: "HH:MM", note: string }. With id the row is replaced ' +
          'whole (PATCH); without id a new row is created. Returns { version, specialDays }.',
        handler: async (params) => {
          const p = (params ?? {}) as SpecialDayDraft & { id?: number };
          if (typeof p.closed !== 'boolean' || !p.note) {
            throw new Error('saveSpecialDay: closed and note are required.');
          }
          const { id, ...draft } = p;
          const next = await bridgeRef.current.write(
            'special',
            (v) =>
              id !== undefined
                ? adminShopApi.updateSpecialDay(id, draft, v)
                : adminShopApi.addSpecialDays([draft], v),
            'Sondertag gespeichert.',
          );
          return { version: next.version, specialDays: next.specialDays };
        },
      },
      {
        id: 'addVacation',
        label: 'Enter a holiday: one closed day per date, in one request',
        description:
          'Params: { from: "YYYY-MM-DD", to: "YYYY-MM-DD", note?: string (default ' +
          '"Betriebsurlaub") }. At most 62 days. Returns { version, specialDays }.',
        handler: async (params) => {
          const p = (params ?? {}) as { from?: string; to?: string; note?: string };
          if (!p.from || !p.to) throw new Error('addVacation: from and to are required.');
          const next = await bridgeRef.current.saveVacation({
            fromText: p.from,
            toText: p.to,
            note: p.note ?? 'Betriebsurlaub',
          });
          return { version: next.version, specialDays: next.specialDays };
        },
      },
      {
        id: 'deleteSpecialDay',
        label: 'Delete one special day',
        description:
          'Params: { id?: number, date?: "YYYY-MM-DD", monthDay?: "MM-DD" }. Returns { version }.',
        handler: async (params) => {
          const b = bridgeRef.current;
          const row = b.findDay((params ?? {}) as { id?: number; date?: string; monthDay?: string });
          const next = await b.write(
            'special',
            (v) => adminShopApi.deleteSpecialDay(row.id, v),
            'Sondertag gelöscht.',
          );
          return { version: next.version };
        },
      },
      {
        id: 'setHoursDraft',
        label: 'Change the Öffnungszeiten draft without saving',
        description:
          'Params: any of { weekly: {weekday,open,close}[], deliveryUntil, holidayOpen, ' +
          'holidayClose, ruhetagBeatsHoliday }. Only the given parts change; the preview ' +
          'follows. Returns the draft.',
        handler: async (params) => {
          const current = hoursRef.current;
          if (!current) throw new Error('setHoursDraft: nothing is loaded yet.');
          const p = (params ?? {}) as Partial<ShopHoursDraft>;
          const weekly = current.weekly.map((row) => {
            const given = p.weekly?.find((w) => w.weekday === row.weekday);
            return given ? { weekday: row.weekday, open: given.open, close: given.close } : row;
          });
          const next: ShopHoursDraft = {
            weekly,
            deliveryUntil: p.deliveryUntil ?? current.deliveryUntil,
            holidayOpen: p.holidayOpen ?? current.holidayOpen,
            holidayClose: p.holidayClose ?? current.holidayClose,
            ruhetagBeatsHoliday: p.ruhetagBeatsHoliday ?? current.ruhetagBeatsHoliday,
          };
          setHours(next);
          return next;
        },
      },
      {
        id: 'save',
        label: 'Save one part of the restaurant facts',
        description:
          'Params: { section: "hours" | "profile" | "legal", confirmAllClosed?: boolean, ' +
          'confirmed?: boolean, ...fields }. "hours" saves the current Öffnungszeiten draft ' +
          '(confirmAllClosed is needed when every day is a Ruhetag). "profile" takes optional ' +
          '{ name, street, postalCode, city, phoneDisplay } over the current draft. "legal" ' +
          'takes optional { legalOwnerName, legalForm, email, vatId, registerCourt, ' +
          'registerNumber } and requires confirmed: true. Returns { version }.',
        handler: async (params) => {
          const p = (params ?? {}) as Record<string, unknown> & { section?: string };
          const b = bridgeRef.current;
          const str = (k: string) => (typeof p[k] === 'string' ? (p[k] as string) : undefined);
          let next: AdminShop;
          if (p.section === 'hours') {
            next = await b.saveHours(p.confirmAllClosed === true);
          } else if (p.section === 'profile') {
            const cur = profileRef.current;
            if (!cur) throw new Error('save: nothing is loaded yet.');
            setProfile({
              name: str('name') ?? cur.name,
              street: str('street') ?? cur.street,
              postalCode: str('postalCode') ?? cur.postalCode,
              city: str('city') ?? cur.city,
              phoneDisplay: str('phoneDisplay') ?? cur.phoneDisplay,
            });
            next = await b.saveProfile();
          } else if (p.section === 'legal') {
            const cur = legalRef.current;
            if (!cur) throw new Error('save: nothing is loaded yet.');
            const form = str('legalForm');
            const known = form ? LEGAL_FORMS.find((f) => f.title === form) : undefined;
            setLegal({
              legalOwnerName: str('legalOwnerName') ?? cur.legalOwnerName,
              formChoice: form === undefined ? cur.formChoice : known ? known.key : OTHER_FORM,
              formOther: form === undefined ? cur.formOther : known ? '' : form,
              email: str('email') ?? cur.email,
              vatId: str('vatId') ?? cur.vatId,
              registerCourt: str('registerCourt') ?? cur.registerCourt,
              registerNumber: str('registerNumber') ?? cur.registerNumber,
              confirmed: p.confirmed === true,
            });
            next = await b.saveLegal();
          } else {
            throw new Error('save: section must be "hours", "profile" or "legal".');
          }
          return { version: next.version };
        },
      },
      {
        id: 'undo',
        label: 'Undo the most recent restaurant change',
        description:
          'No params. POST /api/admin/shop/undo with the current version, then reloads. ' +
          'A second undo redoes. Returns the same shape as getEditorStatus.',
        handler: async () => {
          await bridgeRef.current.undo();
          return bridgeRef.current.editorStatus();
        },
      },
    ],
  });

  // --- Credential -----------------------------------------------------------

  if (needsToken) {
    return (
      <ThemedView style={styles.center}>
        <View style={styles.tokenCard}>
          <ThemedText type="subtitle">Restaurant & Öffnungszeiten</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Bitte das Kennwort der Verwaltung eingeben (dasselbe wie für die Speisekarte). Es
            wird auf diesem Gerät gespeichert, damit Sie es nur einmal brauchen.
          </ThemedText>
          {loadError ? (
            <Notice tone="error" title="Zugang nicht möglich">
              <ThemedText type="small" themeColor="textSecondary">
                {loadError}
              </ThemedText>
            </Notice>
          ) : null}
          <AdminField
            uiId="shop-token"
            label="Kennwort"
            value={tokenInput}
            onChangeText={setTokenInput}
            placeholder="Kennwort…"
            autoCapitalize="none"
          />
          <AdminButton
            uiId="shop-token-submit"
            title="Anmelden"
            tone="primary"
            busy={busy === 'load'}
            onPress={() =>
              quiet(
                (async () => {
                  await setOwnerToken(tokenInput.trim());
                  setTokenInput('');
                  await load();
                })(),
              )
            }
          />
        </View>
      </ThemedView>
    );
  }

  if (!shop || !hours || !profile || !legal) {
    return (
      <ThemedView style={styles.center}>
        {loadError ? (
          <>
            <Notice tone="error" title="Nicht geladen">
              <ThemedText type="small" themeColor="textSecondary">
                {loadError}
              </ThemedText>
            </Notice>
            <AdminButton
              uiId="shop-load-retry"
              title="Erneut versuchen"
              tone="primary"
              busy={busy === 'load'}
              onPress={() => quiet(load())}
            />
          </>
        ) : (
          <ActivityIndicator color={theme.brand} />
        )}
      </ThemedView>
    );
  }

  // --- Render ---------------------------------------------------------------

  const upcoming = shop.specialDays
    .map((d) => ({ day: d, when: effectiveDate(d, today) }))
    .filter(({ when }) => when >= today)
    .sort((a, b) => (a.when < b.when ? -1 : a.when > b.when ? 1 : 0));
  const unconfirmedCount = upcoming.filter(({ day }) => !day.confirmed).length;

  const allClosed = hours.weekly.every((w) => w.open === null || w.close === null);
  const hoursProblems = hours.weekly
    .map((w) => windowProblem(w.open, w.close))
    .concat(windowProblem(hours.holidayOpen, hours.holidayClose));
  const hoursInvalid = hoursProblems.some((p) => p !== null);
  const hoursDirty = JSON.stringify(hours) !== JSON.stringify(hoursFromShop(shop));

  const profileDirty = JSON.stringify(profile) !== JSON.stringify(profileFromShop(shop));
  const profileIncomplete = Object.values(profile).some((v) => v.trim() === '');

  const legalMissing: string[] = [];
  if (!shop.legal.legalOwnerName) legalMissing.push('Inhaber');
  if (!shop.legal.legalForm) legalMissing.push('Rechtsform');
  if (!shop.legal.email) legalMissing.push('E-Mail');
  const legalReady =
    legal.confirmed &&
    legal.legalOwnerName.trim() !== '' &&
    legal.email.trim() !== '' &&
    legalFormText(legal) !== '';

  const setWeekday = (weekday: number, open: string | null, close: string | null) =>
    setHours({
      ...hours,
      weekly: hours.weekly.map((w) => (w.weekday === weekday ? { weekday, open, close } : w)),
    });

  const editLegal = (patch: Partial<LegalForm>) => setLegal({ ...legal, ...patch, confirmed: false });

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.headerBlock}>
          <ThemedText type="subtitle">Restaurant & Öffnungszeiten</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Was Sie hier speichern, sehen Ihre Gäste sofort – in der App, beim Bestellen und im
            Impressum.
          </ThemedText>
        </View>

        {conflict ? (
          <Notice tone="error" title="Nicht gespeichert">
            <ThemedText type="small" themeColor="textSecondary">
              {conflict}
            </ThemedText>
            <AdminButton
              uiId="shop-reload"
              title="Neu laden"
              tone="primary"
              busy={busy === 'load'}
              onPress={() => quiet(load())}
            />
          </Notice>
        ) : null}

        {/* 1. Sondertage & Urlaub ------------------------------------------ */}
        <SectionCard title="Sondertage & Urlaub">
          <ThemedText type="small" themeColor="textSecondary">
            Tage, an denen Sie anders öffnen als sonst oder geschlossen haben. Sie gelten vor den
            normalen Öffnungszeiten und vor Feiertagen.
          </ThemedText>

          {unconfirmedCount > 0 ? (
            <Notice tone="warning" title="Bitte prüfen">
              <ThemedText type="small" themeColor="textSecondary">
                {unconfirmedCount === 1
                  ? 'Ein Tag ist vorbelegt und noch nicht von Ihnen bestätigt.'
                  : `${unconfirmedCount} Tage sind vorbelegt und noch nicht von Ihnen bestätigt.`}{' '}
                Stimmen die Zeiten, tippen Sie „So übernehmen“; sonst „Bearbeiten“.
              </ThemedText>
            </Notice>
          ) : null}

          {upcoming.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              Keine Sondertage eingetragen.
            </ThemedText>
          ) : (
            upcoming.map(({ day, when }) => {
              const key = dayKey(day);
              return (
                <ThemedView key={day.id} style={styles.dayRow}>
                  <View style={styles.stackTight}>
                    <ThemedText type="smallBold">
                      {day.date
                        ? formatDayLong(day.date)
                        : `Jedes Jahr am ${formatMonthDay(day.monthDay ?? '')} (nächstes Mal ${formatDayLong(when)})`}
                    </ThemedText>
                    <ThemedText type="small">{describeSpecial(day)}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      Gäste lesen: „{day.note}“
                    </ThemedText>
                    {!day.confirmed ? (
                      <View style={[styles.badge, { borderColor: WARNING, backgroundColor: '#fff4e5' }]}>
                        <ThemedText type="smallBold" style={{ color: WARNING }}>
                          Vorbelegt – bitte prüfen
                        </ThemedText>
                      </View>
                    ) : null}
                  </View>
                  {!day.confirmed ? (
                    <AdminButton
                      uiId={`shop-special-confirm-${key}`}
                      uiLabel={`${day.note}: so übernehmen`}
                      title="So übernehmen"
                      tone="primary"
                      busy={busy === 'special'}
                      onPress={() =>
                        quiet(
                          write(
                            'special',
                            (v) => adminShopApi.updateSpecialDay(day.id, draftFromRow(day), v),
                            'Sondertag bestätigt.',
                          ),
                        )
                      }
                    />
                  ) : null}
                  <View style={styles.row}>
                    <View style={styles.grow}>
                      <AdminButton
                        uiId={`shop-special-edit-${key}`}
                        uiLabel={`${day.note} bearbeiten`}
                        title="Bearbeiten"
                        onPress={() => {
                          setVacation(null);
                          setDayForm(editDayForm(day));
                        }}
                      />
                    </View>
                    <View style={styles.grow}>
                      <ConfirmAction
                        uiId={`shop-special-delete-${key}`}
                        title="Löschen"
                        question={`„${day.note}“ (${
                          day.date ? formatDayLong(day.date) : `jedes Jahr am ${formatMonthDay(day.monthDay ?? '')}`
                        }) wirklich löschen? An diesem Tag gelten dann wieder die normalen Zeiten.`}
                        confirmTitle="Ja, löschen"
                        busy={busy === 'special'}
                        onConfirm={() =>
                          quiet(
                            write(
                              'special',
                              (v) => adminShopApi.deleteSpecialDay(day.id, v),
                              'Sondertag gelöscht.',
                            ),
                          )
                        }
                      />
                    </View>
                  </View>
                </ThemedView>
              );
            })
          )}

          {sectionError.special ? (
            <Notice tone="error" title="Nicht gespeichert">
              <ThemedText type="small" themeColor="textSecondary">
                {sectionError.special}
              </ThemedText>
            </Notice>
          ) : null}

          {vacation ? (
            <VacationEditor
              form={vacation}
              onChange={setVacation}
              days={vacationDays(vacation, shop.specialDays)}
              busy={busy === 'special'}
              onSave={() => quiet(saveVacation(vacation))}
              onCancel={() => setVacation(null)}
            />
          ) : dayForm ? (
            <DayEditor
              form={dayForm}
              today={today}
              onChange={setDayForm}
              busy={busy === 'special'}
              onSave={() => quiet(saveDayForm(dayForm))}
              onCancel={() => setDayForm(null)}
            />
          ) : (
            <View style={styles.stack}>
              <AdminButton
                uiId="shop-vacation-open"
                title="Urlaub eintragen"
                tone="primary"
                onPress={() => {
                  setSectionError((prev) => ({ ...prev, special: undefined }));
                  setVacation({ fromText: '', toText: '', note: 'Betriebsurlaub' });
                }}
              />
              <AdminButton
                uiId="shop-day-open"
                title="Andere Zeiten an einem Tag"
                onPress={() => {
                  setSectionError((prev) => ({ ...prev, special: undefined }));
                  setDayForm(newDayForm());
                }}
              />
            </View>
          )}
        </SectionCard>

        {/* 2. Öffnungszeiten ------------------------------------------------ */}
        <SectionCard title="Öffnungszeiten">
          {hours.weekly.map((w) => {
            const name = WEEKDAYS[w.weekday - 1] ?? `Tag ${w.weekday}`;
            const open = w.open !== null && w.close !== null;
            const problem = windowProblem(w.open, w.close);
            return (
              <ThemedView key={w.weekday} style={styles.dayRow}>
                <ThemedText type="smallBold">{name}</ThemedText>
                <Segmented
                  uiId={`shop-hours-${w.weekday}`}
                  value={open ? 'open' : 'closed'}
                  options={[
                    { key: 'open', title: 'Geöffnet' },
                    { key: 'closed', title: 'Ruhetag' },
                  ]}
                  onChange={(key) => {
                    if (key === 'closed') {
                      setWeekday(w.weekday, null, null);
                    } else if (!open) {
                      const model = hours.weekly.find((x) => x.open !== null && x.close !== null);
                      setWeekday(
                        w.weekday,
                        model?.open ?? hours.holidayOpen,
                        model?.close ?? hours.holidayClose,
                      );
                    }
                  }}
                />
                {open ? (
                  <>
                    <TimePicker
                      uiId={`shop-hours-${w.weekday}-from`}
                      label={`${name}: öffnet um`}
                      value={w.open}
                      onChange={(t) => setWeekday(w.weekday, t, w.close)}
                    />
                    <TimePicker
                      uiId={`shop-hours-${w.weekday}-to`}
                      label={`${name}: schließt um`}
                      value={w.close}
                      onChange={(t) => setWeekday(w.weekday, w.open, t)}
                    />
                  </>
                ) : null}
                {problem ? (
                  <ThemedText type="small" style={{ color: DANGER }}>
                    {problem}
                  </ThemedText>
                ) : null}
              </ThemedView>
            );
          })}

          <ThemedView style={styles.dayRow}>
            <TimePicker
              uiId="shop-hours-delivery"
              label="Lieferung bis"
              hint="Letzte Lieferbestellung an normalen Tagen. Liegt sie vor der Öffnung, gibt es an dem Tag keine Lieferung."
              value={hours.deliveryUntil}
              onChange={(t) => t && setHours({ ...hours, deliveryUntil: t })}
            />
          </ThemedView>

          <ThemedView style={styles.dayRow}>
            <ThemedText type="smallBold">Feiertage</ThemedText>
            <TimePicker
              uiId="shop-hours-holiday-from"
              label="Feiertage: öffnet um"
              value={hours.holidayOpen}
              onChange={(t) => t && setHours({ ...hours, holidayOpen: t })}
            />
            <TimePicker
              uiId="shop-hours-holiday-to"
              label="Feiertage: schließt um"
              value={hours.holidayClose}
              onChange={(t) => t && setHours({ ...hours, holidayClose: t })}
            />
            {windowProblem(hours.holidayOpen, hours.holidayClose) ? (
              <ThemedText type="small" style={{ color: DANGER }}>
                {windowProblem(hours.holidayOpen, hours.holidayClose)}
              </ThemedText>
            ) : null}
            <ThemedText type="smallBold">Feiertag am Ruhetag bleibt geschlossen</ThemedText>
            <Segmented
              uiId="shop-hours-ruhetag-holiday"
              value={hours.ruhetagBeatsHoliday ? 'yes' : 'no'}
              options={[
                { key: 'yes', title: 'Ja, geschlossen' },
                { key: 'no', title: 'Nein, Feiertagszeiten' },
              ]}
              onChange={(key) => setHours({ ...hours, ruhetagBeatsHoliday: key === 'yes' })}
            />
          </ThemedView>

          <PreviewCard preview={preview} error={previewError} />

          {sectionError.hours ? (
            <Notice tone="error" title="Nicht gespeichert">
              <ThemedText type="small" themeColor="textSecondary">
                {sectionError.hours}
              </ThemedText>
            </Notice>
          ) : null}

          {allClosed ? (
            <>
              <Notice tone="warning" title="Alle Tage sind Ruhetage">
                <ThemedText type="small" themeColor="textSecondary">
                  So gespeichert nimmt die App an keinem Tag Bestellungen an.
                </ThemedText>
              </Notice>
              <ConfirmAction
                uiId="shop-hours-save"
                title="Öffnungszeiten speichern"
                question="Wirklich alle 7 Tage als Ruhetag speichern? Dann können Gäste an keinem Tag bestellen."
                confirmTitle="Ja, alle Tage geschlossen"
                busy={busy === 'hours'}
                onConfirm={() => quiet(saveHours(true))}
              />
            </>
          ) : (
            <AdminButton
              uiId="shop-hours-save"
              title="Öffnungszeiten speichern"
              tone="primary"
              busy={busy === 'hours'}
              disabled={!hoursDirty || hoursInvalid}
              onPress={() => quiet(saveHours(false))}
            />
          )}
          {hoursDirty ? (
            <AdminButton
              uiId="shop-hours-reset"
              title="Änderungen verwerfen"
              onPress={() => setHours(hoursFromShop(shop))}
            />
          ) : null}
        </SectionCard>

        {/* 3. Adresse & Telefon -------------------------------------------- */}
        <SectionCard title="Adresse & Telefon">
          {profileReview ? (
            <View style={styles.stack}>
              <ThemedText type="small" themeColor="textSecondary">
                So sehen es Ihre Gäste:
              </ThemedText>
              <ThemedView style={styles.dayRow}>
                <ThemedText type="smallBold">{profile.name.trim()}</ThemedText>
                <ThemedText type="small">
                  {profile.street.trim()}
                  {'\n'}
                  {profile.postalCode.trim()} {profile.city.trim()}
                </ThemedText>
                <ThemedText type="small">Telefon: {profile.phoneDisplay.trim()}</ThemedText>
              </ThemedView>
              <ThemedText type="small" themeColor="textSecondary">
                Stimmt das? Die Nummer zum Anrufen ermittelt der Server aus der Telefonnummer –
                testen Sie sie nach dem Speichern mit „Test: anrufen“.
              </ThemedText>
              {sectionError.profile ? (
                <Notice tone="error" title="Nicht gespeichert">
                  <ThemedText type="small" themeColor="textSecondary">
                    {sectionError.profile}
                  </ThemedText>
                </Notice>
              ) : null}
              <AdminButton
                uiId="shop-profile-save"
                title="Ja, so speichern"
                tone="primary"
                busy={busy === 'profile'}
                onPress={() => quiet(saveProfile())}
              />
              <AdminButton
                uiId="shop-profile-back"
                title="Zurück zum Bearbeiten"
                onPress={() => setProfileReview(false)}
              />
            </View>
          ) : (
            <View style={styles.stack}>
              <AdminField
                uiId="shop-profile-name"
                label="Name des Restaurants"
                value={profile.name}
                onChangeText={(name) => setProfile({ ...profile, name })}
              />
              <AdminField
                uiId="shop-profile-street"
                label="Straße und Hausnummer"
                value={profile.street}
                onChangeText={(street) => setProfile({ ...profile, street })}
              />
              <AdminField
                uiId="shop-profile-postal"
                label="Postleitzahl"
                value={profile.postalCode}
                onChangeText={(postalCode) => setProfile({ ...profile, postalCode })}
              />
              <AdminField
                uiId="shop-profile-city"
                label="Ort"
                value={profile.city}
                onChangeText={(city) => setProfile({ ...profile, city })}
              />
              <AdminField
                uiId="shop-profile-phone"
                label="Telefon"
                hint="So, wie es gedruckt wird, z. B. „02054 – 15 88 3“."
                value={profile.phoneDisplay}
                onChangeText={(phoneDisplay) => setProfile({ ...profile, phoneDisplay })}
              />
              <AdminButton
                uiId="shop-profile-review"
                title="Weiter zur Kontrolle"
                tone="primary"
                disabled={!profileDirty || profileIncomplete}
                onPress={() => setProfileReview(true)}
              />
              {profileDirty ? (
                <AdminButton
                  uiId="shop-profile-reset"
                  title="Änderungen verwerfen"
                  onPress={() => setProfile(profileFromShop(shop))}
                />
              ) : null}
            </View>
          )}
          <AdminButton
            uiId="shop-profile-call"
            uiLabel={`Test: ${shop.profile.phoneE164} anrufen`}
            title={`Test: anrufen (${shop.profile.phoneE164})`}
            onPress={() => openLink(`tel:${shop.profile.phoneE164}`)}
          />
        </SectionCard>

        {/* 4. Impressum ---------------------------------------------------- */}
        <SectionCard title="Impressum">
          {legalMissing.length > 0 ? (
            <Notice tone="warning" title="Das Impressum ist unvollständig">
              <ThemedText type="small" themeColor="textSecondary">
                Es fehlt: {legalMissing.join(', ')}. Gäste sehen dort „wird ergänzt“. Ohne
                vollständiges Impressum darf die App nicht öffentlich erscheinen.
              </ThemedText>
            </Notice>
          ) : null}
          <AdminField
            uiId="shop-legal-owner"
            label="Inhaber (voller Name laut Gewerbeanmeldung)"
            value={legal.legalOwnerName}
            onChangeText={(legalOwnerName) => editLegal({ legalOwnerName })}
          />
          <ThemedText type="smallBold">Rechtsform</ThemedText>
          <View style={styles.wrap}>
            {[...LEGAL_FORMS, { key: OTHER_FORM, title: 'Andere' }].map((f) => (
              <View key={f.key} style={styles.wrapItem}>
                <AdminButton
                  uiId={`shop-legal-form-${f.key}`}
                  uiLabel={`Rechtsform: ${f.title}`}
                  title={f.title}
                  tone={legal.formChoice === f.key ? 'primary' : 'secondary'}
                  onPress={() => editLegal({ formChoice: f.key })}
                />
              </View>
            ))}
          </View>
          {legal.formChoice === OTHER_FORM ? (
            <AdminField
              uiId="shop-legal-form-other"
              label="Andere Rechtsform"
              value={legal.formOther}
              onChangeText={(formOther) => editLegal({ formOther })}
            />
          ) : null}
          <AdminField
            uiId="shop-legal-email"
            label="E-Mail"
            value={legal.email}
            onChangeText={(email) => editLegal({ email })}
            autoCapitalize="none"
          />
          <AdminField
            uiId="shop-legal-vat"
            label="Umsatzsteuer-ID (falls vorhanden)"
            hint="Nur eintragen, wenn Sie eine haben – z. B. „DE123456789“."
            value={legal.vatId}
            onChangeText={(vatId) => editLegal({ vatId })}
            autoCapitalize="none"
          />
          <AdminField
            uiId="shop-legal-court"
            label="Registergericht (falls eingetragen)"
            hint="Für ein Einzelunternehmen meist leer lassen."
            value={legal.registerCourt}
            onChangeText={(registerCourt) => editLegal({ registerCourt })}
          />
          <AdminField
            uiId="shop-legal-regnr"
            label="Registernummer (falls eingetragen)"
            value={legal.registerNumber}
            onChangeText={(registerNumber) => editLegal({ registerNumber })}
            autoCapitalize="none"
          />
          <CheckRow
            uiId="shop-legal-confirm"
            label="Diese Angaben sind korrekt und vollständig"
            checked={legal.confirmed}
            onToggle={() => setLegal({ ...legal, confirmed: !legal.confirmed })}
          />
          <ThemedText type="small" themeColor="textSecondary">
            {shop.legal.confirmedAt
              ? `Zuletzt bestätigt: ${formatTimestamp(shop.legal.confirmedAt)}`
              : 'Noch nie bestätigt.'}
          </ThemedText>
          {sectionError.legal ? (
            <Notice tone="error" title="Nicht gespeichert">
              <ThemedText type="small" themeColor="textSecondary">
                {sectionError.legal}
              </ThemedText>
            </Notice>
          ) : null}
          <AdminButton
            uiId="shop-legal-save"
            title="Impressum speichern"
            tone="primary"
            busy={busy === 'legal'}
            disabled={!legalReady}
            onPress={() => quiet(saveLegal())}
          />
        </SectionCard>

        <View style={{ height: Spacing.xxxl * 2 }} />
      </ScrollView>

      {/* Always in view, wherever the owner saved: the undo offer, a refusal
          because someone else saved first, or what just happened. */}
      {conflict || undoLeft > 0 || flash ? (
        <SafeAreaView
          edges={['bottom']}
          style={[styles.bar, { backgroundColor: theme.background, borderTopColor: theme.backgroundSelected }]}>
          {conflict ? (
            <View style={styles.barRow}>
              <ThemedText type="small" style={[styles.grow, { color: DANGER }]}>
                {conflict}
              </ThemedText>
              <AdminButton
                uiId="shop-bar-reload"
                title="Neu laden"
                tone="primary"
                busy={busy === 'load'}
                onPress={() => quiet(load())}
              />
            </View>
          ) : (
            <View style={styles.barRow}>
              <ThemedText type="small" style={[styles.grow, { color: undoLeft > 0 ? OK : theme.text }]}>
                {flash}
              </ThemedText>
              {undoLeft > 0 ? (
                <AdminButton
                  uiId="shop-undo"
                  title={`Rückgängig (${undoLeft} s)`}
                  uiLabel="Rückgängig"
                  busy={busy === 'undo'}
                  onPress={() => quiet(undo())}
                />
              ) : (
                <AdminButton uiId="shop-bar-dismiss" title="OK" onPress={() => setFlash(null)} />
              )}
            </View>
          )}
        </SafeAreaView>
      ) : null}
    </ThemedView>
  );
}

// --- Parts ------------------------------------------------------------------

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold" style={styles.cardTitle} role="heading">
        {title}
      </ThemedText>
      {children}
    </ThemedView>
  );
}

/** Two or more choices, one selected, as big buttons. */
function Segmented({
  uiId,
  value,
  options,
  onChange,
}: {
  uiId: string;
  value: string;
  options: { key: string; title: string }[];
  onChange: (key: string) => void;
}) {
  return (
    <View style={styles.row}>
      {options.map((o) => (
        <View key={o.key} style={styles.grow}>
          <AdminButton
            uiId={`${uiId}-${o.key}`}
            title={value === o.key ? `✓ ${o.title}` : o.title}
            uiLabel={o.title}
            tone={value === o.key ? 'primary' : 'secondary'}
            onPress={() => onChange(o.key)}
          />
        </View>
      ))}
    </View>
  );
}

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const QUARTERS = [0, 15, 30, 45];

/**
 * A time, chosen rather than typed: ±15 minutes beside the value, or a tap on
 * the value opens every hour and the four quarters. `noneLabel` offers a
 * "no time of its own" choice (value null).
 */
function TimePicker({
  uiId,
  label,
  hint,
  value,
  onChange,
  noneLabel,
}: {
  uiId: string;
  label: string;
  hint?: string;
  value: string | null;
  onChange: (next: string | null) => void;
  noneLabel?: string;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const base = value ?? '12:00';
  const hour = Number(base.slice(0, 2));
  const minute = Number(base.slice(3, 5));
  return (
    <View style={styles.stackTight}>
      <ThemedText type="small">{label}</ThemedText>
      {hint ? (
        <ThemedText type="small" themeColor="textSecondary">
          {hint}
        </ThemedText>
      ) : null}
      <View style={styles.row}>
        <AdminButton
          uiId={`${uiId}-minus`}
          uiLabel={`${label}: 15 Minuten früher`}
          title="−15"
          onPress={() => onChange(stepTime(base, -15))}
        />
        <View style={styles.grow}>
          <BridgeButton
            uiId={`${uiId}-value`}
            uiLabel={`${label}: Uhrzeit wählen`}
            onPress={() => setOpen(!open)}
            style={[styles.timeValue, { borderColor: theme.brand, backgroundColor: theme.background }]}>
            <ThemedText type="smallBold" style={styles.timeText}>
              {value ? `${value} Uhr` : (noneLabel ?? '—')}
            </ThemedText>
          </BridgeButton>
        </View>
        <AdminButton
          uiId={`${uiId}-plus`}
          uiLabel={`${label}: 15 Minuten später`}
          title="+15"
          onPress={() => onChange(stepTime(base, 15))}
        />
      </View>
      {open ? (
        <View style={styles.stackTight}>
          <ThemedText type="small" themeColor="textSecondary">
            Stunde
          </ThemedText>
          <View style={styles.wrap}>
            {HOURS.map((h) => (
              <View key={h} style={styles.gridItem}>
                <AdminButton
                  uiId={`${uiId}-h-${h}`}
                  uiLabel={`${label}: ${h} Uhr`}
                  title={String(h).padStart(2, '0')}
                  tone={value && h === hour ? 'primary' : 'secondary'}
                  onPress={() => onChange(fromMinutes(h * 60 + (Number.isNaN(minute) ? 0 : minute - (minute % 15))))}
                />
              </View>
            ))}
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            Minute
          </ThemedText>
          <View style={styles.wrap}>
            {QUARTERS.map((m) => (
              <View key={m} style={styles.gridItem}>
                <AdminButton
                  uiId={`${uiId}-m-${m}`}
                  uiLabel={`${label}: Minute ${m}`}
                  title={`:${String(m).padStart(2, '0')}`}
                  tone={value && m === minute ? 'primary' : 'secondary'}
                  onPress={() => onChange(fromMinutes((Number.isNaN(hour) ? 12 : hour) * 60 + m))}
                />
              </View>
            ))}
          </View>
          {noneLabel ? (
            <AdminButton
              uiId={`${uiId}-none`}
              title={noneLabel}
              tone={value === null ? 'primary' : 'secondary'}
              onPress={() => onChange(null)}
            />
          ) : null}
          <AdminButton uiId={`${uiId}-done`} title="Fertig" onPress={() => setOpen(false)} />
        </View>
      ) : null}
    </View>
  );
}

/** A confirmation the owner ticks on purpose. */
function CheckRow({
  uiId,
  label,
  checked,
  onToggle,
}: {
  uiId: string;
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();
  return (
    <BridgeButton
      uiId={uiId}
      uiLabel={label}
      role="button"
      aria-pressed={checked}
      style={styles.checkRow}
      onPress={onToggle}>
      <View
        style={[
          styles.checkbox,
          { borderColor: checked ? theme.brandText : theme.textSecondary },
          checked && { backgroundColor: theme.brand },
        ]}>
        {checked ? (
          <ThemedText type="smallBold" themeColor="onBrand" style={styles.checkmark}>
            ✓
          </ThemedText>
        ) : null}
      </View>
      <ThemedText type="smallBold" style={styles.grow}>
        {label}
      </ThemedText>
    </BridgeButton>
  );
}

function VacationEditor({
  form,
  onChange,
  days,
  busy,
  onSave,
  onCancel,
}: {
  form: VacationForm;
  onChange: (next: VacationForm) => void;
  days: SpecialDayDraft[] | string;
  busy: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const bothTyped = form.fromText.trim() !== '' && form.toText.trim() !== '';
  const first = typeof days === 'string' ? undefined : days[0]?.date;
  const last = typeof days === 'string' ? undefined : days[days.length - 1]?.date;
  return (
    <ThemedView style={styles.dayRow}>
      <ThemedText type="smallBold">Urlaub eintragen</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        Jeder Tag im Zeitraum wird als geschlossen eingetragen. Gäste können an diesen Tagen
        nicht bestellen.
      </ThemedText>
      <AdminField
        uiId="shop-vacation-from"
        label="Erster Urlaubstag"
        placeholder="TT.MM.JJJJ"
        value={form.fromText}
        onChangeText={(fromText) => onChange({ ...form, fromText })}
        autoCapitalize="none"
      />
      <AdminField
        uiId="shop-vacation-to"
        label="Letzter Urlaubstag"
        placeholder="TT.MM.JJJJ"
        value={form.toText}
        onChangeText={(toText) => onChange({ ...form, toText })}
        autoCapitalize="none"
      />
      <AdminField
        uiId="shop-vacation-note"
        label="Hinweis für Gäste"
        value={form.note}
        onChangeText={(note) => onChange({ ...form, note })}
      />
      {bothTyped ? (
        typeof days === 'string' ? (
          <ThemedText type="small" style={{ color: DANGER }}>
            {days}
          </ThemedText>
        ) : first && last ? (
          <ThemedText type="small">
            {days.length === 1
              ? `1 Tag geschlossen: ${formatDayLong(first)}`
              : `${days.length} Tage geschlossen: ${formatDayLong(first)} bis ${formatDayLong(last)}`}
          </ThemedText>
        ) : null
      ) : null}
      <AdminButton
        uiId="shop-vacation-save"
        title="Urlaub speichern"
        tone="primary"
        busy={busy}
        disabled={!bothTyped || typeof days === 'string'}
        onPress={onSave}
      />
      <AdminButton uiId="shop-vacation-cancel" title="Abbrechen" onPress={onCancel} />
    </ThemedView>
  );
}

function DayEditor({
  form,
  today,
  onChange,
  busy,
  onSave,
  onCancel,
}: {
  form: DayForm;
  today: string;
  onChange: (next: DayForm) => void;
  busy: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  const parsed = form.monthDay ? null : parseGermanDate(form.dateText);
  const deliveryLate =
    !form.closed &&
    form.deliveryUntil !== null &&
    (toMinutes(form.deliveryUntil) ?? 0) > (toMinutes(form.close) ?? 0);
  const problem = form.closed ? null : windowProblem(form.open, form.close);
  return (
    <ThemedView style={styles.dayRow}>
      <ThemedText type="smallBold">
        {form.editId === null ? 'Andere Zeiten an einem Tag' : 'Sondertag bearbeiten'}
      </ThemedText>
      {form.monthDay ? (
        <ThemedText type="small">
          Jedes Jahr am {formatMonthDay(form.monthDay)} (nächstes Mal{' '}
          {formatDayLong(nextOccurrence(form.monthDay, today))})
        </ThemedText>
      ) : (
        <>
          <AdminField
            uiId="shop-day-date"
            label="Datum"
            placeholder="TT.MM.JJJJ"
            value={form.dateText}
            onChangeText={(dateText) => onChange({ ...form, dateText })}
            autoCapitalize="none"
          />
          {form.dateText.trim() ? (
            <ThemedText type="small" style={parsed && parsed >= today ? undefined : { color: DANGER }}>
              {parsed
                ? parsed >= today
                  ? formatDayLong(parsed)
                  : 'Dieses Datum liegt in der Vergangenheit.'
                : 'Bitte als TT.MM.JJJJ eingeben, z. B. 24.12.2026.'}
            </ThemedText>
          ) : (
            <View style={styles.row}>
              <View style={styles.grow}>
                <AdminButton
                  uiId="shop-day-today"
                  title={`Heute (${formatDayShort(today)})`}
                  onPress={() => onChange({ ...form, dateText: toGermanDate(today) })}
                />
              </View>
              <View style={styles.grow}>
                <AdminButton
                  uiId="shop-day-tomorrow"
                  title={`Morgen (${formatDayShort(addDays(today, 1))})`}
                  onPress={() => onChange({ ...form, dateText: toGermanDate(addDays(today, 1)) })}
                />
              </View>
            </View>
          )}
        </>
      )}
      <Segmented
        uiId="shop-day-mode"
        value={form.closed ? 'closed' : 'open'}
        options={[
          { key: 'closed', title: 'Geschlossen' },
          { key: 'open', title: 'Andere Zeiten' },
        ]}
        onChange={(key) => onChange({ ...form, closed: key === 'closed' })}
      />
      {form.closed ? null : (
        <>
          <TimePicker
            uiId="shop-day-from"
            label="Öffnet um"
            value={form.open}
            noneLabel={form.monthDay ? 'wie an dem Wochentag üblich' : undefined}
            onChange={(open) => onChange({ ...form, open: open ?? (form.monthDay ? null : '12:00') })}
          />
          <TimePicker
            uiId="shop-day-to"
            label="Schließt um"
            value={form.close}
            onChange={(close) => close && onChange({ ...form, close })}
          />
          <TimePicker
            uiId="shop-day-delivery"
            label="Letzte Lieferung"
            value={form.deliveryUntil}
            noneLabel="keine eigene Angabe"
            onChange={(deliveryUntil) => onChange({ ...form, deliveryUntil })}
          />
          {problem ? (
            <ThemedText type="small" style={{ color: DANGER }}>
              {problem}
            </ThemedText>
          ) : null}
          {deliveryLate ? (
            <ThemedText type="small" style={{ color: DANGER }}>
              Die letzte Lieferung darf nicht nach der Schließzeit liegen.
            </ThemedText>
          ) : null}
        </>
      )}
      <AdminField
        uiId="shop-day-note"
        label="Hinweis für Gäste"
        hint="Steht in der App, z. B. „Silvester: geöffnet bis 18:00 Uhr“."
        placeholder={suggestedNote(form)}
        value={form.note}
        onChangeText={(note) => onChange({ ...form, note })}
      />
      <AdminButton
        uiId="shop-day-save"
        title={form.editId === null ? 'Tag speichern' : 'Änderung speichern'}
        tone="primary"
        busy={busy}
        disabled={problem !== null || deliveryLate || (!form.monthDay && !(parsed && parsed >= today))}
        onPress={onSave}
      />
      <AdminButton uiId="shop-day-cancel" title="Abbrechen" onPress={onCancel} />
    </ThemedView>
  );
}

function PreviewCard({ preview, error }: { preview: ShopPreview | null; error: string | null }) {
  const theme = useTheme();
  return (
    <View style={[styles.preview, { borderColor: theme.brand, backgroundColor: theme.background }]}>
      <ThemedText type="smallBold" style={styles.cardTitle}>
        So sehen es Ihre Gäste
      </ThemedText>
      {error ? (
        <ThemedText type="small" style={{ color: DANGER }}>
          Vorschau nicht möglich: {error}
        </ThemedText>
      ) : null}
      {!preview ? (
        error ? null : <ActivityIndicator color={theme.brand} />
      ) : (
        <>
          <View style={styles.stackTight}>
            {preview.display.map((row) => (
              <ThemedText key={row.days} type="small">
                {row.days}: {row.hours}
              </ThemedText>
            ))}
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {statusSentence(preview.status)}
          </ThemedText>
          <ThemedText type="smallBold">Die nächsten Tage</ThemedText>
          {preview.days.map((day) => (
            <View key={day.date} style={styles.previewDay}>
              <ThemedText type="small" style={styles.bold}>
                {formatDayShort(day.date)}
                {day.holiday ? ` · ${day.holiday}` : ''}
                {day.special ? ` · ${day.special}` : ''}
              </ThemedText>
              <ThemedText
                type="small"
                style={{ color: !day.pickup ? DANGER : !day.delivery ? WARNING : theme.textSecondary }}>
                {dayLines(day)}
              </ThemedText>
            </View>
          ))}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  scroll: {
    padding: Spacing.lg,
    gap: Spacing.lg,
    width: '100%',
    maxWidth: 700,
    alignSelf: 'center',
  },
  headerBlock: { gap: Spacing.xs },
  tokenCard: { width: '100%', maxWidth: 420, gap: Spacing.lg },
  card: { borderRadius: Radius.card, padding: Spacing.lg, gap: Spacing.md },
  cardTitle: { fontSize: 18 },
  dayRow: { borderRadius: Radius.card, padding: Spacing.md, gap: Spacing.sm },
  stack: { gap: Spacing.sm },
  stackTight: { gap: Spacing.xs },
  row: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  grow: { flex: 1 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  wrapItem: { minWidth: '45%', flexGrow: 1 },
  gridItem: { width: '22%', flexGrow: 1 },
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  timeValue: {
    minHeight: 52,
    borderWidth: 2,
    borderRadius: Radius.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeText: { fontSize: 18 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, minHeight: 52 },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: { fontSize: 16, lineHeight: 20 },
  preview: { borderWidth: 2, borderRadius: Radius.card, padding: Spacing.lg, gap: Spacing.sm },
  previewDay: { gap: 2 },
  bold: { fontWeight: '600' },
  bar: {
    borderTopWidth: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    width: '100%',
    maxWidth: 700,
    alignSelf: 'center',
  },
});

// The owner's menu editor — extra ingredients ("Zutaten") and their prices.
//
// An extra is priced PER SIZE: extra cheese on a klein costs less than on a
// Blech. The columns this screen offers are the sizes the dishes themselves
// carry — the variant labels of every dish in a category that offers extras —
// because the server matches an extra's price to a dish by exactly that label.
// A price typed against a size no dish carries would silently never apply, so
// the form never lets one be typed.
//
// An empty price field means "not offered on this size". It never means free:
// a diner simply does not see that extra on that size.

import { useUIComponent } from '@qontinui/ui-bridge-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { AdminButton, AdminField, ConfirmAction, Notice } from '@/components/admin-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import {
  AdminApiError,
  adminApi,
  centsToInput,
  inputToCents,
  loadOwnerToken,
  type ExtraDraft,
} from '@/lib/admin';
import { errorReason } from '@/lib/api';
import { sizeKey } from '@/lib/extras';
import { formatEUR } from '@/lib/format';
import type { AdminMenu, AdminMenuExtra } from '@/lib/types';

/** The sizes the dishes that take extras are sold in, smallest first — the
 *  same "smallest is cheapest" order the server gives an extra's prices. */
function sizesOf(menu: AdminMenu): string[] {
  const offering = new Set(menu.categories.filter((c) => c.offersExtras).map((c) => c.id));
  const cheapest = new Map<string, { label: string; price: number }>();
  for (const item of menu.items) {
    if (!offering.has(item.categoryId)) continue;
    for (const v of item.variants) {
      const key = sizeKey(v.label);
      const seen = cheapest.get(key);
      if (!seen || v.price < seen.price) cheapest.set(key, { label: seen?.label ?? v.label, price: v.price });
    }
  }
  return [...cheapest.values()]
    .sort((a, b) => a.price - b.price || a.label.localeCompare(b.label, 'de'))
    .map((s) => s.label);
}

/** A size in the shape the menu's variant ids use: "groß 28cm" → "gross-28cm".
 *  Part of the UI Bridge id of that size's price field. */
function sizeSlug(size: string): string {
  return sizeKey(size)
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Every size ANY dish carries, whether or not its category offers extras —
 *  what decides whether a stored price's size still exists at all. */
function carriedSizeKeys(menu: AdminMenu): Set<string> {
  return new Set(menu.items.flatMap((i) => i.variants.map((v) => sizeKey(v.label))));
}

/** The form's state for one extra: text as typed, keyed by size. */
interface Form {
  /** `null` while creating a new extra. */
  id: string | null;
  name: string;
  codes: string;
  noAllergens: boolean;
  prices: Record<string, string>;
}

function emptyForm(): Form {
  return { id: null, name: '', codes: '', noAllergens: false, prices: {} };
}

/** Prices keyed by the menu's own spelling of each size, so a price stored as
 *  "Groß 28cm" fills the "groß 28cm" field instead of vanishing from it. */
function formFor(extra: AdminMenuExtra, sizes: string[]): Form {
  const prices: Record<string, string> = {};
  for (const p of extra.prices) {
    const label = sizes.find((s) => sizeKey(s) === sizeKey(p.size)) ?? p.size;
    prices[label] = centsToInput(p.price);
  }
  return {
    id: extra.id,
    name: extra.name,
    codes: extra.allergenCodes.join(', '),
    noAllergens: extra.allergenCodes.length === 0,
    prices,
  };
}

/** Turn the form into a request, or say in German why it cannot be one. */
function draftOf(form: Form, sizes: string[]): ExtraDraft | string {
  const name = form.name.trim();
  if (!name) return 'Bitte einen Namen für die Zutat angeben.';

  const allergenCodes = form.codes
    .split(/[\s,;]+/)
    .map((c) => c.trim())
    .filter(Boolean);
  if (allergenCodes.length === 0 && !form.noAllergens) {
    return (
      'Bitte die Allergen-Codes angeben (z. B. „g“ für Milch) — oder ausdrücklich ' +
      'bestätigen, dass die Zutat keine Allergene enthält.'
    );
  }

  const prices: ExtraDraft['prices'] = [];
  for (const size of sizes) {
    const typed = (form.prices[size] ?? '').trim();
    if (!typed) continue; // not offered on this size
    const cents = inputToCents(typed);
    if (cents === null) {
      return `„${typed}“ ist kein gültiger Preis für ${size}. Bitte z. B. 1,50 eingeben.`;
    }
    prices.push({ size, priceCents: cents });
  }

  return {
    name,
    allergenCodes,
    ...(allergenCodes.length === 0 ? { confirmNoAllergens: true } : {}),
    prices,
  };
}

export default function AdminExtrasScreen() {
  const [menu, setMenu] = useState<AdminMenu | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Form | null>(null);

  const menuRef = useRef<AdminMenu | null>(null);

  const load = useCallback(async () => {
    try {
      await loadOwnerToken();
      const next = await adminApi.getMenu();
      menuRef.current = next;
      setMenu(next);
      setError(null);
    } catch (e) {
      if (e instanceof AdminApiError && e.status === 401) {
        setError('Bitte zuerst im Speisekarten-Editor anmelden.');
      } else {
        setError(errorReason(e));
      }
    }
  }, []);

  // Scheduled rather than called from the effect body — see allergene.tsx.
  useEffect(() => {
    const first = setTimeout(load, 0);
    return () => clearTimeout(first);
  }, [load]);

  const run = useCallback(
    async (action: () => Promise<unknown>): Promise<boolean> => {
      setBusy(true);
      try {
        await action();
        setError(null);
        await load();
        return true;
      } catch (e) {
        setError(errorReason(e));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  const sizes = useMemo(() => (menu ? sizesOf(menu) : []), [menu]);
  const carried = useMemo(() => (menu ? carriedSizeKeys(menu) : new Set<string>()), [menu]);

  useUIComponent({
    id: 'admin-extras',
    name: 'Extra-Zutaten',
    actions: [
      {
        id: 'getExtras',
        label: 'Report the extras and their per-size prices as the editor sees them',
        description:
          'No params. Returns { sizes: string[], categoriesWithExtras: string[], ' +
          'extras: [{ id, name, available, allergenCodes, prices: [{ size, price }] }] }. ' +
          'Prices are integer cents.',
        handler: async () => {
          const current = menuRef.current;
          return {
            sizes: current ? sizesOf(current) : [],
            categoriesWithExtras: (current?.categories ?? [])
              .filter((c) => c.offersExtras)
              .map((c) => c.id),
            extras: (current?.extras ?? []).map((e) => ({
              id: e.id,
              name: e.name,
              available: e.available,
              allergenCodes: e.allergenCodes,
              prices: e.prices,
            })),
          };
        },
      },
    ],
  });

  if (!menu) {
    return (
      <ThemedView style={styles.center}>
        {error ? (
          <Notice tone="error" title="Nicht geladen">
            <ThemedText type="small" themeColor="textSecondary">
              {error}
            </ThemedText>
          </Notice>
        ) : (
          <ActivityIndicator />
        )}
      </ThemedView>
    );
  }

  const offering = menu.categories.filter((c) => c.offersExtras);

  function save(current: Form) {
    // A size the extra is priced for that no dish carries any more (a
    // renamed size) stays in the form, so saving never drops it unseen.
    const formSizes = [...sizes];
    for (const size of Object.keys(current.prices)) {
      if (!formSizes.some((s) => sizeKey(s) === sizeKey(size))) formSizes.push(size);
    }
    const draft = draftOf(current, formSizes);
    if (typeof draft === 'string') {
      setError(draft);
      return;
    }
    run(() =>
      current.id
        ? adminApi.updateExtra(current.id, draft)
        : adminApi.createExtra({ ...draft, sortOrder: menu?.extras?.length ?? 0 }),
    ).then((ok) => {
      if (ok) setForm(null);
    });
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <ThemedText type="subtitle">Extra-Zutaten</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Zutaten, die Gäste zu einem Gericht dazubestellen können — mit einem
          eigenen Preis für jede Größe. Der Aufpreis wird zum Preis des Gerichts
          addiert. Ein leeres Preisfeld heißt: für diese Größe nicht erhältlich.
        </ThemedText>

        {error ? (
          <Notice tone="error" title="Nicht gespeichert">
            <ThemedText type="small" themeColor="textSecondary">
              {error}
            </ThemedText>
          </Notice>
        ) : null}

        {offering.length === 0 ? (
          <Notice tone="warning" title="Keine Kategorie bietet Extra-Zutaten an">
            <ThemedText type="small" themeColor="textSecondary">
              Gäste sehen die Zutaten erst, wenn eine Kategorie sie anbietet. Das
              lässt sich im Speisekarten-Editor bei jeder Kategorie einschalten.
            </ThemedText>
          </Notice>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            Angeboten bei: {offering.map((c) => c.label).join(', ')}. Größen:{' '}
            {sizes.join(', ') || '—'}.
          </ThemedText>
        )}

        {(menu.extras ?? []).map((extra) =>
          form?.id === extra.id ? (
            <ExtraForm
              key={extra.id}
              form={form}
              sizes={sizes}
              carried={carried}
              busy={busy}
              onChange={setForm}
              onSave={() => save(form)}
              onCancel={() => setForm(null)}
            />
          ) : (
            <ThemedView key={extra.id} type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold">
                {extra.name}
                {extra.available ? '' : '  ·  ausgeblendet'}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {extra.allergenCodes.length === 0
                  ? 'Allergene: keine (bestätigt)'
                  : `Allergene: ${extra.allergenCodes.join(', ')}`}
              </ThemedText>
              <ThemedText type="small">
                {extra.prices.length === 0
                  ? 'Noch kein Preis'
                  : extra.prices.map((p) => `${p.size}: + ${formatEUR(p.price)}`).join('  ·  ')}
              </ThemedText>
              {sizes.some((s) => !extra.prices.some((p) => sizeKey(p.size) === sizeKey(s))) ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Nicht erhältlich für:{' '}
                  {sizes
                    .filter((s) => !extra.prices.some((p) => sizeKey(p.size) === sizeKey(s)))
                    .join(', ')}
                </ThemedText>
              ) : null}
              <View style={styles.row}>
                <View style={styles.grow}>
                  <AdminButton
                    uiId={`admin-extra-edit-${extra.id}`}
                    uiLabel={`${extra.name} bearbeiten`}
                    title="Bearbeiten"
                    onPress={() => setForm(formFor(extra, sizes))}
                  />
                </View>
                <View style={styles.grow}>
                  <AdminButton
                    uiId={`admin-extra-available-${extra.id}`}
                    uiLabel={extra.available ? `${extra.name} ausblenden` : `${extra.name} anbieten`}
                    title={extra.available ? 'Ausblenden' : 'Wieder anbieten'}
                    busy={busy}
                    onPress={() =>
                      run(() => adminApi.updateExtra(extra.id, { available: !extra.available }))
                    }
                  />
                </View>
                <View style={styles.grow}>
                  <ConfirmAction
                    uiId={`admin-extra-delete-${extra.id}`}
                    title="Löschen"
                    question={`„${extra.name}“ wirklich löschen? Bereits bestellte Gerichte behalten ihren Preis.`}
                    confirmTitle="Ja, löschen"
                    busy={busy}
                    onConfirm={() => run(() => adminApi.deleteExtra(extra.id))}
                  />
                </View>
              </View>
            </ThemedView>
          ),
        )}

        {form && form.id === null ? (
          <ExtraForm
            form={form}
            sizes={sizes}
            carried={carried}
            busy={busy}
            onChange={setForm}
            onSave={() => save(form)}
            onCancel={() => setForm(null)}
          />
        ) : (
          <AdminButton
            uiId="admin-extra-new"
            title="+ Zutat hinzufügen"
            tone="primary"
            disabled={sizes.length === 0}
            onPress={() => {
              setError(null);
              setForm(emptyForm());
            }}
          />
        )}

        <View style={{ height: Spacing.xxxl }} />
      </ScrollView>
    </ThemedView>
  );
}

/** Name, allergens and one price field per size, for a new or an existing
 *  extra. */
function ExtraForm({
  form,
  sizes,
  carried,
  busy,
  onChange,
  onSave,
  onCancel,
}: {
  form: Form;
  sizes: string[];
  /** Size keys some dish carries — see `carriedSizeKeys`. */
  carried: Set<string>;
  busy: boolean;
  onChange: (next: Form) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const slug = form.id ?? 'new';
  // Prices for sizes outside the columns stay visible so saving never drops
  // them unseen. Only a size NO dish carries is flagged as gone; one whose
  // category merely has extras switched off is labelled as such.
  const others = Object.keys(form.prices).filter(
    (size) => !sizes.some((s) => sizeKey(s) === sizeKey(size)),
  );
  const labelFor = (size: string) =>
    !others.includes(size)
      ? size
      : carried.has(sizeKey(size))
        ? `${size} (Kategorie ohne Extra-Zutaten)`
        : `${size} (steht bei keinem Gericht mehr)`;

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">{form.id ? 'Zutat bearbeiten' : 'Neue Zutat'}</ThemedText>
      <AdminField
        uiId={`admin-extra-name-${slug}`}
        label="Name (deutsch)"
        hint="So steht es beim Gast, z. B. „Käse“ oder „Salami“."
        value={form.name}
        onChangeText={(name) => onChange({ ...form, name })}
      />
      <AdminField
        uiId={`admin-extra-allergens-${slug}`}
        label="Allergen-Codes"
        hint="Wie auf der Karte, durch Komma getrennt, z. B. „g“ für Milch."
        value={form.codes}
        autoCapitalize="none"
        onChangeText={(codes) => onChange({ ...form, codes })}
      />
      {form.codes.trim() === '' ? (
        <AdminButton
          uiId={`admin-extra-no-allergens-${slug}`}
          title={
            form.noAllergens
              ? '✓ Bestätigt: enthält keine Allergene'
              : 'Enthält keine Allergene — bestätigen'
          }
          onPress={() => onChange({ ...form, noAllergens: !form.noAllergens })}
        />
      ) : null}

      <ThemedText type="smallBold">Aufpreis je Größe</ThemedText>
      {[...sizes, ...others].map((size) => (
        <AdminField
          key={size}
          uiId={`admin-extra-price-${slug}-${sizeSlug(size)}`}
          label={labelFor(size)}
          placeholder="nicht erhältlich"
          keyboardType="decimal-pad"
          value={form.prices[size] ?? ''}
          invalid={
            (form.prices[size] ?? '').trim() !== '' && inputToCents(form.prices[size] ?? '') === null
          }
          onChangeText={(text) => onChange({ ...form, prices: { ...form.prices, [size]: text } })}
        />
      ))}

      <View style={styles.row}>
        <View style={styles.grow}>
          <AdminButton
            uiId={`admin-extra-save-${slug}`}
            title="Speichern"
            tone="primary"
            busy={busy}
            onPress={onSave}
          />
        </View>
        <View style={styles.grow}>
          <AdminButton uiId={`admin-extra-cancel-${slug}`} title="Abbrechen" onPress={onCancel} />
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  scroll: {
    padding: Spacing.lg,
    gap: Spacing.lg,
    width: '100%',
    maxWidth: 700,
    alignSelf: 'center',
  },
  card: { borderRadius: Radius.card, padding: Spacing.lg, gap: Spacing.sm },
  row: { flexDirection: 'row', gap: Spacing.sm },
  grow: { flex: 1 },
});

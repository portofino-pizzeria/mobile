// The owner's menu editor — one dish.
//
// Everything a diner reads about this dish is on this screen: the number, the
// German name, the description, every size with its own price, and the allergen
// codes. Two rules shape the layout:
//
//   * Saving a dish with NO allergen information is a deliberate act, so it is
//     rendered as its own question with its own button — never a checkbox you
//     tab past, and never the quiet result of a form that forgot the field. The
//     save button stays disabled until the owner has either picked codes or
//     confirmed there are none.
//   * A price belongs to a size. There is no "the price" field, because most
//     dishes on this menu have two or three.
//
// The route id `neu` opens the screen for a new dish; `?kategorie=<id>`
// preselects the category, which is how "Gericht hinzufügen" from an empty
// category arrives here.

import { useUIComponent } from '@qontinui/ui-bridge-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import {
  AdminButton,
  AdminField,
  ConfirmAction,
  Notice,
} from '@/components/admin-ui';
import { BridgeButton } from '@/components/bridge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  AdminApiError,
  adminApi,
  centsToInput,
  inputToCents,
  loadOwnerToken,
  type ItemDraft,
  type VariantDraft,
} from '@/lib/admin';
import type { AdminMenu, AllergenLegendEntry } from '@/lib/types';

/** The literal route id that means "this dish does not exist yet". */
const NEW_ITEM = 'neu';

interface VariantRow {
  /** Stable key for React; not sent to the API. */
  key: string;
  /** Present for a size that already exists, so its id survives the edit. */
  id?: string;
  label: string;
  price: string;
}

let rowCounter = 0;
function newRow(label = '', price = ''): VariantRow {
  rowCounter += 1;
  return { key: `row-${rowCounter}`, label, price };
}

export default function AdminItemScreen() {
  const router = useRouter();
  const theme = useTheme();
  const params = useLocalSearchParams<{ id: string; kategorie?: string }>();
  const itemId = params.id;
  const isNew = itemId === NEW_ITEM;

  const [menu, setMenu] = useState<AdminMenu | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [number, setNumber] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [available, setAvailable] = useState(true);
  const [variants, setVariants] = useState<VariantRow[]>([newRow()]);
  const [allergenCodes, setAllergenCodes] = useState<string[]>([]);
  const [confirmedNoAllergens, setConfirmedNoAllergens] = useState(false);

  /** Set once the form has been filled from the stored dish, so a later
   *  refresh updates the categories and the allergen legend without throwing
   *  away what the owner has typed. */
  const hydrated = useRef(false);

  const refresh = useCallback(async () => {
    try {
      await loadOwnerToken();
      const next = await adminApi.getMenu();
      setMenu(next);
      setError(null);

      if (hydrated.current) return;
      hydrated.current = true;

      if (isNew) {
        const preselected = params.kategorie ?? next.categories[0]?.id ?? '';
        setCategoryId(preselected);
        return;
      }

      const item = next.items.find((i) => i.id === itemId);
      if (!item) {
        setError(`Es gibt kein Gericht mit der Kennung „${itemId}“.`);
        return;
      }
      setNumber(item.number ?? '');
      setName(item.name);
      setDescription(item.description);
      setCategoryId(item.categoryId);
      setAvailable(item.available);
      setAllergenCodes([...item.allergenCodes]);
      setVariants(
        item.variants.length > 0
          ? item.variants.map((v) => ({
              ...newRow(v.label, centsToInput(v.price)),
              id: v.id,
            }))
          : [newRow()],
      );
    } catch (e) {
      if (e instanceof AdminApiError && e.status === 401) {
        setError('Bitte zuerst im Speisekarten-Editor anmelden.');
      } else {
        setError((e as Error).message);
      }
    }
  }, [isNew, itemId, params.kategorie]);

  // On focus, not just on mount: the owner can step out to "Allergene
  // verwalten", add the code they were missing, and come straight back — the
  // new code has to be on the chip list when they do. `hydrated` keeps that
  // refresh from resetting the half-filled form. The timeout is the same
  // async-boundary dance `kitchen.tsx` uses.
  useFocusEffect(
    useCallback(() => {
      const first = setTimeout(refresh, 0);
      return () => clearTimeout(first);
    }, [refresh]),
  );

  // Picking any allergen retracts a previous "no allergens" confirmation, so
  // the two can never both be true.
  const toggleCode = useCallback((code: string) => {
    setConfirmedNoAllergens(false);
    setAllergenCodes((current) =>
      current.includes(code) ? current.filter((c) => c !== code) : [...current, code],
    );
  }, []);

  const buildDraft = useCallback((): ItemDraft | string => {
    if (!name.trim()) return 'Bitte einen Namen für das Gericht eingeben.';
    if (!categoryId) return 'Bitte eine Kategorie wählen.';

    const rows = variants.filter((v) => v.label.trim() || v.price.trim());
    const out: VariantDraft[] = [];
    for (const [index, row] of rows.entries()) {
      const label = row.label.trim();
      if (!label) {
        return `Zeile ${index + 1}: Bitte eine Bezeichnung eingeben (z. B. „klein“, „groß“).`;
      }
      const cents = inputToCents(row.price);
      if (cents === null) {
        return `„${label}“: Bitte einen Preis wie 7,90 eingeben.`;
      }
      out.push({ ...(row.id ? { id: row.id } : {}), label, priceCents: cents, sortOrder: index });
    }

    if (allergenCodes.length === 0 && !confirmedNoAllergens) {
      return 'Bitte Allergene auswählen — oder ausdrücklich bestätigen, dass dieses Gericht keine enthält.';
    }

    return {
      number: number.trim() || null,
      name: name.trim(),
      description: description.trim(),
      categoryId,
      allergenCodes,
      ...(allergenCodes.length === 0 ? { confirmNoAllergens: true } : {}),
      ...(isNew ? { available } : {}),
      variants: out,
    };
  }, [
    allergenCodes,
    available,
    categoryId,
    confirmedNoAllergens,
    description,
    isNew,
    name,
    number,
    variants,
  ]);

  const save = useCallback(async () => {
    const draft = buildDraft();
    if (typeof draft === 'string') {
      setError(draft);
      return;
    }
    setBusy(true);
    try {
      if (isNew) await adminApi.createItem(draft);
      else await adminApi.updateItem(itemId, draft);
      setError(null);
      router.back();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [buildDraft, isNew, itemId, router]);

  // The UI Bridge handlers below are registered once, so reading state
  // directly would capture the values from the first render. This ref is
  // refreshed after every render and is what the handlers read.
  const live = useRef({ buildDraft, save, allergenCodes, name, categoryId, variants, confirmedNoAllergens });
  useEffect(() => {
    live.current = { buildDraft, save, allergenCodes, name, categoryId, variants, confirmedNoAllergens };
  });

  useUIComponent({
    id: 'admin-item',
    name: 'Gericht bearbeiten',
    actions: [
      {
        id: 'getItemDraft',
        label: 'Report the dish currently being edited',
        description:
          'No params. Returns { itemId, isNew, name, categoryId, variants, ' +
          'allergenCodes, confirmedNoAllergens, canSave, error }.',
        handler: async () => {
          const current = live.current;
          const draft = current.buildDraft();
          return {
            itemId,
            isNew,
            name: current.name,
            categoryId: current.categoryId,
            variants: current.variants.map((v) => ({ label: v.label, price: v.price })),
            allergenCodes: current.allergenCodes,
            confirmedNoAllergens: current.confirmedNoAllergens,
            canSave: typeof draft !== 'string',
            error: typeof draft === 'string' ? draft : null,
          };
        },
      },
      {
        id: 'save',
        label: 'Save the dish',
        description:
          'No params. Runs the same validation the Speichern button does and ' +
          'refuses with the German reason if the form is not saveable.',
        handler: async () => {
          const draft = live.current.buildDraft();
          if (typeof draft === 'string') throw new Error(draft);
          await live.current.save();
          return { saved: true };
        },
      },
      {
        id: 'confirmNoAllergens',
        label: 'Confirm this dish contains no allergens',
        description:
          'No params. The deliberate act the API requires before an empty ' +
          'allergen list can be stored. Refuses while codes are selected.',
        handler: async () => {
          if (live.current.allergenCodes.length > 0) {
            throw new Error(
              'confirmNoAllergens: es sind Allergene ausgewählt — bitte erst abwählen.',
            );
          }
          setConfirmedNoAllergens(true);
          return { confirmed: true };
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

  // Every code the legend knows, plus any code this dish already carries that
  // the legend does not — an inherited unresolved code stays selectable and
  // re-savable rather than disappearing from the form.
  const legend: AllergenLegendEntry[] = [...menu.allergenLegend];
  for (const code of allergenCodes) {
    if (!legend.some((e) => e.code === code)) {
      legend.push({ code, label: 'unbekannt', resolved: false });
    }
  }

  const categories = [...menu.categories].sort((a, b) => a.sortOrder - b.sortOrder);
  const canSave = typeof buildDraft() !== 'string';

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <ThemedText type="subtitle">
          {isNew ? 'Neues Gericht' : name || 'Gericht bearbeiten'}
        </ThemedText>

        {error ? (
          <Notice tone="error" title="Nicht gespeichert">
            <ThemedText type="small" themeColor="textSecondary">
              {error}
            </ThemedText>
          </Notice>
        ) : null}

        <AdminField
          uiId="admin-item-name"
          label="Name"
          hint="Wie das Gericht auf der Karte steht."
          value={name}
          onChangeText={setName}
          placeholder="z. B. Margherita"
        />

        <AdminField
          uiId="admin-item-number"
          label="Nummer (optional)"
          hint="Die Nummer auf der Karte, z. B. 1 oder 76a. Leer lassen, wenn keine da ist."
          value={number}
          onChangeText={setNumber}
          autoCapitalize="none"
        />

        <AdminField
          uiId="admin-item-description"
          label="Beschreibung (optional)"
          hint="Die Zutaten, so wie sie auf der Karte stehen."
          value={description}
          onChangeText={setDescription}
          placeholder="z. B. Tomaten, Käse, frisches Basilikum"
        />

        {/* Category ------------------------------------------------------- */}
        <View style={styles.block}>
          <ThemedText type="smallBold">Kategorie</ThemedText>
          <View style={styles.chips}>
            {categories.map((category) => {
              const selected = category.id === categoryId;
              return (
                <BridgeButton
                  key={category.id}
                  uiId={`admin-item-category-${category.id}`}
                  uiLabel={`Kategorie ${category.label} wählen`}
                  onPress={() => setCategoryId(category.id)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: selected ? theme.text : 'transparent',
                      borderColor: selected ? theme.text : theme.backgroundSelected,
                    },
                  ]}>
                  <ThemedText
                    type="smallBold"
                    style={{ color: selected ? theme.background : theme.text }}>
                    {category.label}
                  </ThemedText>
                </BridgeButton>
              );
            })}
          </View>
        </View>

        {/* Sizes and prices ----------------------------------------------- */}
        <View style={styles.block}>
          <ThemedText type="smallBold">Größen und Preise</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Jede Größe hat ihren eigenen Preis. Ein Gericht mit nur einem Preis
            bekommt eine einzige Zeile.
          </ThemedText>

          {variants.map((row, index) => (
            <ThemedView key={row.key} type="backgroundElement" style={styles.variantCard}>
              <AdminField
                uiId={`admin-variant-label-${index}`}
                label={`Größe ${index + 1}`}
                value={row.label}
                onChangeText={(next) =>
                  setVariants((rows) =>
                    rows.map((r) => (r.key === row.key ? { ...r, label: next } : r)),
                  )
                }
                placeholder="z. B. klein, groß, Blech, Schwein"
              />
              <AdminField
                uiId={`admin-variant-price-${index}`}
                label="Preis in Euro"
                value={row.price}
                onChangeText={(next) =>
                  setVariants((rows) =>
                    rows.map((r) => (r.key === row.key ? { ...r, price: next } : r)),
                  )
                }
                placeholder="7,90"
                keyboardType="decimal-pad"
                autoCapitalize="none"
                invalid={row.price.trim().length > 0 && inputToCents(row.price) === null}
              />
              {variants.length > 1 ? (
                <AdminButton
                  uiId={`admin-variant-remove-${index}`}
                  title="Diese Größe entfernen"
                  onPress={() =>
                    setVariants((rows) => rows.filter((r) => r.key !== row.key))
                  }
                />
              ) : null}
            </ThemedView>
          ))}

          <AdminButton
            uiId="admin-variant-add"
            title="+ Größe hinzufügen"
            onPress={() => setVariants((rows) => [...rows, newRow()])}
          />
        </View>

        {/* Allergens ------------------------------------------------------ */}
        <View style={styles.block}>
          <ThemedText type="smallBold">Allergene</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Bitte alle Codes auswählen, die auf der Karte bei diesem Gericht stehen.
          </ThemedText>

          <View style={styles.chips}>
            {legend.map((entry) => {
              const selected = allergenCodes.includes(entry.code);
              return (
                <BridgeButton
                  key={entry.code}
                  uiId={`admin-allergen-${entry.code}`}
                  uiLabel={`Allergen ${entry.code} (${entry.label})`}
                  onPress={() => toggleCode(entry.code)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: selected ? theme.text : 'transparent',
                      borderColor: selected ? theme.text : theme.backgroundSelected,
                    },
                  ]}>
                  <ThemedText
                    type="smallBold"
                    style={{ color: selected ? theme.background : theme.text }}>
                    {entry.code} — {entry.label}
                    {entry.resolved ? '' : ' (?)'}
                  </ThemedText>
                </BridgeButton>
              );
            })}
          </View>

          <AdminButton
            uiId="admin-item-open-allergens"
            title="Code fehlt? Allergene verwalten"
            onPress={() => router.push('/admin/allergene')}
          />

          {allergenCodes.length === 0 ? (
            confirmedNoAllergens ? (
              <Notice tone="ok" title="Bestätigt: keine Allergene">
                <ThemedText type="small" themeColor="textSecondary">
                  Dieses Gericht wird ohne Allergenangaben gespeichert.
                </ThemedText>
                <AdminButton
                  uiId="admin-item-no-allergens-undo"
                  title="Rückgängig"
                  onPress={() => setConfirmedNoAllergens(false)}
                />
              </Notice>
            ) : (
              <Notice tone="warning" title="Keine Allergene ausgewählt">
                <ThemedText type="small" themeColor="textSecondary">
                  Ohne Angabe steht bei diesem Gericht später nichts über Allergene.
                  Das lässt sich speichern — aber nur ausdrücklich, damit es nicht
                  aus Versehen passiert.
                </ThemedText>
                <AdminButton
                  uiId="admin-item-no-allergens-confirm"
                  title="Dieses Gericht enthält keine Allergene"
                  onPress={() => setConfirmedNoAllergens(true)}
                />
              </Notice>
            )
          ) : null}
        </View>

        {/* Availability --------------------------------------------------- */}
        <View style={styles.block}>
          <ThemedText type="smallBold">Auf der Karte</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {available
              ? 'Gäste sehen dieses Gericht und können es bestellen.'
              : 'Dieses Gericht ist zurzeit ausgeblendet.'}
          </ThemedText>
          {isNew ? (
            <AdminButton
              uiId="admin-item-available-toggle"
              title={available ? 'Erst einmal ausblenden' : 'Doch anzeigen'}
              onPress={() => setAvailable((v) => !v)}
            />
          ) : (
            <AdminButton
              uiId="admin-item-available-toggle"
              title={available ? 'Ausverkauft — ausblenden' : 'Wieder anzeigen'}
              busy={busy}
              onPress={async () => {
                setBusy(true);
                try {
                  const updated = await adminApi.setAvailable(itemId, !available);
                  setAvailable(updated.available);
                  setError(null);
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            />
          )}
        </View>

        {/* Save / delete -------------------------------------------------- */}
        <AdminButton
          uiId="admin-item-save"
          title={isNew ? 'Gericht anlegen' : 'Änderungen speichern'}
          tone="primary"
          disabled={!canSave}
          busy={busy}
          onPress={save}
        />

        {!isNew ? (
          <ConfirmAction
            uiId="admin-item-delete"
            title="Gericht löschen"
            question={`„${name}“ wirklich von der Karte löschen? Bereits aufgegebene Bestellungen bleiben unverändert.`}
            confirmTitle="Ja, löschen"
            busy={busy}
            onConfirm={async () => {
              setBusy(true);
              try {
                await adminApi.deleteItem(itemId);
                router.back();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          />
        ) : null}

        <AdminButton uiId="admin-item-back" title="Zurück" onPress={() => router.back()} />

        <View style={{ height: Spacing.six }} />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  scroll: {
    padding: Spacing.three,
    gap: Spacing.three,
    width: '100%',
    maxWidth: 700,
    alignSelf: 'center',
  },
  block: { gap: Spacing.two },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  chip: {
    minHeight: 48,
    paddingHorizontal: Spacing.three,
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
  },
  variantCard: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
});

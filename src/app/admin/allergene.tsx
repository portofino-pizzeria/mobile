// The owner's menu editor — the allergen legend.
//
// The legend is what turns a letter printed on the card into words a diner can
// act on. Two things about it are deliberate and worth keeping:
//
//   * A code with no entry here is NOT an error and is never removed from a
//     dish. It shows as „unbekannt“ on the menu, which is honest; deleting it
//     would be the silent omission this whole surface exists to prevent. This
//     screen therefore says how many dishes still print a code before letting
//     its label be deleted.
//   * Adding an entry here is the one step that lets the dish editor accept a
//     letter it has never seen — which is how the editor can refuse a typo
//     without ever refusing a real allergen.

import { useUIComponent } from '@qontinui/ui-bridge-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { AdminButton, AdminField, ConfirmAction, Notice } from '@/components/admin-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { AdminApiError, adminApi, loadOwnerToken } from '@/lib/admin';
import type { AdminMenu } from '@/lib/types';

export default function AdminAllergensScreen() {
  const [menu, setMenu] = useState<AdminMenu | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [newCode, setNewCode] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');

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
        setError((e as Error).message);
      }
    }
  }, []);

  // `load` only ever sets state after an await, but the lint rule cannot see
  // past the async boundary — so the first load is scheduled rather than called
  // straight out of the effect body (the precedent is `kitchen.tsx`).
  useEffect(() => {
    const first = setTimeout(load, 0);
    return () => clearTimeout(first);
  }, [load]);

  const run = useCallback(
    async (action: () => Promise<unknown>) => {
      setBusy(true);
      try {
        await action();
        setError(null);
        await load();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  useUIComponent({
    id: 'admin-allergens',
    name: 'Allergene',
    actions: [
      {
        id: 'getLegend',
        label: 'Report the allergen legend as the editor sees it',
        description:
          'No params. Returns { entries: [{ code, label, resolved, usedBy }] }.',
        handler: async () => {
          const current = menuRef.current;
          return {
            entries: (current?.allergenLegend ?? []).map((entry) => ({
              code: entry.code,
              label: entry.label,
              resolved: entry.resolved,
              usedBy: (current?.items ?? [])
                .filter((i) => i.allergenCodes.includes(entry.code))
                .map((i) => i.id),
            })),
          };
        },
      },
      {
        id: 'addAllergen',
        label: 'Add or relabel one legend entry',
        description: 'Params: { code: string, labelDe: string, labelEn?: string }.',
        handler: async (params) => {
          const { code, labelDe, labelEn } = (params ?? {}) as {
            code?: string;
            labelDe?: string;
            labelEn?: string;
          };
          if (!code) throw new Error('addAllergen: code is required.');
          if (!labelDe) throw new Error('addAllergen: labelDe is required.');
          await adminApi.saveAllergen({ code, labelDe, labelEn: labelEn ?? null });
          await load();
          return { code };
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

  function usedBy(code: string): string[] {
    return (menu?.items ?? [])
      .filter((i) => i.allergenCodes.includes(code))
      .map((i) => i.name);
  }

  const unresolved = menu.allergenLegend.filter((e) => !e.resolved);

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <ThemedText type="subtitle">Allergene</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Diese Liste erklärt die Buchstaben und Ziffern, die auf der Karte hinter
          den Gerichten stehen. Gäste lesen genau diese Bezeichnungen.
        </ThemedText>

        {error ? (
          <Notice tone="error" title="Nicht gespeichert">
            <ThemedText type="small" themeColor="textSecondary">
              {error}
            </ThemedText>
          </Notice>
        ) : null}

        {unresolved.length > 0 ? (
          <Notice tone="warning" title="Ohne Bezeichnung">
            <ThemedText type="small" themeColor="textSecondary">
              Für {unresolved.map((e) => e.code).join(', ')} ist keine Bezeichnung
              hinterlegt. Der Code bleibt beim Gericht stehen und Gäste sehen
              „unbekannt“ — bitte unten ergänzen, sobald die Bedeutung feststeht.
            </ThemedText>
          </Notice>
        ) : null}

        {menu.allergenLegend.map((entry) => {
          const dishes = usedBy(entry.code);
          const isEditing = editing === entry.code;

          return (
            <ThemedView key={entry.code} type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold" style={styles.code}>
                {entry.code}
              </ThemedText>

              {isEditing ? (
                <View style={styles.stack}>
                  <AdminField
                    uiId={`admin-allergen-label-${entry.code}`}
                    label="Bezeichnung (deutsch)"
                    value={editLabel}
                    onChangeText={setEditLabel}
                  />
                  <View style={styles.row}>
                    <View style={styles.grow}>
                      <AdminButton
                        uiId={`admin-allergen-save-${entry.code}`}
                        title="Speichern"
                        tone="primary"
                        busy={busy}
                        onPress={() =>
                          run(async () => {
                            await adminApi.saveAllergen({
                              code: entry.code,
                              labelDe: editLabel.trim(),
                              ...(entry.labelEn ? { labelEn: entry.labelEn } : {}),
                            });
                            setEditing(null);
                          })
                        }
                      />
                    </View>
                    <View style={styles.grow}>
                      <AdminButton
                        uiId={`admin-allergen-cancel-${entry.code}`}
                        title="Abbrechen"
                        onPress={() => setEditing(null)}
                      />
                    </View>
                  </View>
                </View>
              ) : (
                <>
                  <ThemedText type="small">
                    {entry.label}
                    {entry.resolved ? '' : '  (keine Bezeichnung hinterlegt)'}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {dishes.length === 0
                      ? 'Steht bei keinem Gericht.'
                      : `Steht bei ${dishes.length} ${
                          dishes.length === 1 ? 'Gericht' : 'Gerichten'
                        }: ${dishes.slice(0, 4).join(', ')}${dishes.length > 4 ? ' …' : ''}`}
                  </ThemedText>
                  <View style={styles.row}>
                    <View style={styles.grow}>
                      <AdminButton
                        uiId={`admin-allergen-edit-${entry.code}`}
                        title="Bezeichnung ändern"
                        onPress={() => {
                          setEditing(entry.code);
                          setEditLabel(entry.resolved ? entry.label : '');
                        }}
                      />
                    </View>
                    {entry.resolved ? (
                      <View style={styles.grow}>
                        <ConfirmAction
                          uiId={`admin-allergen-delete-${entry.code}`}
                          title="Bezeichnung löschen"
                          question={
                            dishes.length === 0
                              ? `Die Bezeichnung für „${entry.code}“ wirklich löschen?`
                              : `„${entry.code}“ steht noch bei ${dishes.length} ${
                                  dishes.length === 1 ? 'Gericht' : 'Gerichten'
                                }. Der Code bleibt dort stehen — Gäste sehen dann „unbekannt“. Trotzdem löschen?`
                          }
                          confirmTitle="Ja, löschen"
                          busy={busy}
                          onConfirm={() => run(() => adminApi.deleteAllergen(entry.code))}
                        />
                      </View>
                    ) : null}
                  </View>
                </>
              )}
            </ThemedView>
          );
        })}

        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold">Neues Allergen</ThemedText>
          <AdminField
            uiId="admin-allergen-new-code"
            label="Code"
            hint="Genau wie auf der Karte, z. B. a, g oder 1."
            value={newCode}
            onChangeText={setNewCode}
            autoCapitalize="none"
          />
          <AdminField
            uiId="admin-allergen-new-label"
            label="Bezeichnung (deutsch)"
            hint="z. B. Glutenhaltiges Getreide"
            value={newLabel}
            onChangeText={setNewLabel}
          />
          <AdminButton
            uiId="admin-allergen-new-save"
            title="Allergen anlegen"
            tone="primary"
            busy={busy}
            disabled={newCode.trim().length === 0 || newLabel.trim().length === 0}
            onPress={() =>
              run(async () => {
                await adminApi.saveAllergen({
                  code: newCode.trim(),
                  labelDe: newLabel.trim(),
                  sortOrder: menu.allergenLegend.length,
                });
                setNewCode('');
                setNewLabel('');
              })
            }
          />
        </ThemedView>

        <View style={{ height: Spacing.xxxl }} />
      </ScrollView>
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
  code: { fontSize: 20 },
  stack: { gap: Spacing.sm },
  row: { flexDirection: 'row', gap: Spacing.sm },
  grow: { flex: 1 },
});

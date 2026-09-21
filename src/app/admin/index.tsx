// The owner's menu editor — overview.
//
// One screen that answers "what is on my menu right now, and where do I change
// it". German throughout, one column, big targets, and every destructive action
// asked twice.
//
// The three empty categories (Hähnchenbrust, Rumpsteak, Dessert) are real
// headings on Portofino's own website with nothing under them — there is
// nothing to harvest, so this screen is the only route to that content. An
// empty category therefore gets a prominent "Gericht hinzufügen", not a
// grey "nothing here".

import { useUIComponent } from '@qontinui/ui-bridge-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import {
  AdminButton,
  AdminField,
  ConfirmAction,
  Notice,
} from '@/components/admin-ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { AdminApiError, adminApi, loadOwnerToken, setOwnerToken } from '@/lib/admin';
import { errorReason } from '@/lib/api';
import { formatEUR } from '@/lib/format';
import type { AdminMenu, AdminMenuItem } from '@/lib/types';

function priceSummary(item: AdminMenuItem): string {
  if (item.variants.length === 0) return 'Kein Preis — nicht bestellbar';
  return item.variants
    .map((v) => `${v.label} ${formatEUR(v.price)}`)
    .join('  ·  ');
}

export default function AdminMenuScreen() {
  const router = useRouter();
  const theme = useTheme();

  const [menu, setMenu] = useState<AdminMenu | null>(null);
  const [needsToken, setNeedsToken] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const menuRef = useRef<AdminMenu | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  /** Where the menu overview starts inside the scroll content. */
  const menuHeadingY = useRef(0);

  const load = useCallback(async () => {
    try {
      const next = await adminApi.getMenu();
      menuRef.current = next;
      setMenu(next);
      setNeedsToken(false);
      setError(null);
    } catch (e) {
      if (e instanceof AdminApiError && e.status === 401) {
        setNeedsToken(true);
        setError(e.message);
      } else {
        setError(errorReason(e));
      }
    }
  }, []);

  // On focus rather than on mount: expo-router keeps this screen mounted while
  // the dish editor is on top of it, so a mount-only load would show a stale
  // menu the moment the owner saves something and comes back.
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

  const run = useCallback(
    async (action: () => Promise<unknown>) => {
      setBusy(true);
      try {
        await action();
        setError(null);
        await load();
      } catch (e) {
        setError(errorReason(e));
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  // Semantic actions for the Qontinui runner.
  useUIComponent({
    id: 'admin-menu',
    name: 'Speisekarten-Editor',
    actions: [
      {
        id: 'signIn',
        label: 'Sign the owner in to the menu editor',
        description: 'Params: { token: string }. Stores the owner credential and reloads.',
        handler: async (params) => {
          const { token } = (params ?? {}) as { token?: string };
          if (!token) throw new Error('signIn: token is required.');
          await setOwnerToken(token);
          await load();
          return { signedIn: menuRef.current !== null };
        },
      },
      {
        id: 'getEditorStatus',
        label: 'Report what the menu editor is showing',
        description:
          'No params. Returns { signedIn, categoryCount, itemCount, ' +
          'unavailableItemCount, emptyCategories, unresolvedAllergenCodes }.',
        handler: async () => {
          const current = menuRef.current;
          return {
            signedIn: current !== null,
            categoryCount: current?.categories.length ?? 0,
            itemCount: current?.items.length ?? 0,
            unavailableItemCount:
              current?.items.filter((i) => !i.available).length ?? 0,
            emptyCategories:
              current?.categories
                .filter((c) => !(current.items ?? []).some((i) => i.categoryId === c.id))
                .map((c) => c.id) ?? [],
            unresolvedAllergenCodes:
              current?.allergenLegend.filter((e) => !e.resolved).map((e) => e.code) ?? [],
          };
        },
      },
    ],
  });

  // --- Credential ----------------------------------------------------------

  if (needsToken) {
    return (
      <ThemedView style={styles.center}>
        <View style={styles.tokenCard}>
          <ThemedText type="subtitle">Verwaltung</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Bitte das Kennwort der Verwaltung eingeben — für die Speisekarte und für
            Restaurant & Öffnungszeiten. Es wird auf diesem Gerät gespeichert, damit Sie
            es nur einmal brauchen.
          </ThemedText>
          {error ? (
            <Notice tone="error" title="Zugang nicht möglich">
              <ThemedText type="small" themeColor="textSecondary">
                {error}
              </ThemedText>
            </Notice>
          ) : null}
          <AdminField
            uiId="admin-token"
            label="Kennwort"
            value={tokenInput}
            onChangeText={setTokenInput}
            placeholder="Kennwort…"
            autoCapitalize="none"
          />
          <AdminButton
            uiId="admin-token-submit"
            title="Anmelden"
            tone="primary"
            busy={busy}
            onPress={() =>
              run(async () => {
                await setOwnerToken(tokenInput.trim());
                setTokenInput('');
              })
            }
          />
        </View>
      </ThemedView>
    );
  }

  if (!menu) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator />
        {error ? (
          <ThemedText type="small" style={{ color: theme.destructive }}>
            {error}
          </ThemedText>
        ) : null}
      </ThemedView>
    );
  }

  const itemsByCategory = new Map<string, AdminMenuItem[]>();
  for (const item of menu.items) {
    const list = itemsByCategory.get(item.categoryId) ?? [];
    list.push(item);
    itemsByCategory.set(item.categoryId, list);
  }
  const categories = [...menu.categories].sort((a, b) => a.sortOrder - b.sortOrder);
  const unresolved = menu.allergenLegend.filter((e) => !e.resolved);

  function moveCategory(index: number, delta: number) {
    const next = categories.map((c) => c.id);
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    const [moved] = next.splice(index, 1);
    if (!moved) return;
    next.splice(target, 0, moved);
    run(() => adminApi.reorderCategories(next));
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll}>
        {/* The two things the owner edits. The menu overview is this screen
            itself; the restaurant's facts have their own. */}
        <View style={styles.entries}>
          <AdminButton
            uiId="admin-section-menu"
            title="Speisekarte"
            tone="primary"
            onPress={() => scrollRef.current?.scrollTo({ y: menuHeadingY.current, animated: true })}
          />
          <AdminButton
            uiId="admin-section-restaurant"
            title="Restaurant & Öffnungszeiten"
            onPress={() => router.push('/admin/restaurant')}
          />
          <ThemedText type="small" themeColor="textSecondary">
            Öffnungszeiten, Sondertage und Urlaub, Adresse und Telefon, Impressum.
          </ThemedText>
        </View>

        <View
          style={styles.headerBlock}
          onLayout={(e) => {
            menuHeadingY.current = e.nativeEvent.layout.y;
          }}>
          <ThemedText type="subtitle">Speisekarte</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {menu.items.length} Gerichte in {categories.length} Kategorien.
            Änderungen sind sofort für Gäste sichtbar.
          </ThemedText>
        </View>

        {error ? (
          <Notice tone="error" title="Nicht gespeichert">
            <ThemedText type="small" themeColor="textSecondary">
              {error}
            </ThemedText>
          </Notice>
        ) : null}

        {unresolved.length > 0 ? (
          <Notice tone="warning" title="Allergene ohne Bezeichnung">
            <ThemedText type="small" themeColor="textSecondary">
              Auf der Karte stehen die Codes {unresolved.map((e) => e.code).join(', ')},
              zu denen keine Bezeichnung hinterlegt ist. Gäste sehen dort „unbekannt“.
            </ThemedText>
            <AdminButton
              uiId="admin-open-allergens-warning"
              title="Allergene verwalten"
              onPress={() => router.push('/admin/allergene')}
            />
          </Notice>
        ) : null}

        {categories.map((category, index) => {
          const items = itemsByCategory.get(category.id) ?? [];
          const renaming = renamingId === category.id;

          return (
            <ThemedView
              key={category.id}
              type="backgroundElement"
              style={styles.categoryCard}>
              {renaming ? (
                <View style={styles.stack}>
                  <AdminField
                    uiId={`admin-category-rename-${category.id}`}
                    label="Neuer Name der Kategorie"
                    value={renameValue}
                    onChangeText={setRenameValue}
                  />
                  <View style={styles.row}>
                    <View style={styles.grow}>
                      <AdminButton
                        uiId={`admin-category-rename-save-${category.id}`}
                        title="Speichern"
                        tone="primary"
                        busy={busy}
                        onPress={() =>
                          run(async () => {
                            await adminApi.renameCategory(category.id, renameValue.trim());
                            setRenamingId(null);
                          })
                        }
                      />
                    </View>
                    <View style={styles.grow}>
                      <AdminButton
                        uiId={`admin-category-rename-cancel-${category.id}`}
                        title="Abbrechen"
                        onPress={() => setRenamingId(null)}
                      />
                    </View>
                  </View>
                </View>
              ) : (
                <View style={styles.categoryHead}>
                  <ThemedText type="smallBold" style={styles.categoryTitle}>
                    {category.label}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {items.length === 0
                      ? 'noch leer'
                      : `${items.length} ${items.length === 1 ? 'Gericht' : 'Gerichte'}`}
                  </ThemedText>
                </View>
              )}

              {items.length === 0 ? (
                <Notice tone="warning" title="Diese Kategorie ist noch leer">
                  <ThemedText type="small" themeColor="textSecondary">
                    Gäste sehen die Kategorie erst, wenn mindestens ein Gericht darin
                    steht.
                  </ThemedText>
                </Notice>
              ) : (
                items.map((item) => (
                  <ThemedView key={item.id} style={styles.itemRow}>
                    <View style={styles.itemText}>
                      <ThemedText type="smallBold">
                        {item.number ? `${item.number}  ` : ''}
                        {item.name}
                        {item.available ? '' : '  ·  ausgeblendet'}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {priceSummary(item)}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {item.allergenCodes.length === 0
                          ? 'Allergene: keine Angabe'
                          : `Allergene: ${item.allergenCodes.join(', ')}`}
                      </ThemedText>
                    </View>
                    <AdminButton
                      uiId={`admin-edit-${item.id}`}
                      uiLabel={`${item.name} bearbeiten`}
                      title="Bearbeiten"
                      onPress={() => router.push(`/admin/item/${item.id}`)}
                    />
                  </ThemedView>
                ))
              )}

              <AdminButton
                uiId={`admin-add-item-${category.id}`}
                uiLabel={`Gericht zu ${category.label} hinzufügen`}
                title="+ Gericht hinzufügen"
                tone="primary"
                onPress={() => router.push(`/admin/item/neu?kategorie=${category.id}`)}
              />

              <View style={styles.row}>
                <View style={styles.grow}>
                  <AdminButton
                    uiId={`admin-category-up-${category.id}`}
                    title="↑ nach oben"
                    disabled={index === 0 || busy}
                    onPress={() => moveCategory(index, -1)}
                  />
                </View>
                <View style={styles.grow}>
                  <AdminButton
                    uiId={`admin-category-down-${category.id}`}
                    title="↓ nach unten"
                    disabled={index === categories.length - 1 || busy}
                    onPress={() => moveCategory(index, 1)}
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={styles.grow}>
                  <AdminButton
                    uiId={`admin-category-rename-open-${category.id}`}
                    title="Umbenennen"
                    onPress={() => {
                      setRenamingId(category.id);
                      setRenameValue(category.label);
                    }}
                  />
                </View>
                <View style={styles.grow}>
                  <ConfirmAction
                    uiId={`admin-category-delete-${category.id}`}
                    title="Kategorie löschen"
                    question={
                      items.length > 0
                        ? `„${category.label}“ enthält noch ${items.length} ${
                            items.length === 1 ? 'Gericht' : 'Gerichte'
                          }. Kategorien mit Gerichten können nicht gelöscht werden.`
                        : `„${category.label}“ wirklich löschen? Die Kategorie verschwindet von der Karte.`
                    }
                    confirmTitle="Ja, löschen"
                    busy={busy}
                    onConfirm={() => run(() => adminApi.deleteCategory(category.id))}
                  />
                </View>
              </View>
            </ThemedView>
          );
        })}

        <ThemedView type="backgroundElement" style={styles.categoryCard}>
          <ThemedText type="smallBold">Neue Kategorie</ThemedText>
          <AdminField
            uiId="admin-new-category"
            label="Name der Kategorie"
            hint="Zum Beispiel „Dessert“ oder „Getränke“."
            value={newCategory}
            onChangeText={setNewCategory}
          />
          <AdminButton
            uiId="admin-new-category-save"
            title="Kategorie anlegen"
            tone="primary"
            busy={busy}
            disabled={newCategory.trim().length === 0}
            onPress={() =>
              run(async () => {
                await adminApi.createCategory({
                  label: newCategory.trim(),
                  sortOrder: categories.length,
                });
                setNewCategory('');
              })
            }
          />
        </ThemedView>

        <AdminButton
          uiId="admin-open-allergens"
          title="Allergene verwalten"
          onPress={() => router.push('/admin/allergene')}
        />

        <View style={{ height: Spacing.xxxl }} />
      </ScrollView>
    </ThemedView>
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
  entries: { gap: Spacing.sm },
  tokenCard: { width: '100%', maxWidth: 420, gap: Spacing.lg },
  categoryCard: { borderRadius: Radius.card, padding: Spacing.lg, gap: Spacing.sm },
  categoryHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: Spacing.sm,
  },
  categoryTitle: { fontSize: 18 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  itemText: { flex: 1, gap: Spacing.xs },
  stack: { gap: Spacing.sm },
  row: { flexDirection: 'row', gap: Spacing.sm },
  grow: { flex: 1 },
});

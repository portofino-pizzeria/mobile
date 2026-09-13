import { useUIComponent } from '@qontinui/ui-bridge-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BridgeButton } from '@/components/bridge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, errorReason } from '@/lib/api';
import { describeArtResolution, resolveDishArt, type ResolvedArt } from '@/lib/dish-art';
import { formatEUR } from '@/lib/format';
import { formatCacheAge, readCachedMenu, writeCachedMenu } from '@/lib/menu-cache';
import type {
  AllergenLegendEntry,
  Menu,
  MenuItem,
  MenuVariant,
} from '@/lib/types';
import { useCart } from '@/state/cart';

/** Shown for a code that reaches us with no legend entry at all. The API
 *  already returns a flagged `unbekannt` entry for every code it cannot
 *  resolve, so this is a second floor under the same rule: a printed allergen
 *  code is never dropped, whatever the payload looks like. */
const UNRESOLVED_ALLERGEN_LABEL = 'unbekannt';

/** The UI Bridge id of the Add button for one purchasable variant. Derived
 *  from the two slugs, so it is stable across reseeds and distinct per
 *  variant — `menu-add-margherita-margherita-gross`. */
function addButtonUiId(itemId: string, variantId: string): string {
  return `menu-add-${itemId}-${variantId}`;
}

interface MenuSection {
  id: string;
  label: string;
  items: MenuItem[];
  /** True when at least one item in this section resolved a picture. Then every
   *  card in the section keeps the picture column, drawn or not, so rows stay
   *  the same shape — `imagery-and-iconography`: the no-image treatment "keeps
   *  the row's geometry". Its visual form is `Declared UNKNOWN`, so the empty
   *  column draws nothing. */
  illustrated: boolean;
}

/** Each item's picture, resolved once per menu. `null` is a resolved "none". */
type ArtByItem = ReadonlyMap<string, ResolvedArt | null>;

/** Group the items into the sections the API's own categories describe, in the
 *  API's own order. Nothing about the category list is hardcoded here. */
function buildSections(menu: Menu | null, art: ArtByItem): MenuSection[] {
  if (!menu) return [];

  const byCategory = new Map<string, MenuItem[]>();
  for (const item of menu.items) {
    const list = byCategory.get(item.categoryId) ?? [];
    list.push(item);
    byCategory.set(item.categoryId, list);
  }

  const section = (id: string, label: string, items: MenuItem[]): MenuSection => ({
    id,
    label,
    items,
    illustrated: items.some((item) => art.get(item.id) != null),
  });

  const sections: MenuSection[] = [];
  const known = new Set<string>();
  for (const category of [...menu.categories].sort((a, b) => a.sortOrder - b.sortOrder)) {
    known.add(category.id);
    const items = byCategory.get(category.id);
    if (items?.length) sections.push(section(category.id, category.label, items));
  }

  // An item whose category the API did not send still gets rendered, under its
  // raw category id. Hiding a real dish because its heading is missing is the
  // same class of silent omission the allergen rule forbids.
  for (const [categoryId, items] of byCategory) {
    if (!known.has(categoryId)) sections.push(section(categoryId, categoryId, items));
  }

  return sections;
}

function allergenText(
  item: MenuItem,
  legend: Map<string, AllergenLegendEntry>,
): string {
  if (item.allergenCodes.length === 0) return 'Allergene: keine Angabe';
  const parts = item.allergenCodes.map((code) => {
    const entry = legend.get(code);
    return `${code} (${entry ? entry.label : UNRESOLVED_ALLERGEN_LABEL})`;
  });
  return `Allergene: ${parts.join(', ')}`;
}

export default function MenuScreen() {
  const theme = useTheme();
  const router = useRouter();
  const cart = useCart();

  const [menu, setMenu] = useState<Menu | null>(null);
  /** Non-null exactly when what is on screen came out of the offline cache. */
  const [cachedAt, setCachedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Bumped by the retry button to load the menu again.
  const [attempt, setAttempt] = useState(0);

  // The UI Bridge action handlers below are registered once, so reading `menu`
  // directly would capture its initial (null) value. Refs always see the latest.
  const menuRef = useRef<Menu | null>(null);
  const cachedAtRef = useRef<Date | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const fresh = await api.getMenu();
        if (active) {
          menuRef.current = fresh;
          cachedAtRef.current = null;
          setMenu(fresh);
          setCachedAt(null);
          setError(null);
        }
        await writeCachedMenu(fresh);
      } catch (e) {
        // No network (or no backend): fall back to the last menu we were
        // served, and say how old it is rather than passing it off as live.
        const cached = await readCachedMenu();
        if (!active) return;
        if (cached) {
          menuRef.current = cached.menu;
          cachedAtRef.current = cached.cachedAt;
          setMenu(cached.menu);
          setCachedAt(cached.cachedAt);
          setError(null);
        } else {
          setError(errorReason(e));
        }
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [attempt]);

  // Semantic actions for the Qontinui runner.
  useUIComponent({
    id: 'menu',
    name: 'Menu',
    actions: [
      {
        id: 'addToCart',
        label: 'Add one menu item variant to the cart',
        description:
          'Params: { itemId: string, variantId?: string, quantity?: number }. ' +
          'variantId names the size / meat choice being ordered and is REQUIRED ' +
          'whenever the item has more than one variant — the action refuses ' +
          'rather than picking one, because guessing charges the wrong price. ' +
          'It may be omitted only for an item with exactly one variant.',
        handler: async (params) => {
          const { itemId, variantId, quantity } = (params ?? {}) as {
            itemId?: string;
            variantId?: string;
            quantity?: number;
          };

          if (!itemId) throw new Error('addToCart: itemId is required.');

          const item = menuRef.current?.items.find((m) => m.id === itemId);
          if (!item) throw new Error(`addToCart: no menu item with id "${itemId}".`);

          if (item.variants.length === 0) {
            throw new Error(
              `addToCart: "${itemId}" has no purchasable variant and cannot be ordered.`,
            );
          }

          let variant: MenuVariant | undefined;
          if (variantId) {
            variant = item.variants.find((v) => v.id === variantId);
            if (!variant) {
              throw new Error(
                `addToCart: "${itemId}" has no variant "${variantId}". ` +
                  `Available: ${item.variants.map((v) => v.id).join(', ')}.`,
              );
            }
          } else if (item.variants.length === 1) {
            // Unambiguous: one price, so naming the item names the variant.
            variant = item.variants[0];
          } else {
            throw new Error(
              `addToCart: "${itemId}" has ${item.variants.length} variants ` +
                `(${item.variants.map((v) => v.id).join(', ')}); pass variantId to say which.`,
            );
          }

          const qty = quantity ?? 1;
          if (!Number.isInteger(qty) || qty < 1) {
            throw new Error(`addToCart: quantity must be a positive integer, got ${quantity}.`);
          }

          cart.add(item, variant, qty);
          return {
            itemId: item.id,
            variantId: variant.id,
            variantLabel: variant.label,
            unitPrice: variant.price,
            quantity: qty,
          };
        },
      },
      {
        id: 'getDishArt',
        label: 'Report which picture, if any, each menu item resolved to',
        description:
          'No params. Returns { source: "live" | "cache", items: [{ itemId, rendered: ' +
          '"stored" | "bundled" | "none", manifestKey?, manifestStatus? }] } — the ' +
          'verification the policy clause an-image-beside-a-price-is-a-claim asks for: ' +
          'per item, which manifest key resolved and what its status was. A screenshot ' +
          'cannot tell a confirmed binding from a near-miss; this can. Throws while no ' +
          'menu is loaded, because an empty list would read as "nothing rendered".',
        handler: async () => {
          const current = menuRef.current;
          if (!current) throw new Error('getDishArt: no menu is loaded yet.');
          return {
            source: cachedAtRef.current ? 'cache' : 'live',
            items: describeArtResolution(current.items),
          };
        },
      },
      {
        id: 'getMenuStatus',
        label: 'Report what the menu screen is currently showing',
        description:
          'No params. Returns { source: "live" | "cache" | "none", cachedAt, ' +
          'categoryCount, itemCount, unresolvedAllergenCodes }.',
        handler: async () => {
          const current = menuRef.current;
          const cachedIso = cachedAtRef.current?.toISOString() ?? null;
          return {
            source: current ? (cachedIso ? 'cache' : 'live') : 'none',
            cachedAt: cachedIso,
            categoryCount: current?.categories.length ?? 0,
            itemCount: current?.items.length ?? 0,
            unresolvedAllergenCodes:
              current?.allergenLegend.filter((e) => !e.resolved).map((e) => e.code) ?? [],
          };
        },
      },
    ],
  });

  const legendByCode = useMemo(() => {
    const map = new Map<string, AllergenLegendEntry>();
    for (const entry of menu?.allergenLegend ?? []) map.set(entry.code, entry);
    return map;
  }, [menu]);

  const artByItem = useMemo<ArtByItem>(() => {
    const art = new Map<string, ResolvedArt | null>();
    for (const item of menu?.items ?? []) art.set(item.id, resolveDishArt(item));
    return art;
  }, [menu]);

  const sections = useMemo(() => buildSections(menu, artByItem), [menu, artByItem]);

  if (error) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText type="subtitle">Speisekarte konnte nicht geladen werden</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.errorText}>
          {error}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.errorText}>
          Es ist auch keine gespeicherte Speisekarte vorhanden.
        </ThemedText>
        {/* A hint for a developer, not a diner: a release build says nothing
            about a backend. */}
        {__DEV__ ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.errorText}>
            Läuft das Backend? (npm run dev in ../backend)
          </ThemedText>
        ) : null}
        <BridgeButton
          uiId="menu-retry"
          uiLabel="Erneut versuchen"
          style={({ pressed }) => [
            styles.retryBtn,
            { backgroundColor: pressed ? theme.brandPressed : theme.brand },
          ]}
          onPress={() => {
            setError(null);
            setAttempt((n) => n + 1);
          }}>
          <ThemedText type="smallBold" style={{ color: theme.onBrand }}>
            Erneut versuchen
          </ThemedText>
        </BridgeButton>
      </ThemedView>
    );
  }

  if (!menu) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {cachedAt ? (
          <ThemedView type="backgroundElement" style={styles.offlineBanner}>
            <ThemedText type="smallBold">Offline — gespeicherte Speisekarte</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Stand: {formatCacheAge(cachedAt)}. Preise, Angebot und Allergene können
              sich seitdem geändert haben.
            </ThemedText>
          </ThemedView>
        ) : null}

        {sections.map((section) => (
          <View key={section.id} style={styles.section}>
            <ThemedText type="subtitle">{section.label}</ThemedText>
            {section.items.map((item) => {
              const art = artByItem.get(item.id);
              return (
                <ThemedView key={item.id} type="backgroundElement" style={styles.card}>
                  {art ? (
                    <Image source={art.source} alt={art.alt} style={styles.thumb} contentFit="cover" />
                  ) : section.illustrated ? (
                    <View style={styles.thumb} />
                  ) : null}
                  <View style={styles.cardBody}>
                    <ThemedText type="heading">
                      {item.number ? `${item.number}  ` : ''}
                      {item.name}
                    </ThemedText>
                    {item.description ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        {item.description}
                      </ThemedText>
                    ) : null}
                    <ThemedText type="small" themeColor="textSecondary">
                      {allergenText(item, legendByCode)}
                    </ThemedText>

                    {item.variants.length === 0 ? (
                      // The API returns an item with no priced variant rather than
                      // hiding it. It is shown, and it is not orderable.
                      <ThemedText type="small" themeColor="textSecondary">
                        Zurzeit nicht bestellbar
                      </ThemedText>
                    ) : (
                      <View style={styles.variants}>
                        {item.variants.map((variant) => (
                          <BridgeButton
                            key={variant.id}
                            uiId={addButtonUiId(item.id, variant.id)}
                            uiLabel={`${item.name} (${variant.label}) in den Warenkorb legen`}
                            // Pressed: the OUTLINE darkens to the declared pressed
                            // red and the ground lifts to the app's selected
                            // ground; the label keeps its `priceText` colour (see
                            // the `brandPressed` token for why the label does not
                            // move). The ground lift is what carries the press in
                            // dark mode — a darker red on a dark card measures
                            // ~2.4:1 and reads as fading, not pressing.
                            style={({ pressed }) => [
                              styles.addBtn,
                              pressed
                                ? { borderColor: theme.brandPressed, backgroundColor: theme.backgroundSelected }
                                : { borderColor: theme.brand },
                            ]}
                            onPress={() => cart.add(item, variant)}>
                            <ThemedText type="price">
                              + {variant.label} · {formatEUR(variant.price)}
                            </ThemedText>
                          </BridgeButton>
                        ))}
                      </View>
                    )}
                  </View>
                </ThemedView>
              );
            })}
          </View>
        ))}

        {menu.allergenLegend.length > 0 ? (
          <View style={styles.section}>
            <ThemedText type="subtitle">Allergene</ThemedText>
            {menu.allergenLegend.map((entry) => (
              <ThemedText key={entry.code} type="small" themeColor="textSecondary">
                {entry.code} — {entry.label}
              </ThemedText>
            ))}
            {menu.allergenLegend.some((entry) => !entry.resolved) ? (
              <ThemedText type="small" themeColor="textSecondary">
                Zu den mit „unbekannt“ gekennzeichneten Codes liegt uns keine Angabe
                vor — bitte im Restaurant nachfragen.
              </ThemedText>
            ) : null}
          </View>
        ) : null}

        <View style={{ height: cart.count > 0 ? 96 : Spacing.xl }} />
      </ScrollView>

      {cart.count > 0 ? (
        <SafeAreaView edges={['bottom']} style={styles.cartBarWrap}>
          <BridgeButton
            uiId="go-to-cart"
            uiLabel="Warenkorb ansehen"
            style={({ pressed }) => [
              styles.cartBar,
              { backgroundColor: pressed ? theme.brandPressed : theme.brand },
            ]}
            onPress={() => router.push('/cart')}>
            <ThemedText type="smallBold" style={{ color: theme.onBrand }}>
              Warenkorb ansehen · {cart.count} Artikel
            </ThemedText>
            <ThemedText type="smallBold" style={{ color: theme.onBrand }}>
              {formatEUR(cart.subtotal)}
            </ThemedText>
          </BridgeButton>
        </SafeAreaView>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
  },
  errorText: { textAlign: 'center' },
  retryBtn: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.card,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    marginTop: Spacing.sm,
  },
  scroll: { padding: Spacing.lg, gap: Spacing.xl, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center' },
  offlineBanner: { padding: Spacing.lg, borderRadius: Radius.card, gap: Spacing.xs },
  section: { gap: Spacing.sm },
  card: { flexDirection: 'row', borderRadius: Radius.card, overflow: 'hidden', gap: Spacing.lg },
  thumb: { width: 96, height: 96 },
  cardBody: { flex: 1, paddingVertical: Spacing.sm, paddingRight: Spacing.lg, gap: Spacing.xs, justifyContent: 'center' },
  variants: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.xs },
  // Outlined, not filled: the brand red is a foreground colour, and a menu
  // shows dozens of these. `visual-system` -> "A design that turns it into a
  // background wash is not this palette used differently."
  addBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
    minHeight: 44,
    justifyContent: 'center',
    // Both lines are load-bearing, and they fix two halves of one defect: a
    // price a guest cannot read is the one thing this row exists to show.
    //
    // `flexShrink: 0` — without it flexbox compresses two pills onto one row
    // and React Native clips the label with no ellipsis, which ate the price
    // off the end of "+ klein 22cm · 4,90 €".
    //
    // `maxWidth: '100%'` — with the shrink off, a pill wider than the column
    // instead overflowed and was cut by the card's `overflow: 'hidden'`: the
    // same clipping, relocated to a long variant label. Bounded to the column,
    // the label wraps inside the pill instead.
    flexShrink: 0,
    maxWidth: '100%',
  },
  cartBarWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: Spacing.lg },
  cartBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderRadius: Radius.card,
    marginBottom: Spacing.sm,
  },
});

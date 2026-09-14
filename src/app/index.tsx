import { useUIComponent } from '@qontinui/ui-bridge-native';
import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Image as RNImage,
  type ImageSourcePropType,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BridgeButton } from '@/components/bridge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radius, Spacing, Type } from '@/constants/theme';
import { useShop } from '@/hooks/use-shop';
import { useTheme } from '@/hooks/use-theme';
import { api, errorReason } from '@/lib/api';
import {
  describeArtResolution,
  resolveCategoryIcon,
  resolveDishArt,
  type ResolvedArt,
} from '@/lib/dish-art';
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
  const { shop } = useShop();

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

  // --- the category tabs -----------------------------------------------------
  //
  // The design's tabs FILTER a four-item list. This menu has every category of
  // the real card, and a filter would unmount the add buttons of every other
  // category — which the UI Bridge addresses by id — so here a tab SCROLLS to
  // its section, and the tab under the reading position is the active one.
  const scrollRef = useRef<ScrollView>(null);
  const tabsScrollRef = useRef<ScrollView>(null);
  /** Where the menu list starts inside the scroll content. */
  const listY = useRef(0);
  /** Each section's top, relative to the menu list. */
  const sectionY = useRef(new Map<string, number>());
  /** Each tab's left edge inside the tab strip. */
  const tabX = useRef(new Map<string, number>());
  const [tabsHeight, setTabsHeight] = useState(0);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const activeId = activeSection ?? sections[0]?.id ?? null;

  useEffect(() => {
    if (!activeId) return;
    const x = tabX.current.get(activeId);
    if (x !== undefined) tabsScrollRef.current?.scrollTo({ x: Math.max(0, x - Spacing.gutter), animated: true });
  }, [activeId]);

  /** The section a tab press is scrolling to. While set, the sections the
   *  animation passes through do not flicker through the tab strip. */
  const jumpTarget = useRef<{ id: string; until: number } | null>(null);

  function scrollToSection(id: string) {
    const y = sectionY.current.get(id);
    if (y === undefined) return;
    jumpTarget.current = { id, until: Date.now() + 1000 };
    setActiveSection(id);
    scrollRef.current?.scrollTo({ y: listY.current + y - tabsHeight, animated: true });
  }

  function onScroll(offsetY: number, viewportHeight: number, contentHeight: number) {
    const reading = offsetY + tabsHeight + 1;
    let current: string | null = sections[0]?.id ?? null;
    for (const section of sections) {
      const y = sectionY.current.get(section.id);
      if (y !== undefined && listY.current + y <= reading) current = section.id;
    }
    // At the bottom of the page the last sections can never reach the reading
    // line — they are shorter than the screen. Scrolled to the end, the tab a
    // press is heading for, or else the last one, is the current one.
    if (offsetY + viewportHeight >= contentHeight - 1) {
      current = jumpTarget.current?.id ?? sections[sections.length - 1]?.id ?? current;
    }
    const jump = jumpTarget.current;
    if (jump) {
      if (current !== jump.id && Date.now() < jump.until) return;
      jumpTarget.current = null;
    }
    if (current !== activeId) setActiveSection(current);
  }

  const { width } = useWindowDimensions();
  const wide = width >= 768;

  if (error) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText type="subtitle" style={styles.centerText}>
          Speisekarte konnte nicht geladen werden
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
          {error}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
          Es ist auch keine gespeicherte Speisekarte vorhanden.
        </ThemedText>
        {/* A hint for a developer, not a diner: a release build says nothing
            about a backend. */}
        {__DEV__ ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
            Läuft das Backend? (npm run dev in ../backend)
          </ThemedText>
        ) : null}
        <BridgeButton
          uiId="menu-retry"
          uiLabel="Erneut versuchen"
          style={({ pressed }) => [
            styles.primaryBtn,
            { backgroundColor: pressed ? theme.brandPressed : theme.brand },
          ]}
          onPress={() => {
            setError(null);
            setAttempt((n) => n + 1);
          }}>
          <ThemedText type="smallBold" themeColor="onBrand">
            Erneut versuchen
          </ThemedText>
        </BridgeButton>
      </ThemedView>
    );
  }

  if (!menu) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator color={theme.brand} />
      </ThemedView>
    );
  }

  const header = (
    <Stack.Screen
      options={{
        headerTitle: () => <Wordmark />,
        headerRight: () =>
          cart.count > 0 ? (
            <BridgeButton
              uiId="header-cart"
              uiLabel={`Warenkorb, ${cart.count} Artikel`}
              style={({ pressed }) => [styles.headerCart, pressed && { opacity: 0.6 }]}
              onPress={() => router.push('/cart')}>
              <ThemedText type="smallBold">Warenkorb</ThemedText>
              <View style={[styles.badge, { backgroundColor: theme.brand }]}>
                <ThemedText type="smallBold" themeColor="onBrand" style={styles.badgeText}>
                  {cart.count}
                </ThemedText>
              </View>
            </BridgeButton>
          ) : null,
      }}
    />
  );

  // The scroll content, built as a flat list so the tab strip's index is known
  // for `stickyHeaderIndices`.
  const blocks: React.ReactElement[] = [];

  if (cachedAt) {
    blocks.push(
      <ThemedView key="offline" type="backgroundElement" style={styles.offlineBanner}>
        <View style={styles.column}>
          <ThemedText type="smallBold">Offline — gespeicherte Speisekarte</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Stand: {formatCacheAge(cachedAt)}. Preise, Angebot und Allergene können
            sich seitdem geändert haben.
          </ThemedText>
        </View>
      </ThemedView>,
    );
  }

  // The hero — `components/hero.tsx`. Its copy is the design's except where
  // the design states a fact nobody has confirmed (a founding year, a stone
  // oven, homemade pasta): those are left out rather than published.
  blocks.push(
    <ThemedView key="hero" type="backgroundElement" style={styles.band}>
      <View style={[styles.column, wide && styles.heroWide]}>
        <View style={[styles.heroImageWrap, wide && styles.heroImageWide]}>
          <Image
            source={require('../../assets/images/hero-pizza.jpg')}
            alt="Pizza Margherita auf einem Holztisch"
            style={styles.heroImage}
            contentFit="cover"
          />
        </View>
        <View style={[styles.heroCopy, wide && styles.heroCopyWide]}>
          <ThemedText type="eyebrow">Essen</ThemedText>
          <ThemedText type="title">
            Buon{'\n'}
            <ThemedText type="title" themeColor="brandText">
              appetito.
            </ThemedText>
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary" style={styles.heroLead}>
            Pizza, Pasta und mehr — direkt bei Portofino in Essen bestellen.
          </ThemedText>
          {shop ? <OpenStatus shop={shop} /> : null}
          <BridgeButton
            uiId="hero-to-menu"
            uiLabel="Speisekarte entdecken"
            style={({ pressed }) => [
              styles.primaryBtn,
              styles.heroBtn,
              { backgroundColor: pressed ? theme.brandPressed : theme.brand },
            ]}
            onPress={() => sections[0] && scrollToSection(sections[0].id)}>
            <ThemedText type="smallBold" themeColor="onBrand">
              Speisekarte entdecken ↓
            </ThemedText>
          </BridgeButton>
        </View>
      </View>
    </ThemedView>,
  );

  blocks.push(
    <View key="menu-intro" style={styles.menuIntro}>
      <View style={styles.column}>
        <ThemedText type="eyebrow">La nostra cucina</ThemedText>
        <ThemedText type="subtitle">Speisekarte</ThemedText>
      </View>
    </View>,
  );

  const stickyIndex = blocks.length;
  blocks.push(
    <View
      key="tabs"
      style={[styles.tabsBar, { backgroundColor: theme.background, borderBottomColor: theme.backgroundSelected }]}
      onLayout={(e) => setTabsHeight(e.nativeEvent.layout.height)}>
      <ScrollView
        ref={tabsScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        // Wide screens: the strip lines up with the content column. Phones:
        // it runs to the screen edge so a half-visible tab says "scroll".
        style={wide ? styles.tabsWide : undefined}
        contentContainerStyle={styles.tabs}>
        {sections.map((section) => {
          const active = section.id === activeId;
          return (
            <BridgeButton
              key={section.id}
              uiId={`menu-tab-${section.id}`}
              uiLabel={`Zu ${section.label} springen`}
              onLayout={(e) => tabX.current.set(section.id, e.nativeEvent.layout.x)}
              role="tab"
              aria-selected={active}
              // The gold TEXT colour, not the fill gold: the underline is the
              // active state's indicator and needs 3:1 (the fill gold is 2.23:1).
              style={[styles.tab, { borderBottomColor: active ? theme.brandText : 'transparent' }]}
              onPress={() => scrollToSection(section.id)}>
              <CategoryIcon
                categoryId={section.id}
                size={22}
                color={active ? theme.text : theme.textSecondary}
              />
              <ThemedText type="smallBold" themeColor={active ? 'text' : 'textSecondary'}>
                {section.label}
              </ThemedText>
            </BridgeButton>
          );
        })}
      </ScrollView>
    </View>,
  );

  blocks.push(
    <View key="menu" style={styles.menu} onLayout={(e) => (listY.current = e.nativeEvent.layout.y)}>
      {sections.map((section) => (
        <View
          key={section.id}
          style={[styles.column, styles.section]}
          onLayout={(e) => sectionY.current.set(section.id, e.nativeEvent.layout.y)}>
          <View style={styles.sectionHead}>
            <CategoryIcon categoryId={section.id} size={40} color={theme.brandText} />
            <ThemedText type="subtitle" style={styles.sectionHeadTitle}>
              {section.label}
            </ThemedText>
          </View>
          {section.items.map((item, index) => {
            const art = artByItem.get(item.id);
            return (
              <View
                key={item.id}
                style={[styles.row, index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.backgroundSelected }]}>
                {/* Picture and name side by side; allergens and the add
                    buttons run the full width underneath, so a picture never
                    squeezes a price. */}
                <View style={styles.rowTop}>
                  {art ? (
                    <Image
                      source={art.source}
                      alt={art.alt}
                      style={[styles.thumb, { backgroundColor: theme.backgroundElement }]}
                      contentFit="cover"
                    />
                  ) : section.illustrated ? (
                    <View style={styles.thumb} />
                  ) : null}
                  <View style={styles.rowTitle}>
                    <ThemedText type="heading">
                      {item.number ? (
                        <ThemedText type="small" themeColor="textSecondary">
                          {item.number}{'  '}
                        </ThemedText>
                      ) : null}
                      {item.name}
                    </ThemedText>
                    {item.description ? (
                      <ThemedText type="small" themeColor="textSecondary">
                        {item.description}
                      </ThemedText>
                    ) : null}
                  </View>
                </View>
                <View style={styles.rowBody}>
                  {item.pickupOnly ? (
                    <View style={[styles.pickupBadge, { borderColor: theme.brandText }]}>
                      <ThemedText type="smallBold" themeColor="brandText" style={styles.pickupBadgeText}>
                        Nur zur Abholung
                      </ThemedText>
                    </View>
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
                          // The design's price + round add button, one per
                          // variant: a size is a price, so each carries its
                          // own. Pressed, the round button fills gold — the
                          // design's hover.
                          style={({ pressed }) => [
                            styles.addBtn,
                            { borderColor: pressed ? theme.brand : theme.backgroundSelected },
                          ]}
                          onPress={() => cart.add(item, variant)}>
                          {({ pressed }) => (
                            <>
                              <ThemedText type="price" style={styles.addLabel}>
                                {variant.label} · {formatEUR(variant.price)}
                              </ThemedText>
                              <View
                                style={[
                                  styles.plus,
                                  { backgroundColor: pressed ? theme.brand : theme.backgroundElement },
                                ]}>
                                <ThemedText
                                  type="smallBold"
                                  themeColor={pressed ? 'onBrand' : 'brandText'}
                                  style={styles.plusGlyph}>
                                  +
                                </ThemedText>
                              </View>
                            </>
                          )}
                        </BridgeButton>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </View>,
  );

  if (menu.allergenLegend.length > 0) {
    blocks.push(
      <ThemedView key="allergens" type="backgroundElement" style={styles.band}>
        <View style={[styles.column, styles.legend]}>
          <ThemedText type="eyebrow">Gut zu wissen</ThemedText>
          <ThemedText type="subtitle" style={styles.sectionTitle}>
            Allergene
          </ThemedText>
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
      </ThemedView>,
    );
  }

  // `components/contact.tsx` — "Kommt vorbei." — with the shop's own address,
  // hours and phone from `GET /api/shop`, which come from the footer of
  // portofino-essen.de. Absent while that read has not answered: the band says
  // nothing rather than something unconfirmed.
  if (shop) {
    const routeUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      `${shop.street}, ${shop.postalCode} ${shop.city}`,
    )}`;
    blocks.push(
      <View key="contact" style={styles.band}>
        <View style={[styles.column, styles.contact]}>
          <ThemedText type="eyebrow">Dove trovarci</ThemedText>
          <ThemedText type="subtitle">Kommt vorbei.</ThemedText>
          <View style={[styles.contactGrid, wide && styles.contactGridWide]}>
            <View style={[styles.contactBlock, wide && styles.contactBlockWide]}>
              <ThemedText type="smallBold">Adresse</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {shop.street}
                {'\n'}
                {shop.postalCode} {shop.city}
              </ThemedText>
            </View>
            <View style={[styles.contactBlock, wide && styles.contactBlockWide]}>
              <ThemedText type="smallBold">Öffnungszeiten</ThemedText>
              {shop.hours.map((row) => (
                <ThemedText key={row.days} type="small" themeColor="textSecondary">
                  {row.days}: {row.hours}
                </ThemedText>
              ))}
              <ThemedText type="small" themeColor="textSecondary">
                Lieferung bis {shop.deliveryUntil} Uhr
              </ThemedText>
            </View>
            <View style={[styles.contactBlock, wide && styles.contactBlockWide]}>
              <ThemedText type="smallBold">Telefon</ThemedText>
              <BridgeButton
                uiId="shop-call"
                uiLabel={`Portofino anrufen: ${shop.phoneDisplay}`}
                style={styles.link}
                onPress={() => openLink(`tel:${shop.phoneE164}`)}>
                <ThemedText type="small" themeColor="brandText" style={styles.linkText}>
                  {shop.phoneDisplay}
                </ThemedText>
              </BridgeButton>
            </View>
          </View>
          <BridgeButton
            uiId="shop-route"
            uiLabel="Route zu Portofino planen"
            style={({ pressed }) => [
              styles.primaryBtn,
              styles.heroBtn,
              { backgroundColor: pressed ? theme.brandPressed : theme.brand },
            ]}
            onPress={() => openLink(routeUrl)}>
            <ThemedText type="smallBold" themeColor="onBrand">
              Route planen
            </ThemedText>
          </BridgeButton>
        </View>
      </View>,
    );
  }

  // `components/footer.tsx`, without its Instagram link: the shop has given no
  // account to link to.
  blocks.push(
    <View
      key="footer"
      style={[styles.footer, { backgroundColor: theme.footer, paddingBottom: Spacing.xxxl + (cart.count > 0 ? 88 : 0) }]}>
      <View style={[styles.column, styles.footerInner]}>
        <Wordmark onDark />
        <ThemedText type="small" themeColor="onFooterMuted">
          © {new Date().getFullYear()} Portofino Pizzeria · Essen
        </ThemedText>
      </View>
    </View>,
  );

  return (
    <ThemedView style={styles.container}>
      {header}
      <ScrollView
        ref={scrollRef}
        stickyHeaderIndices={[stickyIndex]}
        scrollEventThrottle={32}
        onScroll={(e) =>
          onScroll(
            e.nativeEvent.contentOffset.y,
            e.nativeEvent.layoutMeasurement.height,
            e.nativeEvent.contentSize.height,
          )
        }>
        {blocks}
      </ScrollView>

      {cart.count > 0 ? (
        <SafeAreaView edges={['bottom']} style={styles.cartBarWrap} pointerEvents="box-none">
          <BridgeButton
            uiId="go-to-cart"
            uiLabel="Warenkorb ansehen"
            style={({ pressed }) => [
              styles.cartBar,
              { backgroundColor: pressed ? theme.brandPressed : theme.brand },
            ]}
            onPress={() => router.push('/cart')}>
            <ThemedText type="smallBold" themeColor="onBrand">
              Warenkorb ansehen · {cart.count} Artikel
            </ThemedText>
            <ThemedText type="smallBold" themeColor="onBrand">
              {formatEUR(cart.subtotal)}
            </ThemedText>
          </BridgeButton>
        </SafeAreaView>
      ) : null}
    </ThemedView>
  );
}

/** A category's line-art icon, tinted — or nothing, when the category has no
 *  `confirmed` icon. The icons are alpha masks (`render: tintable-alpha` in the
 *  manifest), so the colour is the surface's, not the file's. Decorative: the
 *  label beside it already names the category. */
function CategoryIcon({ categoryId, size, color }: { categoryId: string; size: number; color: string }) {
  const icon = resolveCategoryIcon(categoryId);
  if (!icon) return null;
  // React Native's Image rather than expo-image: expo-image ignores
  // `tintColor` on web, which left the masks as faint grey sketches there.
  return (
    <RNImage
      source={icon.source as ImageSourcePropType}
      style={{ height: size, width: size * 1.5 }}
      tintColor={color}
      resizeMode="contain"
      accessible={false}
    />
  );
}

/**
 * Opens a tel: or web link. A device with no dialer rejects `tel:`; that is
 * not an error worth surfacing, because the number stays visible on screen.
 * On web a `tel:` link opens in the same tab, so no blank tab is left behind.
 */
function openLink(url: string): void {
  if (Platform.OS === 'web') {
    window.open(url, url.startsWith('tel:') ? '_self' : '_blank', 'noopener');
    return;
  }
  Linking.openURL(url).catch(() => {});
}

/**
 * Whether orders are taken right now, from the same status the order route
 * enforces. A dot and a sentence rather than a colour alone: the declared
 * palette has no status colours, and the sentence carries the meaning.
 */
function OpenStatus({ shop }: { shop: NonNullable<ReturnType<typeof useShop>['shop']> }) {
  const theme = useTheme();
  const { pickup, delivery } = shop.status;
  const open = pickup.available || delivery.available;
  const text = delivery.available
    ? `Jetzt geöffnet · Lieferung bis ${delivery.until} Uhr · Abholung bis ${pickup.until} Uhr`
    : pickup.available
      ? `Jetzt nur Abholung · bis ${pickup.until} Uhr`
      : pickup.next
        ? `Geschlossen · Bestellungen wieder ab ${pickup.next.weekday}, ${pickup.next.time} Uhr`
        : 'Geschlossen';
  return (
    <View aria-live="polite" style={[styles.status, { backgroundColor: theme.background }]}>
      <View style={[styles.statusDot, { backgroundColor: open ? theme.brandText : theme.textSecondary }]} />
      <ThemedText type="small" style={styles.statusText}>
        {text}
      </ThemedText>
    </View>
  );
}

/** `PORTOFINO.` — the design's wordmark: the gold serif, and an ink full stop
 *  (gold on the dark footer, as in `footer.tsx`). A logotype, so the gold carries no contrast
 *  requirement. */
function Wordmark({ onDark = false }: { onDark?: boolean }) {
  const theme = useTheme();
  return (
    <Text
      accessibilityRole="header"
      style={[styles.wordmark, { color: theme.brand }]}>
      PORTOFINO
      <Text style={{ color: onDark ? theme.brand : theme.text }}>.</Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.gutter,
    paddingVertical: Spacing.xl,
  },
  centerText: { textAlign: 'center' },
  /** The content column: `mx-auto max-w-4xl px-5`. */
  column: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.gutter,
  },
  /** A full-bleed band with the design's phone section padding. */
  band: { paddingVertical: Spacing.band },
  offlineBanner: { paddingVertical: Spacing.lg, gap: Spacing.xs },
  primaryBtn: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: Radius.card,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    marginTop: Spacing.sm,
  },

  // --- hero ---
  heroWide: { flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.xxl },
  heroImageWrap: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: Radius.image,
    overflow: 'hidden',
    marginBottom: Spacing.xxl,
  },
  heroImageWide: { flex: 1, aspectRatio: 1, marginBottom: 0 },
  heroImage: { width: '100%', height: '100%' },
  heroCopy: { gap: Spacing.md },
  heroCopyWide: { flex: 1 },
  heroLead: { maxWidth: 384, marginTop: Spacing.sm },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    maxWidth: '100%',
  },
  statusDot: { width: 8, height: 8, borderRadius: Radius.pill },
  statusText: { flexShrink: 1 },
  pickupBadge: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: Spacing.sm },
  pickupBadgeText: { fontSize: 12, lineHeight: 20 },
  contact: { gap: Spacing.md },
  contactGrid: { gap: Spacing.xl, marginTop: Spacing.sm },
  contactGridWide: { flexDirection: 'row' },
  contactBlock: { gap: Spacing.xs },
  // Side by side only on a wide screen. In the phone column `flex: 1` would
  // shrink each block below its text, and the lines would overlap.
  contactBlockWide: { flex: 1 },
  link: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  linkText: { textDecorationLine: 'underline' },
  heroBtn: { alignSelf: 'flex-start', marginTop: Spacing.lg },

  // --- menu ---
  menuIntro: { paddingTop: Spacing.section, paddingBottom: Spacing.lg },
  tabsBar: { borderBottomWidth: StyleSheet.hairlineWidth },
  tabsWide: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  tabs: {
    gap: Spacing.xl,
    paddingHorizontal: Spacing.gutter,
    flexGrow: 1,
    justifyContent: 'flex-start',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 2,
    minHeight: 44,
    justifyContent: 'center',
  },
  menu: { paddingBottom: Spacing.xxxl },
  section: { paddingTop: Spacing.xxxl },
  sectionTitle: { marginBottom: Spacing.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.sm },
  sectionHeadTitle: { flexShrink: 1 },
  row: { gap: Spacing.xs, paddingVertical: Spacing.gutter },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  /** The illustrations are about 3:2; this keeps their garnish in frame. */
  thumb: { width: 120, height: 80, borderRadius: Radius.card },
  rowTitle: { flex: 1, gap: Spacing.xs },
  rowBody: { gap: Spacing.xs },
  variants: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingLeft: Spacing.lg,
    paddingRight: Spacing.xs,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.pill,
    borderWidth: 1,
    minHeight: 44,
    // Both lines are load-bearing: a price a guest cannot read is the one
    // thing this row exists to show. `flexShrink: 0` stops flexbox compressing
    // two buttons onto one row and clipping the label with no ellipsis;
    // `maxWidth: '100%'` stops a long variant label overflowing the column, so
    // it wraps inside the button instead.
    flexShrink: 0,
    maxWidth: '100%',
  },
  addLabel: { flexShrink: 1 },
  plus: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusGlyph: { fontSize: 18, lineHeight: 22 },
  legend: { gap: Spacing.xs },

  // --- footer ---
  footer: { paddingTop: Spacing.xxxl },
  footerInner: { gap: Spacing.lg },
  wordmark: {
    fontFamily: Type.serif,
    fontSize: 22,
    lineHeight: Platform.OS === 'android' ? 30 : 28,
    fontWeight: '700',
    letterSpacing: -0.3,
  },

  // --- header & cart ---
  headerCart: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: 44, paddingHorizontal: Spacing.xs },
  badge: { minWidth: 22, height: 22, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xs },
  badgeText: { fontSize: 12, lineHeight: 16 },
  cartBarWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: Spacing.gutter },
  cartBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderRadius: Radius.card,
    marginBottom: Spacing.sm,
    width: '100%',
    maxWidth: MaxContentWidth - 2 * Spacing.gutter,
    alignSelf: 'center',
  },
});

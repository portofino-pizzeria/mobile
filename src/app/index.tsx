import { useUIComponent } from '@qontinui/ui-bridge-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BridgeButton } from '@/components/bridge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { formatEUR } from '@/lib/format';
import type { MenuCategory, MenuItem } from '@/lib/types';
import { useCart } from '@/state/cart';

const CATEGORY_LABELS: Record<MenuCategory, string> = {
  pizza: 'Pizze',
  sides: 'Sides',
  drinks: 'Drinks',
  desserts: 'Dolci',
};
const CATEGORY_ORDER: MenuCategory[] = ['pizza', 'sides', 'drinks', 'desserts'];

export default function MenuScreen() {
  const theme = useTheme();
  const router = useRouter();
  const cart = useCart();
  const [menu, setMenu] = useState<MenuItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The UI Bridge action handler below is registered once, so reading `menu`
  // directly would capture its initial (null) value. A ref always sees the
  // latest menu.
  const menuRef = useRef<MenuItem[] | null>(null);

  useEffect(() => {
    let active = true;
    api
      .getMenu()
      .then((items) => {
        if (!active) return;
        setMenu(items);
        menuRef.current = items;
      })
      .catch((e: Error) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, []);

  // Expose an "addToCart" action so the runner can add items by id semantically.
  useUIComponent({
    id: 'menu',
    name: 'Menu',
    actions: [
      {
        id: 'addToCart',
        handler: async (params) => {
          const { itemId } = (params ?? {}) as { itemId?: string };
          const item = menuRef.current?.find((m) => m.id === itemId);
          if (item) cart.add(item);
        },
      },
    ],
  });

  const grouped = useMemo(() => {
    const map = new Map<MenuCategory, MenuItem[]>();
    for (const item of menu ?? []) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return map;
  }, [menu]);

  if (error) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText type="subtitle">Couldn’t load the menu</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.errorText}>
          {error}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Is the backend running? (npm run dev in ../backend)
        </ThemedText>
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
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.heroSection}>
          <AnimatedIcon />
          <ThemedText type="title" style={styles.title}>
            Welcome to&nbsp;Portofino&nbsp;Pizzeria
          </ThemedText>
        </ThemedView>

        <ThemedText type="code" style={styles.code}>
          get started
        </ThemedText>

        <ThemedView type="backgroundElement" style={styles.stepContainer}>
          <HintRow
            title="Try editing"
            hint={<ThemedText type="code">src/app/index.tsx</ThemedText>}
          />
          <HintRow title="Dev tools" hint={getDevMenuHint()} />
          <HintRow
            title="Fresh start"
            hint={<ThemedText type="code">npm run reset-project</ThemedText>}
          />
        </ThemedView>

      {cart.count > 0 ? (
        <SafeAreaView edges={['bottom']} style={styles.cartBarWrap}>
          <BridgeButton
            uiId="go-to-cart"
            uiLabel="View cart"
            style={[styles.cartBar, { backgroundColor: theme.text }]}
            onPress={() => router.push('/cart')}>
            <ThemedText type="smallBold" style={{ color: theme.background }}>
              View cart · {cart.count} {cart.count === 1 ? 'item' : 'items'}
            </ThemedText>
            <ThemedText type="smallBold" style={{ color: theme.background }}>
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.two, padding: Spacing.four },
  errorText: { textAlign: 'center' },
  scroll: { padding: Spacing.three, gap: Spacing.four, maxWidth: 800, width: '100%', alignSelf: 'center' },
  section: { gap: Spacing.two },
  card: { flexDirection: 'row', borderRadius: Spacing.three, overflow: 'hidden', gap: Spacing.three },
  thumb: { width: 96, height: 96 },
  cardBody: { flex: 1, paddingVertical: Spacing.two, paddingRight: Spacing.three, gap: Spacing.half, justifyContent: 'center' },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: Spacing.one },
  addBtn: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.one, borderRadius: 999 },
  cartBarWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: Spacing.three },
  cartBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.three,
    borderRadius: Spacing.three,
    marginBottom: Spacing.two,
  },
});

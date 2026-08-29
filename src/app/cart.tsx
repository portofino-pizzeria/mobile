import { useUIComponent } from '@qontinui/ui-bridge-native';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BridgeButton } from '@/components/bridge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatEUR } from '@/lib/format';
import { cartLineKey, useCart } from '@/state/cart';

const DELIVERY_FEE = 299; // must match backend DELIVERY_FEE_CENTS

export default function CartScreen() {
  const theme = useTheme();
  const router = useRouter();
  const cart = useCart();

  useUIComponent({
    id: 'cart',
    name: 'Cart',
    actions: [
      { id: 'checkout', handler: async () => router.push('/checkout') },
      { id: 'clear', handler: async () => cart.clear() },
    ],
  });

  if (cart.count === 0) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText type="subtitle">Dein Warenkorb ist leer</ThemedText>
        <BridgeButton
          uiId="cart-back-to-menu"
          uiLabel="Back to menu"
          style={[styles.primaryBtn, { backgroundColor: theme.text }]}
          onPress={() => router.replace('/')}>
          <ThemedText type="smallBold" style={{ color: theme.background }}>
            Zur Speisekarte
          </ThemedText>
        </BridgeButton>
      </ThemedView>
    );
  }

  const total = cart.subtotal + DELIVERY_FEE;

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {cart.lines.map(({ item, variant, quantity }) => (
          <ThemedView
            key={cartLineKey(item.id, variant.id)}
            type="backgroundElement"
            style={styles.row}>
            <View style={styles.rowInfo}>
              <ThemedText type="smallBold">
                {item.number ? `${item.number}  ` : ''}
                {item.name}, {variant.label}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {formatEUR(variant.price)} pro Stück
              </ThemedText>
            </View>
            <View style={styles.stepper}>
              {/* Variant-keyed: two sizes of one pizza are two addressable
                  lines, not one ambiguous id the bridge cannot resolve. */}
              <BridgeButton
                uiId={`cart-dec-${item.id}-${variant.id}`}
                uiLabel={`Decrease ${item.name} (${variant.label})`}
                style={[styles.stepBtn, { borderColor: theme.textSecondary }]}
                onPress={() => cart.setQuantity(item.id, variant.id, quantity - 1)}>
                <ThemedText type="smallBold">−</ThemedText>
              </BridgeButton>
              <ThemedText type="smallBold" style={styles.qty}>
                {quantity}
              </ThemedText>
              <BridgeButton
                uiId={`cart-inc-${item.id}-${variant.id}`}
                uiLabel={`Increase ${item.name} (${variant.label})`}
                style={[styles.stepBtn, { borderColor: theme.textSecondary }]}
                onPress={() => cart.setQuantity(item.id, variant.id, quantity + 1)}>
                <ThemedText type="smallBold">+</ThemedText>
              </BridgeButton>
            </View>
            <ThemedText type="smallBold" style={styles.lineTotal}>
              {formatEUR(variant.price * quantity)}
            </ThemedText>
          </ThemedView>
        ))}

        <View style={styles.summary}>
          <SummaryRow label="Zwischensumme" value={formatEUR(cart.subtotal)} />
          <SummaryRow label="Lieferung" value={formatEUR(DELIVERY_FEE)} />
          <SummaryRow label="Gesamt" value={formatEUR(total)} bold />
        </View>
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.footer}>
        <BridgeButton
          uiId="cart-checkout"
          uiLabel="Proceed to checkout"
          style={[styles.primaryBtn, { backgroundColor: theme.text }]}
          onPress={() => router.push('/checkout')}>
          <ThemedText type="smallBold" style={{ color: theme.background }}>
            Zur Kasse · {formatEUR(total)}
          </ThemedText>
        </BridgeButton>
      </SafeAreaView>
    </ThemedView>
  );
}

function SummaryRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <View style={styles.summaryRow}>
      <ThemedText type={bold ? 'smallBold' : 'small'} themeColor={bold ? 'text' : 'textSecondary'}>
        {label}
      </ThemedText>
      <ThemedText type={bold ? 'smallBold' : 'small'}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three, padding: Spacing.four },
  scroll: { padding: Spacing.three, gap: Spacing.two, maxWidth: 800, width: '100%', alignSelf: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.two },
  rowInfo: { flex: 1, gap: Spacing.half },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  stepBtn: { width: 32, height: 32, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  qty: { minWidth: 20, textAlign: 'center' },
  lineTotal: { minWidth: 64, textAlign: 'right' },
  summary: { marginTop: Spacing.three, gap: Spacing.one },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  footer: { padding: Spacing.three },
  primaryBtn: { padding: Spacing.three, borderRadius: Spacing.three, alignItems: 'center' },
});

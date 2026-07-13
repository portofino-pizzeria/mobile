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
import { useCart } from '@/state/cart';

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
        <ThemedText type="subtitle">Your cart is empty</ThemedText>
        <BridgeButton
          uiId="cart-back-to-menu"
          uiLabel="Back to menu"
          style={[styles.primaryBtn, { backgroundColor: theme.text }]}
          onPress={() => router.replace('/')}>
          <ThemedText type="smallBold" style={{ color: theme.background }}>
            Browse the menu
          </ThemedText>
        </BridgeButton>
      </ThemedView>
    );
  }

  const total = cart.subtotal + DELIVERY_FEE;

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {cart.lines.map(({ item, quantity }) => (
          <ThemedView key={item.id} type="backgroundElement" style={styles.row}>
            <View style={styles.rowInfo}>
              <ThemedText type="smallBold">{item.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {formatEUR(item.price)} each
              </ThemedText>
            </View>
            <View style={styles.stepper}>
              <BridgeButton
                uiId={`cart-dec-${item.id}`}
                uiLabel={`Decrease ${item.name}`}
                style={[styles.stepBtn, { borderColor: theme.textSecondary }]}
                onPress={() => cart.setQuantity(item.id, quantity - 1)}>
                <ThemedText type="smallBold">−</ThemedText>
              </BridgeButton>
              <ThemedText type="smallBold" style={styles.qty}>
                {quantity}
              </ThemedText>
              <BridgeButton
                uiId={`cart-inc-${item.id}`}
                uiLabel={`Increase ${item.name}`}
                style={[styles.stepBtn, { borderColor: theme.textSecondary }]}
                onPress={() => cart.setQuantity(item.id, quantity + 1)}>
                <ThemedText type="smallBold">+</ThemedText>
              </BridgeButton>
            </View>
            <ThemedText type="smallBold" style={styles.lineTotal}>
              {formatEUR(item.price * quantity)}
            </ThemedText>
          </ThemedView>
        ))}

        <View style={styles.summary}>
          <SummaryRow label="Subtotal" value={formatEUR(cart.subtotal)} />
          <SummaryRow label="Delivery" value={formatEUR(DELIVERY_FEE)} />
          <SummaryRow label="Total" value={formatEUR(total)} bold />
        </View>
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.footer}>
        <BridgeButton
          uiId="cart-checkout"
          uiLabel="Proceed to checkout"
          style={[styles.primaryBtn, { backgroundColor: theme.text }]}
          onPress={() => router.push('/checkout')}>
          <ThemedText type="smallBold" style={{ color: theme.background }}>
            Checkout · {formatEUR(total)}
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

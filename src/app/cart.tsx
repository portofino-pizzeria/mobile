import { useUIComponent } from '@qontinui/ui-bridge-native';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BridgeButton } from '@/components/bridge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
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
          uiLabel="Zurück zur Speisekarte"
          style={({ pressed }) => [
            styles.primaryBtn,
            { backgroundColor: pressed ? theme.brandPressed : theme.brand },
          ]}
          onPress={() => router.replace('/')}>
          <ThemedText type="smallBold" style={{ color: theme.onBrand }}>
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
              <ThemedText type="heading">
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
                uiLabel={`${item.name} (${variant.label}) verringern`}
                style={({ pressed }) => [
                  styles.stepBtn,
                  pressed
                    ? { borderColor: theme.brandPressed, backgroundColor: theme.backgroundSelected }
                    : { borderColor: theme.brand },
                ]}
                onPress={() => cart.setQuantity(item.id, variant.id, quantity - 1)}>
                <ThemedText type="smallBold" themeColor="brand">−</ThemedText>
              </BridgeButton>
              <ThemedText type="smallBold" style={styles.qty}>
                {quantity}
              </ThemedText>
              <BridgeButton
                uiId={`cart-inc-${item.id}-${variant.id}`}
                uiLabel={`${item.name} (${variant.label}) erhöhen`}
                style={({ pressed }) => [
                  styles.stepBtn,
                  pressed
                    ? { borderColor: theme.brandPressed, backgroundColor: theme.backgroundSelected }
                    : { borderColor: theme.brand },
                ]}
                onPress={() => cart.setQuantity(item.id, variant.id, quantity + 1)}>
                <ThemedText type="smallBold" themeColor="brand">+</ThemedText>
              </BridgeButton>
            </View>
            <ThemedText type="price" style={styles.lineTotal}>
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
          uiLabel="Zur Kasse"
          style={({ pressed }) => [
            styles.primaryBtn,
            { backgroundColor: pressed ? theme.brandPressed : theme.brand },
          ]}
          onPress={() => router.push('/checkout')}>
          <ThemedText type="smallBold" style={{ color: theme.onBrand }}>
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
      {/* Every figure in this column is a price, so every one carries the
          brand red; weight — not hue — is what marks the total. */}
      <ThemedText type={bold ? 'price' : 'small'} themeColor="brand">
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg, padding: Spacing.xl },
  scroll: { padding: Spacing.lg, gap: Spacing.sm, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', padding: Spacing.lg, borderRadius: Radius.card, gap: Spacing.sm },
  rowInfo: { flex: 1, gap: Spacing.xs },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  stepBtn: { width: 32, height: 32, borderRadius: Radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  qty: { minWidth: 20, textAlign: 'center' },
  lineTotal: { minWidth: 64, textAlign: 'right' },
  summary: { marginTop: Spacing.lg, gap: Spacing.xs },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  footer: { padding: Spacing.lg },
  primaryBtn: { padding: Spacing.lg, borderRadius: Radius.card, alignItems: 'center' },
});

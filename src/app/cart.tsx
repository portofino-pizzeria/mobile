import { useUIComponent } from '@qontinui/ui-bridge-native';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BridgeButton } from '@/components/bridge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { deliveryFeeFor } from '@/lib/fees';
import { formatEUR } from '@/lib/format';
import { cartLineKey, useCart } from '@/state/cart';


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
        <ThemedText type="subtitle" style={styles.centerText}>
          Dein Warenkorb ist leer
        </ThemedText>
        <BridgeButton
          uiId="cart-back-to-menu"
          uiLabel="Zurück zur Speisekarte"
          style={({ pressed }) => [
            styles.primaryBtn,
            { backgroundColor: pressed ? theme.brandPressed : theme.brand },
          ]}
          onPress={() => router.replace('/')}>
          <ThemedText type="smallBold" themeColor="onBrand">
            Zur Speisekarte
          </ThemedText>
        </BridgeButton>
      </ThemedView>
    );
  }

  const fee = deliveryFeeFor(cart.fulfilment);
  const total = cart.subtotal + fee;

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {cart.lines.map(({ item, variant, quantity }, index) => (
          <View
            key={cartLineKey(item.id, variant.id)}
            style={[
              styles.row,
              index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.backgroundSelected },
            ]}>
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
                    ? { borderColor: theme.brand, backgroundColor: theme.brand }
                    : { borderColor: theme.backgroundSelected, backgroundColor: theme.backgroundElement },
                ]}
                onPress={() => cart.setQuantity(item.id, variant.id, quantity - 1)}>
                {({ pressed }) => (
                  <ThemedText type="smallBold" themeColor={pressed ? 'onBrand' : 'brandText'}>
                    −
                  </ThemedText>
                )}
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
                    ? { borderColor: theme.brand, backgroundColor: theme.brand }
                    : { borderColor: theme.backgroundSelected, backgroundColor: theme.backgroundElement },
                ]}
                onPress={() => cart.setQuantity(item.id, variant.id, quantity + 1)}>
                {({ pressed }) => (
                  <ThemedText type="smallBold" themeColor={pressed ? 'onBrand' : 'brandText'}>
                    +
                  </ThemedText>
                )}
              </BridgeButton>
            </View>
            <ThemedText type="price" style={styles.lineTotal}>
              {formatEUR(variant.price * quantity)}
            </ThemedText>
          </View>
        ))}

        <View style={[styles.summary, { borderTopColor: theme.backgroundSelected }]}>
          <SummaryRow label="Zwischensumme" value={formatEUR(cart.subtotal)} />
          <SummaryRow
            label={cart.fulfilment === 'pickup' ? 'Abholung' : 'Lieferung'}
            value={formatEUR(fee)}
          />
          <SummaryRow label="Gesamt" value={formatEUR(total)} bold />
          <ThemedText type="small" themeColor="textSecondary" style={styles.modeHint}>
            Lieferung oder Abholung wählst du an der Kasse. Bei Abholung entfällt die
            Liefergebühr.
          </ThemedText>
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
          <ThemedText type="smallBold" themeColor="onBrand">
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
      {/* Weight, not hue, marks the total — prices are ink in the design. */}
      <ThemedText type={bold ? 'price' : 'small'} themeColor={bold ? 'text' : 'textSecondary'}>
        {value}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg, padding: Spacing.xl },
  centerText: { textAlign: 'center' },
  scroll: { paddingHorizontal: Spacing.gutter, paddingVertical: Spacing.lg, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.gutter, gap: Spacing.sm },
  rowInfo: { flex: 1, gap: Spacing.xs },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  stepBtn: { width: 32, height: 32, borderRadius: Radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  qty: { minWidth: 20, textAlign: 'center' },
  lineTotal: { minWidth: 64, textAlign: 'right' },
  summary: { marginTop: Spacing.sm, paddingTop: Spacing.lg, gap: Spacing.xs, borderTopWidth: 1 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  modeHint: { marginTop: Spacing.sm },
  footer: { paddingHorizontal: Spacing.gutter, paddingVertical: Spacing.lg, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  primaryBtn: { padding: Spacing.lg, borderRadius: Radius.card, alignItems: 'center', minHeight: 44 },
});

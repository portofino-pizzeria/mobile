import { useUIComponent } from '@qontinui/ui-bridge-native';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BridgeButton } from '@/components/bridge';
import { MascotPass } from '@/components/mascot-pass';
import { OrderTotals, extrasText, lineMeta, totalsFor } from '@/components/order-summary';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatEUR } from '@/lib/format';
import { cartMascot } from '@/lib/mascots';
import { keyOf, lineUiId, lineUnitPrice, useCart } from '@/state/cart';


export default function CartScreen() {
  const theme = useTheme();
  const router = useRouter();
  const cart = useCart();
  const [footerHeight, setFooterHeight] = useState(0);

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

  const total = totalsFor(cart.subtotal, cart.fulfilment).total;

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {cart.lines.map((line, index) => {
          const { item, variant, extras, quantity } = line;
          const key = keyOf(line);
          const unit = lineUnitPrice(line);
          const extrasLine = extrasText(extras);
          return (
          <View
            key={key}
            style={[
              styles.row,
              index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.backgroundSelected },
            ]}>
            <View style={styles.rowInfo}>
              <ThemedText type="heading">
                {item.name}, {variant.label}
              </ThemedText>
              {extrasLine ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {extrasLine}
                </ThemedText>
              ) : null}
              {/* The dish number is labelled and sits away from the stepper's
                  quantity. Unlabelled and adjacent, the two numerals name two
                  different things and look like one. Same helper the checkout
                  panel uses, so the two screens cannot come to spell one line
                  two ways; the unit price is always shown HERE because the
                  stepper beside it is what changes the quantity. */}
              <ThemedText type="small" themeColor="textSecondary">
                {lineMeta(item.number, unit, { unitPrice: true })}
              </ThemedText>
            </View>
            <View style={styles.stepper}>
              {/* Variant-keyed: two sizes of one pizza are two addressable
                  lines, not one ambiguous id the bridge cannot resolve. */}
              <BridgeButton
                uiId={`cart-dec-${lineUiId(line)}`}
                uiLabel={`${item.name} (${variant.label}${extras.length ? ', mit Extras' : ''}) verringern`}
                style={({ pressed }) => [
                  styles.stepBtn,
                  pressed
                    ? { borderColor: theme.brand, backgroundColor: theme.brand }
                    : { borderColor: theme.backgroundSelected, backgroundColor: theme.backgroundElement },
                ]}
                onPress={() => cart.setQuantity(key, quantity - 1)}>
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
                uiId={`cart-inc-${lineUiId(line)}`}
                uiLabel={`${item.name} (${variant.label}${extras.length ? ', mit Extras' : ''}) erhöhen`}
                style={({ pressed }) => [
                  styles.stepBtn,
                  pressed
                    ? { borderColor: theme.brand, backgroundColor: theme.brand }
                    : { borderColor: theme.backgroundSelected, backgroundColor: theme.backgroundElement },
                ]}
                onPress={() => cart.setQuantity(key, quantity + 1)}>
                {({ pressed }) => (
                  <ThemedText type="smallBold" themeColor={pressed ? 'onBrand' : 'brandText'}>
                    +
                  </ThemedText>
                )}
              </BridgeButton>
            </View>
            <ThemedText type="price" style={styles.lineTotal}>
              {formatEUR(unit * quantity)}
            </ThemedText>
          </View>
          );
        })}

        <View style={[styles.summary, { borderTopColor: theme.backgroundSelected }]}>
          <OrderTotals totals={totalsFor(cart.subtotal, cart.fulfilment)} fulfilment={cart.fulfilment} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.modeHint}>
            Lieferung oder Abholung wählst du an der Kasse. Bei Abholung entfällt die
            Liefergebühr.
          </ThemedText>
        </View>
      </ScrollView>

      <SafeAreaView
        edges={['bottom']}
        style={styles.footer}
        onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}>
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

      {/* Stands on the checkout button's top edge, at the left, and points
          along it. The button's top is the footer's height less its top
          padding; the extra step sinks the Lottie's empty margin under the
          feet. Waits for the footer's height so it lands on the button. */}
      {footerHeight > 0 ? (
        <MascotPass
          id="cart-mascot"
          animation={cartMascot}
          stopAt={0.22}
          bottom={footerHeight - Spacing.lg - Spacing.sm}
        />
      ) : null}
    </ThemedView>
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
  modeHint: { marginTop: Spacing.sm },
  footer: { paddingHorizontal: Spacing.gutter, paddingVertical: Spacing.lg, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  primaryBtn: { padding: Spacing.lg, borderRadius: Radius.card, alignItems: 'center', minHeight: 44 },
});

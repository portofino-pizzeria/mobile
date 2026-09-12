import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BridgeButton } from '@/components/bridge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, errorReason } from '@/lib/api';
import { formatEUR } from '@/lib/format';
import type { Order } from '@/lib/types';

const STATUS_COPY: Record<Order['status'], { emoji: string; title: string; sub: string }> = {
  pending_payment: { emoji: '⏳', title: 'Warten auf Zahlung', sub: 'Schließe die Zahlung ab, um deine Bestellung zu bestätigen.' },
  paid: { emoji: '✅', title: 'Zahlung erhalten', sub: 'Deine Bestellung ist bestätigt und geht in die Küche.' },
  preparing: { emoji: '👨‍🍳', title: 'In Zubereitung', sub: 'Unser Pizzabäcker ist dran.' },
  ready: { emoji: '🛵', title: 'Unterwegs', sub: 'Deine Bestellung ist auf dem Weg!' },
  cancelled: { emoji: '❌', title: 'Storniert', sub: 'Diese Bestellung wurde storniert.' },
};

export default function OrderScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;

    async function poll() {
      try {
        const next = await api.getOrder(id);
        if (!active) return;
        setOrder(next);
        // Keep polling until a terminal-ish state is reached.
        if (next.status === 'pending_payment') {
          timer = setTimeout(poll, 2000);
        }
      } catch (e) {
        if (active) setError(errorReason(e));
      }
    }

    let timer: ReturnType<typeof setTimeout>;
    poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [id]);

  if (error) {
    return (
      <ThemedView style={styles.center}>
        <ThemedText type="subtitle">Bestellung konnte nicht geladen werden</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {error}
        </ThemedText>
      </ThemedView>
    );
  }

  if (!order) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  const copy = STATUS_COPY[order.status];
  // The delivery details as the server stored them. An order read may carry any
  // subset of the fields: the API does not yet refuse an order without them
  // (backend#9), and orders from before checkout required them carry none. A
  // missing address is said outright rather than left out, because a block
  // without one reads as complete. A value that is only whitespace counts as
  // missing, and a note that is only whitespace is not a note, as on the
  // kitchen card.
  //
  // The phone number is left out only because the diner already knows it. It
  // is not protected: the order read has no authentication and returns it to
  // anyone holding the order link, as it does the name and address.
  const customer = order.customer ?? {};
  const name = customer.name?.trim() || null;
  const address = customer.address?.trim() || null;
  const note = customer.notes?.trim() || null;

  return (
    <ThemedView style={styles.screen}>
      {/* Scrolls, because a long order plus the delivery block can overflow a
          small phone. The bottom inset keeps the button clear of the home
          indicator. */}
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: Spacing.lg + insets.bottom }]}>
        <View style={styles.hero}>
          <ThemedText style={styles.emoji}>{copy.emoji}</ThemedText>
          <ThemedText type="subtitle" style={styles.center}>
            {copy.title}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            {copy.sub}
          </ThemedText>
          {order.status === 'pending_payment' ? (
            <ActivityIndicator style={{ marginTop: Spacing.sm }} />
          ) : null}
        </View>

        <ThemedView type="backgroundElement" style={styles.summary}>
          <ThemedText type="small" themeColor="textSecondary">
            Bestellung #{order.id.slice(0, 8)}
          </ThemedText>
          {/* Snapshotted lines are (item, variant) pairs — keyed on both, so two
              sizes of one dish stay two rows. */}
          {order.lines.map((line) => (
            <View key={`${line.menuItemId}::${line.variantId}`} style={styles.summaryRow}>
              <ThemedText type="small">
                {line.quantity}× {line.name}, {line.variantLabel}
              </ThemedText>
              <ThemedText type="price">{formatEUR(line.unitPrice * line.quantity)}</ThemedText>
            </View>
          ))}
          <View style={[styles.summaryRow, styles.totalRow]}>
            <ThemedText type="smallBold">Gesamt</ThemedText>
            <ThemedText type="price">{formatEUR(order.total)}</ThemedText>
          </View>
        </ThemedView>

        {/* Lets the diner check the address and that the delivery note arrived. */}
        <ThemedView type="backgroundElement" style={styles.summary}>
          <ThemedText type="small" themeColor="textSecondary">
            Lieferdaten
          </ThemedText>
          {name ? <ThemedText type="small">{name}</ThemedText> : null}
          {address ? (
            <ThemedText type="small">{address}</ThemedText>
          ) : (
            <ThemedText type="small" style={{ color: theme.alertUndeclared }}>
              Keine Lieferadresse hinterlegt
            </ThemedText>
          )}
          {note ? (
            <ThemedText type="small" themeColor="textSecondary">
              Hinweis: {note}
            </ThemedText>
          ) : null}
        </ThemedView>

        <BridgeButton
          uiId="order-back-to-menu"
          uiLabel="Zurück zur Speisekarte"
          style={({ pressed }) => [
            styles.btn,
            { backgroundColor: pressed ? theme.brandPressed : theme.brand },
          ]}
          onPress={() => router.replace('/')}>
          <ThemedText type="smallBold" style={{ color: theme.onBrand }}>
            Zur Speisekarte
          </ThemedText>
        </BridgeButton>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { padding: Spacing.lg, gap: Spacing.xl, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center' },
  center: { textAlign: 'center', alignItems: 'center', justifyContent: 'center' },
  hero: { alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.xxl },
  emoji: { fontSize: 64, lineHeight: 72 },
  summary: { padding: Spacing.lg, borderRadius: Radius.card, gap: Spacing.xs },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalRow: { marginTop: Spacing.xs },
  btn: { padding: Spacing.lg, borderRadius: Radius.card, alignItems: 'center' },
});

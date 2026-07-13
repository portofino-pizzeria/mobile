import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { BridgeButton } from '@/components/bridge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api } from '@/lib/api';
import { formatEUR } from '@/lib/format';
import type { Order } from '@/lib/types';

const STATUS_COPY: Record<Order['status'], { emoji: string; title: string; sub: string }> = {
  pending_payment: { emoji: '⏳', title: 'Waiting for payment', sub: 'Complete payment to confirm your order.' },
  paid: { emoji: '✅', title: 'Payment received', sub: 'Your order is confirmed and heading to the kitchen.' },
  preparing: { emoji: '👨‍🍳', title: 'Preparing', sub: 'Our pizzaiolo is on it.' },
  ready: { emoji: '🛵', title: 'Out for delivery', sub: 'Your order is on its way!' },
  cancelled: { emoji: '❌', title: 'Cancelled', sub: 'This order was cancelled.' },
};

export default function OrderScreen() {
  const theme = useTheme();
  const router = useRouter();
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
        if (active) setError((e as Error).message);
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
        <ThemedText type="subtitle">Couldn’t load your order</ThemedText>
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

  return (
    <ThemedView style={styles.container}>
      <View style={styles.hero}>
        <ThemedText style={styles.emoji}>{copy.emoji}</ThemedText>
        <ThemedText type="subtitle" style={styles.center}>
          {copy.title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          {copy.sub}
        </ThemedText>
        {order.status === 'pending_payment' ? (
          <ActivityIndicator style={{ marginTop: Spacing.two }} />
        ) : null}
      </View>

      <ThemedView type="backgroundElement" style={styles.summary}>
        <ThemedText type="small" themeColor="textSecondary">
          Order #{order.id.slice(0, 8)}
        </ThemedText>
        {order.lines.map((line) => (
          <View key={line.menuItemId} style={styles.summaryRow}>
            <ThemedText type="small">
              {line.quantity}× {line.name}
            </ThemedText>
            <ThemedText type="small">{formatEUR(line.unitPrice * line.quantity)}</ThemedText>
          </View>
        ))}
        <View style={[styles.summaryRow, styles.totalRow]}>
          <ThemedText type="smallBold">Total</ThemedText>
          <ThemedText type="smallBold">{formatEUR(order.total)}</ThemedText>
        </View>
      </ThemedView>

      <BridgeButton
        uiId="order-back-to-menu"
        uiLabel="Back to menu"
        style={[styles.btn, { backgroundColor: theme.text }]}
        onPress={() => router.replace('/')}>
        <ThemedText type="smallBold" style={{ color: theme.background }}>
          Back to menu
        </ThemedText>
      </BridgeButton>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: Spacing.three, gap: Spacing.four, maxWidth: 800, width: '100%', alignSelf: 'center' },
  center: { textAlign: 'center', alignItems: 'center', justifyContent: 'center' },
  hero: { alignItems: 'center', gap: Spacing.two, marginTop: Spacing.five },
  emoji: { fontSize: 64, lineHeight: 72 },
  summary: { padding: Spacing.three, borderRadius: Spacing.three, gap: Spacing.one },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalRow: { marginTop: Spacing.one },
  btn: { padding: Spacing.three, borderRadius: Spacing.three, alignItems: 'center' },
});

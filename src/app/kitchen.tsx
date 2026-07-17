import { useUIComponent } from '@qontinui/ui-bridge-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BridgeButton, BridgeInput } from '@/components/bridge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatEUR } from '@/lib/format';
import {
  getKitchenToken,
  KitchenApiError,
  kitchenApi,
  setKitchenToken,
  type KitchenStatus,
} from '@/lib/kitchen';
import type { Order, OrderStatus } from '@/lib/types';

const POLL_MS = 5000;

// The three lanes the kitchen works through, left to right.
const LANES: { status: Extract<OrderStatus, 'paid' | 'preparing' | 'ready'>; title: string; accent: string }[] = [
  { status: 'paid', title: 'New', accent: '#f5a524' },
  { status: 'preparing', title: 'Preparing', accent: '#635bff' },
  { status: 'ready', title: 'Ready', accent: '#17c964' },
];

function minutesAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins === 1) return '1 min ago';
  if (mins < 60) return `${mins} mins ago`;
  const h = Math.floor(mins / 60);
  return `${h}h ${mins % 60}m ago`;
}

export default function KitchenScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const wide = width >= 900;

  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsToken, setNeedsToken] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    try {
      const next = await kitchenApi.list('active');
      if (!mounted.current) return;
      setOrders(next);
      setError(null);
      setNeedsToken(false);
    } catch (e) {
      if (!mounted.current) return;
      if (e instanceof KitchenApiError && e.status === 401) {
        setNeedsToken(true);
      } else {
        setError((e as Error).message);
      }
    }
  }, []);

  // Poll while the screen is open.
  useEffect(() => {
    mounted.current = true;
    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, [load]);

  const advance = useCallback(
    async (order: Order, status: KitchenStatus) => {
      setBusyId(order.id);
      try {
        await kitchenApi.setStatus(order.id, status);
        await load();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  // Let the runner drive the board semantically (e.g. kitchen.advance).
  useUIComponent({
    id: 'kitchen',
    name: 'Kitchen',
    actions: [
      {
        id: 'setStatus',
        handler: async (params) => {
          const { orderId, status } = (params ?? {}) as {
            orderId?: string;
            status?: KitchenStatus;
          };
          const order = orders?.find((o) => o.id === orderId);
          if (order && status) await advance(order, status);
        },
      },
    ],
  });

  function submitToken() {
    setKitchenToken(tokenInput.trim());
    setTokenInput('');
    setOrders(null);
    load();
  }

  // --- Token gate (deployed environments) ----------------------------------
  if (needsToken) {
    return (
      <ThemedView style={styles.center}>
        <View style={styles.tokenCard}>
          <ThemedText type="subtitle">Kitchen access</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Enter the kitchen access token to view live orders.
          </ThemedText>
          <BridgeInput
            uiId="kitchen-token"
            uiLabel="Kitchen token"
            value={tokenInput}
            onChangeText={setTokenInput}
            placeholder="token…"
            placeholderTextColor={theme.textSecondary}
            secureTextEntry
            style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
          />
          <BridgeButton
            uiId="kitchen-token-submit"
            uiLabel="Unlock kitchen"
            style={[styles.primaryBtn, { backgroundColor: theme.text }]}
            onPress={submitToken}>
            <ThemedText type="smallBold" style={{ color: theme.background }}>
              Unlock
            </ThemedText>
          </BridgeButton>
        </View>
      </ThemedView>
    );
  }

  if (!orders && !error) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  const byLane = (status: OrderStatus) => (orders ?? []).filter((o) => o.status === status);

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }>
        <View style={styles.header}>
          <ThemedText type="subtitle">Kitchen</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {(orders ?? []).length} active {(orders ?? []).length === 1 ? 'order' : 'orders'} · auto-refreshing
          </ThemedText>
        </View>

        {error ? (
          <ThemedText type="small" style={{ color: '#e5484d' }}>
            {error}
          </ThemedText>
        ) : null}

        <View style={[styles.board, wide ? styles.boardRow : styles.boardColumn]}>
          {LANES.map((lane) => {
            const laneOrders = byLane(lane.status);
            return (
              <View key={lane.status} style={[styles.lane, wide && styles.laneWide]}>
                <View style={styles.laneHeader}>
                  <View style={[styles.dot, { backgroundColor: lane.accent }]} />
                  <ThemedText type="smallBold">{lane.title}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {laneOrders.length}
                  </ThemedText>
                </View>

                {laneOrders.length === 0 ? (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
                    Nothing here.
                  </ThemedText>
                ) : (
                  laneOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      accent={lane.accent}
                      busy={busyId === order.id}
                      onAdvance={advance}
                    />
                  ))
                )}
              </View>
            );
          })}
        </View>

        <View style={{ height: Spacing.six }} />
      </ScrollView>
    </ThemedView>
  );
}

function OrderCard({
  order,
  accent,
  busy,
  onAdvance,
}: {
  order: Order;
  accent: string;
  busy: boolean;
  onAdvance: (order: Order, status: KitchenStatus) => void;
}) {
  const theme = useTheme();
  const nextLabel =
    order.status === 'paid' ? 'Start preparing' : order.status === 'preparing' ? 'Mark ready' : null;
  const nextStatus: KitchenStatus | null =
    order.status === 'paid' ? 'preparing' : order.status === 'preparing' ? 'ready' : null;

  return (
    <ThemedView type="backgroundElement" style={[styles.card, { borderLeftColor: accent }]}>
      <View style={styles.cardTop}>
        <ThemedText type="smallBold">#{order.id.slice(0, 8)}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {minutesAgo(order.createdAt)}
        </ThemedText>
      </View>

      {order.customer?.name || order.customer?.phone ? (
        <ThemedText type="small">
          {order.customer?.name}
          {order.customer?.phone ? ` · ${order.customer.phone}` : ''}
        </ThemedText>
      ) : null}
      {order.customer?.address ? (
        <ThemedText type="small" themeColor="textSecondary">
          {order.customer.address}
        </ThemedText>
      ) : null}

      <View style={styles.lines}>
        {order.lines.map((l) => (
          <View key={l.menuItemId} style={styles.lineRow}>
            <ThemedText type="small">
              {l.quantity}× {l.name}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {formatEUR(l.unitPrice * l.quantity)}
            </ThemedText>
          </View>
        ))}
      </View>

      <View style={styles.cardFooter}>
        <ThemedText type="smallBold">{formatEUR(order.total)}</ThemedText>
      </View>

      <View style={styles.actions}>
        {nextStatus && nextLabel ? (
          <BridgeButton
            uiId={`kitchen-advance-${order.id}`}
            uiLabel={`${nextLabel} for order ${order.id.slice(0, 8)}`}
            disabled={busy}
            style={[styles.primaryBtn, { backgroundColor: theme.text, opacity: busy ? 0.5 : 1, flex: 1 }]}
            onPress={() => onAdvance(order, nextStatus)}>
            {busy ? (
              <ActivityIndicator color={theme.background} />
            ) : (
              <ThemedText type="smallBold" style={{ color: theme.background }}>
                {nextLabel}
              </ThemedText>
            )}
          </BridgeButton>
        ) : (
          <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1 }}>
            Ready for pickup / delivery.
          </ThemedText>
        )}
        <BridgeButton
          uiId={`kitchen-cancel-${order.id}`}
          uiLabel={`Cancel order ${order.id.slice(0, 8)}`}
          disabled={busy}
          style={[styles.cancelBtn, { borderColor: theme.backgroundSelected }]}
          onPress={() => onAdvance(order, 'cancelled')}>
          <ThemedText type="small" themeColor="textSecondary">
            Cancel
          </ThemedText>
        </BridgeButton>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
  scroll: { padding: Spacing.three, gap: Spacing.three, width: '100%', maxWidth: 1200, alignSelf: 'center' },
  header: { gap: Spacing.half },

  board: { gap: Spacing.three },
  boardRow: { flexDirection: 'row', alignItems: 'flex-start' },
  boardColumn: { flexDirection: 'column' },
  lane: { gap: Spacing.two },
  laneWide: { flex: 1 },
  laneHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.one },
  dot: { width: 10, height: 10, borderRadius: 999 },
  empty: { paddingVertical: Spacing.two },

  card: {
    borderRadius: Spacing.three,
    borderLeftWidth: 4,
    padding: Spacing.three,
    gap: Spacing.half,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lines: { marginTop: Spacing.one, gap: 2 },
  lineRow: { flexDirection: 'row', justifyContent: 'space-between' },
  cardFooter: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: Spacing.one },
  actions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two, alignItems: 'center' },

  tokenCard: { width: '100%', maxWidth: 360, gap: Spacing.two },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  primaryBtn: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  cancelBtn: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
});

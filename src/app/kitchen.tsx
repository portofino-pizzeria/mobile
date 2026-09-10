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

import { BridgeButton, BridgeInput } from '@/components/bridge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatEUR } from '@/lib/format';
import {
  KitchenApiError,
  kitchenApi,
  setKitchenToken,
  type KitchenStatus,
} from '@/lib/kitchen';
import type { Order, OrderStatus } from '@/lib/types';

const POLL_MS = 5000;

// A RED FILL DOES NOT APPEAR ON THIS SCREEN, and the omission is the rule
// rather than an oversight — see `constants/theme.ts`, "Where a red FILL is
// allowed". A cook's red must stay available to mean "careful"; the brand red
// is here in the headings and the prices, which is where the spec puts it.
//
// The three lanes the kitchen works through, left to right.
//
// These three accents are UNDECLARED by `domain_spec/visual-system` — that
// document's semantic-colour contract exists but names no status set, and its
// `Declared UNKNOWN` list is where an alert treatment still sits. They are
// carried forward as shipped rather than re-chosen here: picking a status
// palette in code would be authoring intent. They do discriminate their three
// values, which is the one property the contract does require.
const LANES: { status: Extract<OrderStatus, 'paid' | 'preparing' | 'ready'>; title: string; accent: string }[] = [
  { status: 'paid', title: 'Neu', accent: '#f5a524' },
  { status: 'preparing', title: 'In Zubereitung', accent: '#635bff' },
  { status: 'ready', title: 'Fertig', accent: '#17c964' },
];

function minutesAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'gerade eben';
  if (mins === 1) return 'vor 1 Minute';
  if (mins < 60) return `vor ${mins} Minuten`;
  const h = Math.floor(mins / 60);
  const rest = mins % 60;
  // Past a day the elapsed figure gets noisy ("vor 290 Std."), so the UNIT is
  // capped — but the elapsed reading itself is kept, deliberately.
  //
  // This board only ever loads ACTIVE orders (`kitchenApi.list('active')`), so
  // an order still sitting in a lane after a day IS a stuck order, and the
  // elapsed figure is the alarm. A wall-clock stamp ("Di., 14:32") reads as an
  // ordinary timestamp and hides exactly the case a cook needs to catch — and
  // without a date it cannot even tell last Tuesday from this one.
  //
  // Formatted by hand rather than through `toLocaleString` with options:
  // Intl option support on Android Hermes is partial, and a silently ignored
  // options object returns a full date string that would wrap this cell.
  if (h >= 24) {
    const days = Math.floor(h / 24);
    return days === 1 ? 'vor 1 Tag' : `vor ${days} Tagen`;
  }
  if (rest === 0) return h === 1 ? 'vor 1 Std.' : `vor ${h} Std.`;
  return `vor ${h} Std. ${rest} Min.`;
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

  // Poll while the screen is open. `load` only ever sets state after an await,
  // but the lint rule cannot see past the async boundary — so the first poll is
  // scheduled rather than called straight out of the effect body.
  useEffect(() => {
    mounted.current = true;
    const first = setTimeout(load, 0);
    const timer = setInterval(load, POLL_MS);
    return () => {
      mounted.current = false;
      clearTimeout(first);
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
          <ThemedText type="subtitle">Küchen-Zugang</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Bitte das Küchen-Kennwort eingeben, um die laufenden Bestellungen zu sehen.
          </ThemedText>
          <BridgeInput
            uiId="kitchen-token"
            uiLabel="Küchen-Kennwort"
            value={tokenInput}
            onChangeText={setTokenInput}
            placeholder="Kennwort…"
            placeholderTextColor={theme.textSecondary}
            secureTextEntry
            style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
          />
          <BridgeButton
            uiId="kitchen-token-submit"
            uiLabel="Küche freischalten"
            style={[styles.primaryBtn, { backgroundColor: theme.text }]}
            onPress={submitToken}>
            <ThemedText type="smallBold" style={{ color: theme.background }}>
              Freischalten
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
          <ThemedText type="subtitle">Küche</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {(orders ?? []).length}{' '}
            {(orders ?? []).length === 1 ? 'laufende Bestellung' : 'laufende Bestellungen'} ·
            wird automatisch aktualisiert
          </ThemedText>
        </View>

        {error ? (
          <ThemedText type="small" style={{ color: theme.alertUndeclared }}>
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
                    Nichts vorhanden.
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
    order.status === 'paid'
      ? 'Zubereitung starten'
      : order.status === 'preparing'
        ? 'Als fertig markieren'
        : null;
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
      {/* An order with no contact details rendered as BLANK space, which a cook
          reads as "pickup, nothing to deliver" — the surface inventing a fact.
          `ux-priorities`: honesty, never fabricate state.
          The wording states only what is known. An earlier draft said "nicht
          lieferbar", which asserts a second fact the payload does not carry
          either: an order with no contact block may be a walk-in. */}
      {!order.customer?.name && !order.customer?.phone && !order.customer?.address ? (
        <ThemedText type="small" style={{ color: theme.alertUndeclared }}>
          Keine Kontaktdaten hinterlegt
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
        <ThemedText type="price">{formatEUR(order.total)}</ThemedText>
      </View>

      <View style={styles.actions}>
        {nextStatus && nextLabel ? (
          <BridgeButton
            uiId={`kitchen-advance-${order.id}`}
            uiLabel={`${nextLabel} für Bestellung ${order.id.slice(0, 8)}`}
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
            Bereit zur Abholung / Lieferung.
          </ThemedText>
        )}
        <BridgeButton
          uiId={`kitchen-cancel-${order.id}`}
          uiLabel={`Bestellung ${order.id.slice(0, 8)} stornieren`}
          disabled={busy}
          style={[styles.cancelBtn, { borderColor: theme.backgroundSelected }]}
          onPress={() => onAdvance(order, 'cancelled')}>
          <ThemedText type="small" themeColor="textSecondary">
            Stornieren
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

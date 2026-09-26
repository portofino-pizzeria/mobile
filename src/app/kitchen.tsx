import { useUIComponent } from '@qontinui/ui-bridge-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import { BridgeButton, BridgeInput } from '@/components/bridge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { errorReason } from '@/lib/api';
import { formatEUR } from '@/lib/format';
import {
  KitchenApiError,
  kitchenApi,
  loadKitchenToken,
  setKitchenToken,
  type KitchenStatus,
} from '@/lib/kitchen';
import { fulfilmentOf, type Order, type OrderStatus } from '@/lib/types';

const POLL_MS = 5000;

/** The statuses the kitchen may set, as the server accepts them. */
const KITCHEN_STATUSES: readonly KitchenStatus[] = ['preparing', 'ready', 'cancelled'];

// The three lanes the kitchen works through, left to right.
//
// These three accents are not in the declared design, which names no status
// set. They are carried forward as shipped rather than re-chosen here: picking
// a status palette in code would be authoring intent.
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
  // The server's own reason for the last 401 that followed a token we SENT.
  // Null on a first visit with nothing stored — that is just the prompt, not a
  // rejection. Set, it is either "wrong token" or "this server has no token
  // configured", and the second is the one an operator cannot type their way
  // out of, so the gate shows it rather than prompting forever.
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  // The orders with a status change in flight, as the board shows them.
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(() => new Set());
  const mounted = useRef(true);
  // Only the newest `load` may set state. The poll keeps a headerless request
  // in flight while the gate is showing; if the operator submits a token and
  // that older request's 401 lands AFTER the new request's 200, it would bounce
  // a correctly unlocked screen back to the prompt with a false "wrong token".
  const loadSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    try {
      const next = await kitchenApi.list('active');
      if (!mounted.current || seq !== loadSeq.current) return;
      setOrders(next);
      setError(null);
      setNeedsToken(false);
      setAuthMessage(null);
    } catch (e) {
      if (!mounted.current || seq !== loadSeq.current) return;
      if (e instanceof KitchenApiError && e.status === 401) {
        setNeedsToken(true);
        setAuthMessage(e.tokenSent ? e.message : null);
      } else {
        setError(errorReason(e));
      }
    }
  }, []);

  // Poll while the screen is open. `load` only ever sets state after an await,
  // but the lint rule cannot see past the async boundary — so the first poll is
  // scheduled rather than called straight out of the effect body. The stored
  // token is read first: `load` reads it synchronously off the in-memory
  // cache, and on native that cache starts empty until this resolves.
  useEffect(() => {
    mounted.current = true;
    let timer: ReturnType<typeof setInterval> | undefined;
    const first = setTimeout(async () => {
      await loadKitchenToken();
      if (!mounted.current) return;
      load();
      timer = setInterval(load, POLL_MS);
    }, 0);
    return () => {
      mounted.current = false;
      clearTimeout(first);
      if (timer) clearInterval(timer);
    };
  }, [load]);

  // The same set, written synchronously. `busyIds` is a commit behind, and a
  // second tap or UI Bridge call on the same order can arrive before then.
  const updating = useRef(new Set<string>());

  /** Moves one order on. Resolves to null, or to the reason it did not; a
   *  failed request's reason is also shown on the board. Refuses while that
   *  order already has a change in flight: two requests for one order can land
   *  in either order, and the backend applies whichever lands last. */
  const advance = useCallback(
    async (order: Order, status: KitchenStatus): Promise<string | null> => {
      if (updating.current.has(order.id)) return 'Diese Bestellung wird gerade aktualisiert.';
      updating.current.add(order.id);
      setBusyIds(new Set(updating.current));
      try {
        await kitchenApi.setStatus(order.id, status);
        await load();
        return null;
      } catch (e) {
        // A 401 here means the same thing it means in `load`: the stored
        // token stopped working. Sending it to the board error would leave it
        // sitting under the board until the next poll's `load` reroutes it —
        // route it to the gate immediately instead.
        if (e instanceof KitchenApiError && e.status === 401) {
          setNeedsToken(true);
          setAuthMessage(e.tokenSent ? e.message : null);
          return e.message;
        }
        const reason = errorReason(e);
        setError(reason);
        return reason;
      } finally {
        updating.current.delete(order.id);
        setBusyIds(new Set(updating.current));
      }
    },
    [load],
  );

  // useUIComponent registers its action handlers once, at mount, and never
  // re-registers them. A handler that read `orders` directly would see the
  // first render's null forever and find no order to move, so it reads the
  // board and advance() through a ref written after every commit. getBoard
  // reads the rest of what the screen shows through the same ref, so it is one
  // commit behind as well.
  const live = useRef({ orders, advance, error, needsToken, authMessage, busyIds });
  useEffect(() => {
    live.current = { orders, advance, error, needsToken, authMessage, busyIds };
  });

  // Let the runner drive the board semantically (e.g. kitchen.setStatus).
  useUIComponent({
    id: 'kitchen',
    name: 'Kitchen',
    actions: [
      {
        id: 'setStatus',
        label: 'Move one active order to a new status',
        description:
          'Params: { orderId: string, status: "preparing" | "ready" | "cancelled" }. ' +
          'Fails with the reason, rather than resolving, when the order is not on the ' +
          'board, already has a change in flight, or the server refuses the change.',
        handler: async (params) => {
          const { orderId, status } = (params ?? {}) as {
            orderId?: string;
            status?: KitchenStatus;
          };
          if (!orderId) throw new Error('setStatus: orderId is required.');
          if (!status || !KITCHEN_STATUSES.includes(status)) {
            throw new Error(`setStatus: status must be one of ${KITCHEN_STATUSES.join(', ')}.`);
          }
          const order = live.current.orders?.find((o) => o.id === orderId);
          if (!order) throw new Error(`setStatus: no active order with id "${orderId}" on the board.`);
          // advance() refuses while this order already has a change in flight.
          const failure = await live.current.advance(order, status);
          if (failure) throw new Error(failure);
          return { orderId: order.id, status };
        },
      },
      {
        // setStatus needs an order id, and without this a workflow could only
        // learn one by parsing the card buttons' element ids.
        id: 'getBoard',
        label: 'Report what the kitchen board is currently showing',
        description:
          'No params. Returns { state: "token" | "loading" | "shown", error, orders }. ' +
          '"token" is the password prompt; `error` then carries the server\'s reason for ' +
          'refusing the token that was sent, if any, and a server with no token configured ' +
          'cannot be unlocked by any entry. When state is "shown", `error` is the reason ' +
          'the last load or status change failed, shown above the board. `orders` lists ' +
          'the active orders on the board as { orderId, status, busy, lines: [{ quantity, ' +
          'name, variantLabel, extras: string[] }] } and is empty unless state is "shown". `busy` is true ' +
          'while a status change for that order is in flight. The report follows the ' +
          'last render, so right after setStatus resolves it can still show the old ' +
          'status or busy: true. Poll until the order shows the new status or is gone ' +
          'from `orders` (a cancelled order leaves the board) rather than reading once. ' +
          'A setStatus that failed has already rejected, so there is nothing to wait for.',
        handler: async () => {
          const {
            orders: board,
            error: failure,
            needsToken: locked,
            authMessage: refusal,
            busyIds: busy,
          } = live.current;
          // The same order as the render: the token gate wins, and a failed
          // first load shows an empty board with its reason.
          const state = locked ? 'token' : board || failure ? 'shown' : 'loading';
          return {
            state,
            error: state === 'token' ? refusal : state === 'shown' ? failure : null,
            orders:
              state === 'shown'
                ? // Null only when the first load failed: an empty board with
                  // its reason, as the screen shows it.
                  (board ?? []).map((o) => ({
                    orderId: o.id,
                    status: o.status,
                    busy: busy.has(o.id),
                    lines: o.lines.map((l) => ({
                      quantity: l.quantity,
                      name: l.name,
                      variantLabel: l.variantLabel,
                      extras: (l.extras ?? []).map((e) => e.name),
                    })),
                  }))
                : [],
          };
        },
      },
    ],
  });

  async function submitToken() {
    // An empty press is not an attempt: it would drop the stored token, clear
    // the previous reason below, and the headerless 401 that follows carries no
    // reason to replace it — leaving the operator with nothing on screen.
    if (!tokenInput.trim()) return;
    await setKitchenToken(tokenInput.trim());
    setTokenInput('');
    setOrders(null);
    // Clear the previous attempt's reason while this one is checked. A second
    // wrong token otherwise sets the identical string — no re-render, and the
    // live region announces nothing — so the operator sees no response at all.
    setAuthMessage(null);
    load();
  }

  // `accessibilityLiveRegion` (below) is Android-only — iOS has no equivalent
  // prop, so a `authMessage` change there renders silently. Ask VoiceOver to
  // announce it directly instead; RN docs both APIs as best-effort, so a
  // silenced or unsupported announcement fails the same way the prop already
  // does on an unsupported platform.
  useEffect(() => {
    if (authMessage && Platform.OS === 'ios') {
      AccessibilityInfo.announceForAccessibility(authMessage);
    }
  }, [authMessage]);

  // --- Token gate (deployed environments) ----------------------------------
  if (needsToken) {
    return (
      <ThemedView style={styles.center}>
        <View style={styles.tokenCard}>
          <ThemedText type="subtitle">Küchen-Zugang</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Bitte das Küchen-Kennwort eingeben, um die laufenden Bestellungen zu sehen.
          </ThemedText>
          {authMessage ? (
            <ThemedText
              type="small"
              style={{ color: theme.destructive }}
              accessibilityRole="alert"
              accessibilityLiveRegion="polite">
              {authMessage}
            </ThemedText>
          ) : null}
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
          <ThemedText type="small" style={{ color: theme.destructive }}>
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
                      busy={busyIds.has(order.id)}
                      onAdvance={advance}
                    />
                  ))
                )}
              </View>
            );
          })}
        </View>

        <View style={{ height: Spacing.xxxl }} />
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
        <ThemedText type="smallBold">
          #{order.id.slice(0, 8)} · {fulfilmentOf(order) === 'pickup' ? 'ABHOLUNG' : 'LIEFERUNG'}
        </ThemedText>
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
      {/* The diner's delivery note (bell, floor, back entrance). Stored and
          returned by the order API all along; nothing displayed it. A note of
          only spaces, from any client, is not a note. */}
      {order.customer?.notes?.trim() ? (
        <ThemedText type="small" themeColor="textSecondary">
          Hinweis: {order.customer.notes}
        </ThemedText>
      ) : null}
      {/* An order with no contact details rendered as BLANK space, which a cook
          reads as "pickup, nothing to deliver" — the surface inventing a fact.
          `ux-priorities`: honesty, never fabricate state.
          The wording states only what is known. An earlier draft said "nicht
          lieferbar", which asserts a second fact the payload does not carry
          either: an order with no contact block may be a walk-in. */}
      {!order.customer?.name && !order.customer?.phone && !order.customer?.address ? (
        <ThemedText type="small" style={{ color: theme.destructive }}>
          Keine Kontaktdaten hinterlegt
        </ThemedText>
      ) : null}

      <View style={styles.lines}>
        {/* Snapshotted lines carry the size and the extras, which is what a
            cook needs to bake the right one. Keyed by position: two lines may
            share an item and a size and differ only in their extras. The
            extras are bold — a pizza baked without the cheese the diner paid
            for is the failure this card exists to prevent. */}
        {order.lines.map((l, index) => (
          <View key={`${index}-${l.menuItemId}::${l.variantId}`} style={styles.lineRow}>
            <View style={styles.lineText}>
              <ThemedText type="small">
                {l.quantity}× {l.name}, {l.variantLabel}
              </ThemedText>
              {l.extras?.length ? (
                <ThemedText type="smallBold">
                  + {l.extras.map((e) => e.name).join(', ')}
                </ThemedText>
              ) : null}
            </View>
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
            {fulfilmentOf(order) === 'pickup' ? 'Bereit zur Abholung.' : 'Bereit zur Lieferung.'}
          </ThemedText>
        )}
        {/* The backend allows no change from ready, so a cancel here could
            only fail, with the backend's English refusal. */}
        {order.status !== 'ready' ? (
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
        ) : null}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  scroll: { padding: Spacing.lg, gap: Spacing.lg, width: '100%', maxWidth: 1200, alignSelf: 'center' },
  header: { gap: Spacing.xs },

  board: { gap: Spacing.lg },
  boardRow: { flexDirection: 'row', alignItems: 'flex-start' },
  boardColumn: { flexDirection: 'column' },
  lane: { gap: Spacing.sm },
  laneWide: { flex: 1 },
  laneHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs },
  dot: { width: 10, height: 10, borderRadius: Radius.pill },
  empty: { paddingVertical: Spacing.sm },

  card: {
    borderRadius: Radius.card,
    borderLeftWidth: 4,
    padding: Spacing.lg,
    gap: Spacing.xs,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lines: { marginTop: Spacing.xs, gap: Spacing.xs },
  lineRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  lineText: { flex: 1 },
  cardFooter: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: Spacing.xs },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm, alignItems: 'center' },

  tokenCard: { width: '100%', maxWidth: 360, gap: Spacing.sm },
  input: {
    borderWidth: 1,
    borderRadius: Radius.field,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    fontSize: 16,
  },
  primaryBtn: {
    padding: Spacing.lg,
    borderRadius: Radius.card,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  cancelBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.card,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
});

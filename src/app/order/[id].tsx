import { useUIComponent } from '@qontinui/ui-bridge-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BridgeButton } from '@/components/bridge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError, errorReason } from '@/lib/api';
import { formatEUR } from '@/lib/format';
import { useShop } from '@/hooks/use-shop';
import { fulfilmentOf, type Order } from '@/lib/types';

const STATUS_COPY: Record<Order['status'], { emoji: string; title: string; sub: string }> = {
  pending_payment: { emoji: '⏳', title: 'Warten auf Zahlung', sub: 'Schließe die Zahlung ab, um deine Bestellung zu bestätigen.' },
  paid: { emoji: '✅', title: 'Zahlung erhalten', sub: 'Deine Bestellung ist bestätigt und geht in die Küche.' },
  preparing: { emoji: '👨‍🍳', title: 'In Zubereitung', sub: 'Unser Pizzabäcker ist dran.' },
  ready: { emoji: '🛵', title: 'Unterwegs', sub: 'Deine Bestellung ist auf dem Weg!' },
  cancelled: { emoji: '❌', title: 'Storniert', sub: 'Diese Bestellung wurde storniert.' },
};

/** The copy that differs for an order the diner collects. */
const PICKUP_COPY: Partial<Record<Order['status'], { emoji: string; title: string; sub: string }>> = {
  ready: { emoji: '🛍️', title: 'Abholbereit', sub: 'Deine Bestellung liegt bei uns bereit.' },
};

/** How often an unpaid order is read again while the diner pays. */
const POLL_MS = 2000;
/** How often a paid order is read again while the kitchen works on it. */
const FOLLOW_MS = 15000;
/** The longest wait between reads after failed ones. */
const MAX_RETRY_MS = 30000;

/**
 * The delivery details as the server stored them, as this screen shows them.
 * An order read may carry any subset of the fields: the API does not yet
 * refuse an order without them (backend#9), and orders from before checkout
 * required them carry none. A value that is only whitespace counts as missing,
 * and a note that is only whitespace is not a note, as on the kitchen card.
 *
 * The phone number is left out only because the diner already knows it. It is
 * not protected: the order read has no authentication and returns it to anyone
 * holding the order link, as it does the name and address.
 */
function deliveryDetails(order: Order) {
  const customer = order.customer ?? {};
  return {
    name: customer.name?.trim() || null,
    address: customer.address?.trim() || null,
    note: customer.notes?.trim() || null,
  };
}

/** A refusal that asking again will not change. 408 and 429 are 4xx answers
 *  that do change, and a proxy in front of the API can send either. */
function isRefusal(e: unknown): boolean {
  return e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 408 && e.status !== 429;
}

/** The German reason for a failed order read. The order route answers 404 for
 *  an id it does not know, in English ("Order not found."). A 404 from
 *  anywhere else, such as a wrong API address, looks the same, so the copy
 *  says the order was not found rather than that it does not exist. */
function readFailure(e: unknown): string {
  if (e instanceof ApiError && e.status === 404) return 'Diese Bestellung wurde nicht gefunden.';
  return errorReason(e);
}

/** A first load that failed, as the error view shows it. */
interface LoadFailure {
  message: string;
  /** False for a refusal: a retry gets the same answer. */
  retryable: boolean;
}

// The route renders one OrderView per order id, so everything the view holds
// (the order, its errors, the retry count) starts empty for a new id instead
// of showing the previous order under the new link.
export default function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <OrderView key={id} id={id} />;
}

function OrderView({ id }: { id: string }) {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { shop } = useShop();
  const [order, setOrder] = useState<Order | null>(null);
  // Why the order could not be loaded at all. The screen then offers a way on.
  const [error, setError] = useState<LoadFailure | null>(null);
  // Why the last read failed while an order is on screen. The order stays,
  // marked as possibly out of date, and reading continues.
  const [refreshError, setRefreshError] = useState<string | null>(null);
  // Bumped by the retry button to start loading again.
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!id) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let shown = false;
    let failures = 0;
    // The pace the last successful read set.
    let cadence = POLL_MS;

    async function poll() {
      try {
        const next = await api.getOrder(id);
        if (!active) return;
        shown = true;
        failures = 0;
        setOrder(next);
        setRefreshError(null);
        // Keep reading until the order is on its way or cancelled, the last
        // two states: quickly while the diner pays, then at the kitchen's pace.
        cadence = next.status === 'pending_payment' ? POLL_MS : FOLLOW_MS;
        if (next.status !== 'ready' && next.status !== 'cancelled') {
          timer = setTimeout(poll, cadence);
        }
      } catch (e) {
        if (!active) return;
        if (!shown) {
          const refused = isRefusal(e);
          setError({
            message: e instanceof ApiError && e.status === 404
              ? `${readFailure(e)} Bitte prüfe den Link.`
              : readFailure(e),
            retryable: !refused,
          });
          return;
        }
        // A failed read, even a refusal, must not replace the order on screen
        // with an error screen and stop following it, so the order stays and
        // the next read backs off, doubling from the order's own pace (2 s
        // unpaid, 15 s once paid) up to every 30 s.
        failures += 1;
        setRefreshError(readFailure(e));
        timer = setTimeout(poll, Math.min(cadence * 2 ** (failures - 1), MAX_RETRY_MS));
      }
    }

    poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [id, attempt]);

  // The UI Bridge action below is registered once, at mount, so it reads what
  // the screen shows through a ref written after every commit.
  const shownRef = useRef({ order, error, refreshError });
  useEffect(() => {
    shownRef.current = { order, error, refreshError };
  });

  useUIComponent({
    id: 'order',
    name: 'Order',
    actions: [
      {
        id: 'getOrderStatus',
        label: 'Report what the order screen is currently showing',
        description:
          'No params. Returns { state: "loading" | "error" | "shown", error, refreshError, ' +
          'orderId, status, fulfilment, delivery: { name, address, note } }. `error` is the reason shown ' +
          'when the order could not be loaded. `refreshError` is set while the latest read ' +
          'failed and the order on screen may be out of date. `orderId`, `status` and ' +
          '`delivery` are null unless state is "shown". A null `delivery.address` is shown ' +
          'as "Keine Lieferadresse hinterlegt".',
        handler: async () => {
          const { order: current, error: failure, refreshError: stale } = shownRef.current;
          const shownOrder = failure ? null : current;
          return {
            state: failure ? 'error' : current ? 'shown' : 'loading',
            error: failure?.message ?? null,
            refreshError: shownOrder ? stale : null,
            orderId: shownOrder?.id ?? null,
            status: shownOrder?.status ?? null,
            fulfilment: shownOrder ? fulfilmentOf(shownOrder) : null,
            delivery: shownOrder ? deliveryDetails(shownOrder) : null,
          };
        },
      },
    ],
  });

  if (error) {
    return (
      <ThemedView style={styles.screen}>
        <View style={styles.message}>
          <ThemedText type="subtitle" style={styles.center}>
            Bestellung konnte nicht geladen werden
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
            {error.message}
          </ThemedText>
          {/* Without a way on the screen is a dead end: an order link opened in
              a new browser tab has no screen to go back to. The one red fill is
              the retry when there is one, otherwise the way back. */}
          {error.retryable ? (
            <BridgeButton
              uiId="order-retry"
              uiLabel="Erneut versuchen"
              style={({ pressed }) => [
                styles.btn,
                { backgroundColor: pressed ? theme.brandPressed : theme.brand },
              ]}
              onPress={() => {
                setError(null);
                setAttempt((n) => n + 1);
              }}>
              <ThemedText type="smallBold" themeColor="onBrand">
                Erneut versuchen
              </ThemedText>
            </BridgeButton>
          ) : null}
          <BridgeButton
            uiId="order-error-back-to-menu"
            uiLabel="Zurück zur Speisekarte"
            style={({ pressed }) => [
              styles.btn,
              error.retryable
                ? [
                    // A neutral outline: theme.ts keeps the brand outline for
                    // repeated controls.
                    styles.outlineBtn,
                    { borderColor: theme.backgroundSelected },
                    pressed ? { backgroundColor: theme.backgroundSelected } : null,
                  ]
                : { backgroundColor: pressed ? theme.brandPressed : theme.brand },
            ]}
            onPress={() => router.replace('/')}>
            <ThemedText
              type="smallBold"
              style={error.retryable ? undefined : { color: theme.onBrand }}>
              Zur Speisekarte
            </ThemedText>
          </BridgeButton>
        </View>
      </ThemedView>
    );
  }

  if (!order) {
    return (
      <ThemedView style={[styles.screen, styles.center]}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  const isPickup = fulfilmentOf(order) === 'pickup';
  const copy = (isPickup && PICKUP_COPY[order.status]) || STATUS_COPY[order.status];
  const { name, address, note } = deliveryDetails(order);

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
          {/* The status above is the last one read, so say when it may be
              out of date rather than present it as current. A polite live
              region, not an alert: it is background status, and on a flaky
              connection it comes and goes with every read. The region stays
              mounted so the text is announced when it appears (web and
              Android; iOS has no live regions), and collapsable={false} keeps
              Android from flattening the otherwise prop-less view away.
              Secondary text rather than the destructive colour, for the same
              reason: it is status, not a failure the diner must act on. */}
          <View aria-live="polite" collapsable={false}>
            {refreshError ? (
              <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
                Der Bestellstatus konnte nicht aktualisiert werden und ist möglicherweise nicht
                mehr aktuell. Grund: {refreshError} Es wird automatisch erneut versucht.
              </ThemedText>
            ) : null}
          </View>
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
          <View style={styles.summaryRow}>
            <ThemedText type="small" themeColor="textSecondary">
              {isPickup ? 'Abholung' : 'Lieferung'}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {formatEUR(order.deliveryFee)}
            </ThemedText>
          </View>
          <View style={[styles.summaryRow, styles.totalRow]}>
            <ThemedText type="smallBold">Gesamt</ThemedText>
            <ThemedText type="price">{formatEUR(order.total)}</ThemedText>
          </View>
        </ThemedView>

        {/* Lets the diner check the address and that the delivery note arrived.
            A missing address is said outright rather than left out, because a
            block without one reads as complete. */}
        <ThemedView type="backgroundElement" style={styles.summary}>
          <ThemedText type="small" themeColor="textSecondary">
            {isPickup ? 'Abholung' : 'Lieferdaten'}
          </ThemedText>
          {name ? <ThemedText type="small">{name}</ThemedText> : null}
          {isPickup ? (
            // A pickup has no delivery address to be missing; it has a shop.
            <ThemedText type="small">
              Abholung bei Portofino
              {shop ? `, ${shop.street}, ${shop.postalCode} ${shop.city}` : ''}
            </ThemedText>
          ) : address ? (
            <ThemedText type="small">{address}</ThemedText>
          ) : (
            <ThemedText type="small" style={{ color: theme.destructive }}>
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
          <ThemedText type="smallBold" themeColor="onBrand">
            Zur Speisekarte
          </ThemedText>
        </BridgeButton>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  container: { paddingHorizontal: Spacing.gutter, paddingTop: Spacing.lg, gap: Spacing.xl, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center' },
  center: { textAlign: 'center', alignItems: 'center', justifyContent: 'center' },
  message: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xl, gap: Spacing.md, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center' },
  hero: { alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.xxl },
  emoji: { fontSize: 64, lineHeight: 72 },
  summary: { padding: Spacing.lg, borderRadius: Radius.card, gap: Spacing.xs },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  totalRow: { marginTop: Spacing.xs },
  btn: { padding: Spacing.lg, borderRadius: Radius.card, alignItems: 'center', minHeight: 44 },
  outlineBtn: { borderWidth: 1.5, backgroundColor: 'transparent' },
});

import { useUIComponent, useUIElement } from '@qontinui/ui-bridge-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type PressableProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BridgeButton, BridgeInput } from '@/components/bridge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { closedReason, useShop } from '@/hooks/use-shop';
import { useTheme } from '@/hooks/use-theme';
import { api, ApiError, errorReason, type PaymentProviders } from '@/lib/api';
import { deliveryFeeFor } from '@/lib/fees';
import { formatEUR } from '@/lib/format';
import { forgetSavedDetails, loadSavedDetails, saveDetails } from '@/lib/saved-details';
import type { Fulfilment, PaymentProvider, ShopInfo } from '@/lib/types';
import { useCart, type CartLine } from '@/state/cart';

/**
 * Digits a phone number must contain. MIRRORS `MIN_PHONE_DIGITS` in
 * `backend/src/routes/orders.ts`, which is the enforcement — this copy only
 * keeps a diner from pressing pay into a rejection. If the two disagree the
 * backend wins and the diner sees its German error instead of a disabled button.
 */
const MIN_PHONE_DIGITS = 6;

/** Field length limits. MIRROR the backend's `requiredText` limits and its
 *  cap on the optional `notes`. */
const MAX_LENGTH = { name: 200, phone: 50, address: 500, notes: 1000 } as const;

/** Rendered as nothing and kept by trim(). MIRRORS the backend's INVISIBLE
 *  exactly, including the Hangul fillers (letters by category). */
const INVISIBLE = /[\u00AD\u115F\u1160\u200B-\u200F\u2060-\u2064\u3164\uFFA0]/g;

const clean = (value: string) => value.replace(INVISIBLE, '').trim();

/**
 * Opens an empty browser window for the hosted checkout, on web. It has to
 * open inside the diner's tap: Safari blocks a window opened after the network
 * calls that follow a tap, and expo-web-browser's web `openBrowserAsync` calls
 * `window.open` and reports success whether or not it was blocked. So pay()
 * opens this window before its first request and points it at the checkout
 * once the server has made one. Null when the browser blocks even this.
 */
function openCheckoutWindow(): Window | null {
  const opened = window.open('', '_blank');
  if (!opened) return null;
  try {
    // The checkout page has no use for a handle on this window.
    opened.opener = null;
  } catch {
    // The browser has already severed it.
  }
  try {
    // A blank tab reads as broken, and a diner who closes it before the
    // checkout arrives has nowhere to pay.
    opened.document.documentElement.lang = 'de';
    opened.document.title = 'Bezahlung';
    opened.document.body.textContent = 'Bezahlung wird vorbereitet …';
  } catch {
    // Nothing to write to; the checkout replaces the page anyway.
  }
  return opened;
}

/** What a UI Bridge pay action reports: the order it placed and where to pay. */
interface CheckoutStarted {
  orderId: string;
  url: string;
}

/** What pay() resolves to: the checkout it started, or why the checkout did
 *  not start. The reason says whether an unpaid order may exist. */
type PayResult = ({ ok: true } & CheckoutStarted) | { ok: false; reason: string };

const refuse = (reason: string): PayResult => ({ ok: false, reason });

/** An absolute http(s) URL with a host and no whitespace: something a browser
 *  can be sent to. */
const CHECKOUT_URL = /^https?:\/\/[^\s/?#@]+(?:[/?#]\S*)?$/i;

/**
 * A pay button. A tap runs `onTap`; a UI Bridge `press` runs `onBridgePress`
 * instead. On web the two must differ: a tap opens the checkout window inside
 * the tap, while an automated press carries no tap to open one with and must
 * not leave the tab the runner is driving. BridgeButton wires one handler to
 * both, so this registers with useUIElement directly, as bridge.tsx allows.
 */
function PayButton({
  uiId,
  uiLabel,
  disabled,
  style,
  onTap,
  onBridgePress,
  children,
}: {
  uiId: string;
  uiLabel: string;
  disabled: boolean;
  style: PressableProps['style'];
  onTap: () => void;
  onBridgePress: () => void;
  children: React.ReactNode;
}) {
  const { ref, onLayout, bridgeProps } = useUIElement({
    id: uiId,
    type: 'button',
    label: uiLabel,
    handlers: {
      onPress: () => {
        // As in BridgeButton: a press on a disabled button fails rather than
        // passing as a success that did nothing. `disabled` is as of the last
        // commit.
        if (disabled) throw new Error(`${uiLabel} ist gerade nicht verfügbar.`);
        onBridgePress();
      },
    },
  });
  return (
    <Pressable
      ref={ref}
      onLayout={onLayout}
      {...bridgeProps}
      role="button"
      onPress={onTap}
      disabled={disabled}
      style={style}>
      {children}
    </Pressable>
  );
}

type Fields = { fulfilment: Fulfilment; name: string; phone: string; address: string; notes: string };

/**
 * Why this order cannot be placed yet, or null. The contact fields use the
 * backend's cleaning, digit floor and length limits. The note is optional, so
 * only its length is checked, and it is checked here because the backend's
 * `notes` rule answers an over-long note in English. `maxLength` stops typing
 * past the limit but does not stop a UI Bridge `setValue`.
 *
 * One backend rule is deliberately NOT mirrored: a name or address must contain
 * a letter or digit (`READABLE`, a Unicode property escape). The checkout does
 * not depend on Hermes matching one: hermesc 250829098.0.10 compiles
 * `/[\p{L}\p{N}]/u`, but nobody has run the match on a device. A name of only
 * punctuation, such as ".", passes here and the server refuses it. The diner
 * sees that German refusal in the error line above the buttons, not a disabled
 * button.
 */
function orderGap(
  { fulfilment, name, phone, address, notes }: Fields,
  lines: readonly CartLine[],
  shop: ShopInfo | null,
): string | null {
  // What the order route would refuse whatever the diner types: the shop is
  // closed for this kind of order, or the cart holds a pickup-only offer. Shown
  // first, because no edit to the fields fixes either. With no status (a
  // failed read), nothing is blocked here: the server still enforces the hours.
  const closed = shop ? closedReason(shop, fulfilment) : null;
  if (closed) return closed;
  if (fulfilment === 'delivery') {
    const pickupOnly = lines.find((l) => l.item.pickupOnly);
    if (pickupOnly) {
      return `„${pickupOnly.item.name}“ gibt es nur für Selbstabholer. Bitte Abholung wählen.`;
    }
  }
  const gaps: string[] = [];
  if (!clean(name)) gaps.push('Name');
  if (!clean(phone)) gaps.push('Telefonnummer');
  else if ((phone.match(/\d/g) ?? []).length < MIN_PHONE_DIGITS) gaps.push('gültige Telefonnummer');
  if (fulfilment === 'delivery' && !clean(address)) gaps.push('Lieferadresse');
  if (gaps.length > 0) return `Bitte noch angeben: ${gaps.join(', ')}.`;
  if (clean(name).length > MAX_LENGTH.name) return 'Der Name ist zu lang.';
  if (clean(phone).length > MAX_LENGTH.phone) return 'Die Telefonnummer ist zu lang.';
  if (fulfilment === 'delivery' && clean(address).length > MAX_LENGTH.address) {
    return 'Die Lieferadresse ist zu lang.';
  }
  if (notes.trim().length > MAX_LENGTH.notes) return 'Der Hinweis ist zu lang.';
  return null;
}

export default function CheckoutScreen() {
  const theme = useTheme();
  const router = useRouter();
  const cart = useCart();

  // `fields` drives rendering. `typed` holds the same values, but is written in
  // the onChangeText call itself, without waiting for a render. pay() reads
  // `typed`: the UI Bridge reaches pay() through a ref that is one commit
  // behind (see payRef below), and state read from that pay() would be the
  // previous render's.
  const [fields, setFields] = useState<Fields>({
    fulfilment: cart.fulfilment,
    name: '',
    phone: '',
    address: '',
    notes: '',
  });
  const typed = useRef(fields);
  const { shop, gating, unavailable: shopUnavailable } = useShop();
  // "Angaben merken" starts UNTICKED: storing a diner's name, phone and address
  // on the device for convenience needs their consent (TTDSG §25 for the web
  // build's localStorage), and a pre-ticked box is not consent. It starts
  // ticked only when details are already saved — the diner opted in before.
  const [remember, setRemember] = useState(false);
  const rememberRef = useRef(remember);
  const [hasSaved, setHasSaved] = useState(false);
  const [providers, setProviders] = useState<PaymentProviders | null>(null);
  const [busy, setBusy] = useState<PaymentProvider | null>(null);
  // `clearsOnEdit` marks an error that is safe to hide once the diner edits a
  // field: a 4xx answer to createOrder, which proves no order was written.
  // Some of those are fixed by the edit, such as the letter-or-digit rule this
  // screen does not mirror. Others, such as an item that has become
  // unavailable, come back on the next press. Every other failure stays until
  // the next attempt, because an order may exist: one created before payment
  // failed to start, or one whose outcome is unknown (a 5xx, or a response lost
  // after the server committed). Its message says so.
  const [error, setError] = useState<{ message: string; clearsOnEdit: boolean } | null>(null);
  // Called only from onChangeText, never during render. The Bridge holds the
  // handler from the last commit, which is harmless because update() touches
  // only a ref and stable state setters.
  function update(field: Exclude<keyof Fields, 'fulfilment'>, value: string) {
    typed.current = { ...typed.current, [field]: value };
    setFields(typed.current);
    setError((current) => (current?.clearsOnEdit ? null : current));
  }

  // Lieferung or Abholung. Written to `typed` synchronously like a field, and
  // mirrored into the cart so the cart screen shows the same fee.
  function chooseFulfilment(next: Fulfilment) {
    typed.current = { ...typed.current, fulfilment: next };
    setFields(typed.current);
    cart.setFulfilment(next);
    setError((current) => (current?.clearsOnEdit ? null : current));
  }

  function toggleRemember() {
    rememberRef.current = !rememberRef.current;
    setRemember(rememberRef.current);
  }

  // Forgetting also unticks "merken": otherwise the next payment, or one
  // already running, writes the details straight back.
  async function forget() {
    rememberRef.current = false;
    setRemember(false);
    await forgetSavedDetails();
    setHasSaved(false);
  }

  useEffect(() => {
    api.getPaymentProviders().then(setProviders).catch(() => setProviders(null));
  }, []);

  // Prefill from the last order on this device, but never over something the
  // diner has already started typing.
  useEffect(() => {
    let active = true;
    loadSavedDetails().then((saved) => {
      if (!active || !saved) return;
      setHasSaved(true);
      rememberRef.current = true;
      setRemember(true);
      const current = typed.current;
      if (current.name || current.phone || current.address || current.notes) return;
      // The fulfilment on screen stays: it came from the cart, which already
      // started from the saved choice and carries anything the diner picked
      // since. Replacing it would undo a pickup chosen on an earlier visit.
      typed.current = { ...current, name: saved.name, phone: saved.phone, address: saved.address };
      setFields(typed.current);
    });
    return () => {
      active = false;
    };
  }, []);

  // A synchronous guard against a double submit. `busy` is state, so two pay()
  // calls arriving before the render that follows setBusy() would both read it
  // as null and both create an order — easy to trigger through the UI Bridge.
  const inFlight = useRef(false);

  /**
   * Places the order and starts its checkout. Resolves to the order and its
   * checkout URL, or to the reason the checkout did not start, which says
   * whether an unpaid order may exist. A tap has been sent to the checkout by
   * then; a web UI Bridge call has not (see below). The UI Bridge actions turn
   * a reason into a FAILED action: a refusal that merely returned would be
   * reported to the Bridge as success with no order behind it.
   */
  async function pay(provider: PaymentProvider, viaBridge = false): Promise<PayResult> {
    if (cart.count === 0) return refuse('Der Warenkorb ist leer.');
    if (busy || inFlight.current) return refuse('Eine Bezahlung läuft bereits.');
    // The same rule as the disabled buttons below. The UI Bridge actions call
    // pay() without going through a button, so the rule has to live here too.
    // Not copied into `error`: the footer already states the gap and follows
    // the fields, whereas `error` would stay red after they were filled in.
    const { fulfilment, name, phone, address, notes } = typed.current;
    const gap = orderGap(typed.current, cart.lines, gating);
    if (gap) return refuse(gap);
    inFlight.current = true;
    setError(null);
    setBusy(provider);
    // On web a tap opens the checkout window first thing, while this still
    // runs inside the tap, and points it at the checkout once the server has
    // made one. When the order is refused, that blank tab opens and closes
    // again: the price of getting past Safari's popup blocker. A UI Bridge call
    // (`viaBridge`: the pay actions, or a Bridge press on a pay button) carries
    // no tap. It opens nothing and must not leave the tab the runner drives.
    const tapped = Platform.OS === 'web' && !viaBridge;
    let checkoutWindow: Window | null = null;
    let placed = false;
    // True only while the native payment browser opens. A failure there is not
    // a failed request: the server has answered by then.
    let opening = false;
    try {
      // Inside `try`, so a throwing window.open still releases the in-flight
      // guard in `finally`.
      if (tapped) checkoutWindow = openCheckoutWindow();
      const order = await api.createOrder(
        // The variant carries the price, so every line names one. The API
        // rejects a line without it rather than pricing a guess.
        cart.lines.map((l) => ({
          menuItemId: l.item.id,
          variantId: l.variant.id,
          quantity: l.quantity,
        })),
        fulfilment,
        {
          name: clean(name),
          phone: clean(phone),
          // A pickup sends no address, and the server would not store one.
          ...(fulfilment === 'delivery' ? { address: clean(address) } : {}),
          // Trimmed but not cleaned. INVISIBLE also covers U+200C/U+200D,
          // which Persian, Indic scripts and joined emoji need mid-text, and
          // the backend keeps a note as sent. A note that is only whitespace
          // or invisible characters is left out, because the kitchen card
          // would show it as an empty "Hinweis:".
          notes: clean(notes) ? notes.trim() : undefined,
        },
      );
      placed = true;
      // The order exists, so these details worked: keep them for next time, or
      // forget any earlier copy when the diner unticked "Angaben merken".
      // Best-effort either way; neither may hold up the payment.
      if (rememberRef.current) {
        void saveDetails({ fulfilment, name: clean(name), phone: clean(phone), address: clean(address) });
      } else {
        void forgetSavedDetails();
      }
      const { url } = await api.startCheckout(order.id, provider);
      // Checked before anything leaves this screen, so a bad answer neither
      // empties the cart nor sends a window somewhere useless.
      if (typeof url !== 'string' || !CHECKOUT_URL.test(url)) {
        throw new Error(`startCheckout answered without a usable URL: ${String(url)}`);
      }
      // A web UI Bridge call opens nothing, since paying in this tab would
      // unload the page the runner is driving. An action returns the checkout
      // URL for the runner to open instead.
      if (tapped) {
        if (checkoutWindow && !checkoutWindow.closed) {
          checkoutWindow.location.href = url;
        } else {
          // No window (popups are off altogether), or the diner closed the
          // blank one: pay in this tab instead. The cart is emptied, and both
          // the app and the history entry move to the order screen, so Back
          // from the checkout lands on the order, not on a full checkout that
          // could place the order a second time. The explicit replaceState is
          // what keeps the entry right: expo-router writes its own entry after
          // React commits, and a replaceState does not abort a navigation in
          // progress. The tick before navigating only gives that write room.
          cart.clear();
          router.replace(`/order/${order.id}`);
          window.history.replaceState(window.history.state, '', `/order/${order.id}`);
          setTimeout(() => window.location.assign(url), 0);
          return { ok: true, orderId: order.id, url };
        }
      } else if (Platform.OS !== 'web') {
        // Hosted checkout (Stripe Checkout / PayPal) in the platform browser.
        // On iOS this resolves when the diner closes it, on Android as soon as
        // it opens. Either way the order screen then polls for "paid".
        opening = true;
        await WebBrowser.openBrowserAsync(url);
        opening = false;
      }
      cart.clear();
      router.replace(`/order/${order.id}`);
      return { ok: true, orderId: order.id, url };
    } catch (e) {
      // An empty window left open would read as the checkout.
      checkoutWindow?.close();
      // errorReason would call a browser that failed to open "no usable
      // answer", which blames the server, so that failure gets its own reason.
      if (opening && __DEV__) console.info('[checkout] payment browser failed to open:', e);
      const reason = opening
        ? 'Der Browser für die Bezahlung ließ sich nicht öffnen.'
        : errorReason(e);
      // Only a 4xx answer to createOrder proves that no order was written.
      const refused = !placed && e instanceof ApiError && e.status >= 400 && e.status < 500;
      // An unpaid order never reaches the kitchen, so both messages say so.
      // "angelegt" alone reads as "placed", and a diner who stops reading
      // there waits for food nobody is cooking. It also makes a retry safe: an
      // earlier unpaid order is never prepared.
      const message = placed
        ? `Die Bestellung ist angelegt, aber noch nicht bezahlt, und wird erst nach der Bezahlung zubereitet. Die Bezahlung konnte nicht gestartet werden: ${reason}`
        : refused
          ? reason
          : `Unklar, ob die Bestellung angelegt wurde. Grund: ${reason} Eine unbezahlte Bestellung wird nicht zubereitet; du kannst es erneut versuchen.`;
      setError({ message, clearsOnEdit: refused });
      return refuse(message);
    } finally {
      inFlight.current = false;
      setBusy(null);
    }
  }

  // useUIComponent registers its action handlers ONCE, at mount, and never
  // re-registers them. A handler that closed over `pay` directly would keep the
  // first render's `pay` forever (empty name/phone/address, the cart and `busy`
  // as they were at mount), so every Bridge payment would be refused however
  // the fields were filled. The handlers read `pay` through a ref instead,
  // written after every commit.
  //
  // The ref is still one commit behind. Take a Bridge WORKFLOW that sets the
  // fields and calls a pay action in the same run, with nothing in between:
  // the render those setters scheduled has not happened, so the ref still
  // holds the pay() from before the fields were filled. That pay() reads the
  // fields from `typed`, so it sees what was typed and not what was last
  // rendered; an ungated field like the note is not silently dropped. The cart
  // can still be stale, and changing it means leaving this screen. A refusal
  // THROWS below rather than resolving, so a step that cannot pay fails
  // visibly with the German reason.
  //
  // A Bridge `press` on the pay-stripe / pay-paypal BUTTONS runs pay() as a
  // UI Bridge call (PayButton's onBridgePress), so on web it opens nothing and
  // does not leave the tab. The press still reports success at once, before
  // any order exists, because ui-bridge-native does not wait for a press
  // handler, so a press that pay() then refuses (a payment already running)
  // leaves no trace at all. In the same run as the field setters it fails,
  // because the button's `disabled` is also one commit old. A workflow should
  // call the actions, which wait for pay() and return its result.
  const payRef = useRef(pay);
  useEffect(() => {
    payRef.current = pay;
  });

  const payThroughBridge = async (provider: PaymentProvider): Promise<CheckoutStarted> => {
    const result = await payRef.current(provider, true);
    if (!result.ok) throw new Error(result.reason);
    return { orderId: result.orderId, url: result.url };
  };

  const payDescription =
    'No params. Places the order from the cart, the chosen Lieferung/Abholung ' +
    '(buttons checkout-fulfilment-delivery / checkout-fulfilment-pickup) and the filled-in fields, or fails with ' +
    'the German reason it cannot. Returns { orderId, url }. On web the checkout is not ' +
    'opened: the screen moves to the order and the runner opens `url` itself. On native ' +
    'the platform browser opens, as for a tap; on iOS the action then resolves only ' +
    'when that browser is closed. A failure can leave an unpaid order (the reason says ' +
    'so), and calling again places a new one.';

  useUIComponent({
    id: 'checkout',
    name: 'Checkout',
    actions: [
      {
        id: 'payWithStripe',
        label: 'Place the order and start a Stripe payment',
        description: payDescription,
        handler: () => payThroughBridge('stripe'),
      },
      {
        id: 'payWithPaypal',
        label: 'Place the order and start a PayPal payment',
        description: payDescription,
        handler: () => payThroughBridge('paypal'),
      },
    ],
  });

  const fee = cart.count > 0 ? deliveryFeeFor(fields.fulfilment) : 0;
  const total = cart.subtotal + fee;
  const contactGap = orderGap(fields, cart.lines, gating);
  const isPickup = fields.fulfilment === 'pickup';

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <ThemedText type="eyebrow" style={styles.eyebrow}>Fast geschafft</ThemedText>
        <ThemedText type="subtitle">Deine Angaben</ThemedText>

        {/* Lieferung / Abholung, as portofino-essen.de offers. */}
        <View role="group" aria-label="Lieferung oder Abholung" style={styles.modes}>
          <ModeOption
            uiId="checkout-fulfilment-delivery"
            title="Lieferung"
            detail={
              shop?.status.delivery.available
                ? `${formatEUR(deliveryFeeFor('delivery'))} · bis ${shop.status.delivery.until} Uhr`
                : formatEUR(deliveryFeeFor('delivery'))
            }
            selected={!isPickup}
            onPress={() => chooseFulfilment('delivery')}
          />
          <ModeOption
            uiId="checkout-fulfilment-pickup"
            title="Abholung"
            detail={
              shop?.status.pickup.available
                ? `kostenlos · bis ${shop.status.pickup.until} Uhr`
                : 'kostenlos'
            }
            selected={isPickup}
            onPress={() => chooseFulfilment('pickup')}
          />
        </View>
        {isPickup ? (
          <ThemedView type="backgroundElement" style={styles.pickupPanel}>
            <ThemedText type="smallBold">Abholung bei Portofino</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {shop ? `${shop.street}, ${shop.postalCode} ${shop.city}` : 'im Restaurant'}
            </ThemedText>
          </ThemedView>
        ) : null}
        {shopUnavailable ? (
          <ThemedText type="small" themeColor="textSecondary">
            Ob wir gerade Bestellungen annehmen, konnte nicht geladen werden. Du kannst
            trotzdem bestellen; wir prüfen es beim Absenden.
          </ThemedText>
        ) : null}

        <Field label="Name">
          <BridgeInput
            uiId="checkout-name"
            maxLength={MAX_LENGTH.name}
            uiLabel="Name"
            value={fields.name}
            onChangeText={(value) => update('name', value)}
            placeholder="Mario Rossi"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
          />
        </Field>
        <Field label="Telefon">
          <BridgeInput
            uiId="checkout-phone"
            maxLength={MAX_LENGTH.phone}
            uiLabel="Telefon"
            value={fields.phone}
            onChangeText={(value) => update('phone', value)}
            keyboardType="phone-pad"
            placeholder="+49 …"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
          />
        </Field>
        {isPickup ? null : (
        <Field label="Adresse">
          <BridgeInput
            uiId="checkout-address"
            maxLength={MAX_LENGTH.address}
            uiLabel="Adresse"
            value={fields.address}
            onChangeText={(value) => update('address', value)}
            placeholder="Straße, Hausnummer, Ort"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
          />
        </Field>
        )}
        {/* Optional, and never part of the pay gate. The order API has always
            stored `customer.notes`; checkout just offered no way to send one. */}
        <Field label={isPickup ? 'Hinweis zur Bestellung (optional)' : 'Hinweis für die Lieferung (optional)'}>
          <BridgeInput
            uiId="checkout-notes"
            maxLength={MAX_LENGTH.notes}
            uiLabel={isPickup ? 'Hinweis zur Bestellung' : 'Hinweis für die Lieferung'}
            value={fields.notes}
            onChangeText={(value) => update('notes', value)}
            multiline
            placeholder={isPickup ? 'z. B. wann du abholst' : 'z. B. Klingel, Etage, Hintereingang'}
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, styles.notesInput, { color: theme.text, borderColor: theme.backgroundSelected }]}
          />
        </Field>

        {/* Saved on THIS device only, and only while ticked. */}
        <View style={styles.remember}>
          <BridgeButton
            uiId="checkout-remember"
            uiLabel="Angaben auf diesem Gerät für die nächste Bestellung merken"
            // A toggle button rather than role="checkbox": react-native-web
            // activates only role="button" with the Space key.
            role="button"
            aria-pressed={remember}
            style={styles.rememberRow}
            onPress={toggleRemember}>
            <View
              style={[
                styles.checkbox,
                { borderColor: remember ? theme.brandText : theme.textSecondary },
                remember && { backgroundColor: theme.brand },
              ]}>
              {remember ? (
                <ThemedText type="smallBold" themeColor="onBrand" style={styles.checkmark}>
                  ✓
                </ThemedText>
              ) : null}
            </View>
            <View style={styles.rememberText}>
              <ThemedText type="small">Angaben für die nächste Bestellung merken</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Nur auf diesem Gerät gespeichert, nicht bei uns.
              </ThemedText>
            </View>
          </BridgeButton>
          {hasSaved ? (
            <BridgeButton
              uiId="checkout-forget"
              uiLabel="Gespeicherte Angaben löschen"
              style={styles.forget}
              disabled={!!busy}
            onPress={() => void forget()}>
              <ThemedText type="small" themeColor="brandText" style={styles.forgetText}>
                Gespeicherte Angaben löschen
              </ThemedText>
            </BridgeButton>
          ) : null}
        </View>

        {providers && (!providers.stripe || !providers.paypal) ? (
          <ThemedText type="small" themeColor="textSecondary">
            Hinweis: {[!providers.stripe ? 'Stripe' : null, !providers.paypal ? 'PayPal' : null]
              .filter(Boolean)
              .join(' und ')}{' '}
            {!providers.stripe && !providers.paypal ? 'laufen' : 'läuft'} im Testmodus (keine
            API-Schlüssel hinterlegt) — die Bestellung wird trotzdem abgeschlossen.
          </ThemedText>
        ) : null}

        {error ? (
          <ThemedText type="small" style={{ color: theme.destructive }}>
            {error.message}
          </ThemedText>
        ) : null}

        <BridgeButton
          uiId="checkout-impressum"
          uiLabel="Impressum"
          role="link"
          style={styles.forget}
          onPress={() => router.push('/impressum')}>
          <ThemedText type="small" themeColor="brandText" style={styles.forgetText}>
            Impressum
          </ThemedText>
        </BridgeButton>
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.footer}>
        {/* Say WHY the buttons are disabled. A control that silently refuses
            reads as broken, and these keep their vendor colours, so without
            this they would look pressable. */}
        {cart.count > 0 && contactGap ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.contactGap}>
            {contactGap}
          </ThemedText>
        ) : null}
        <View style={styles.totalRow}>
          <ThemedText type="smallBold">Gesamt</ThemedText>
          <ThemedText type="price">{formatEUR(total)}</ThemedText>
        </View>
        <PayButton
          uiId="pay-stripe"
          uiLabel="Mit Karte bezahlen (Stripe)"
          disabled={!!busy || cart.count === 0 || contactGap !== null}
          style={[styles.payBtn, { backgroundColor: '#635bff', opacity: contactGap || (busy && busy !== 'stripe') ? 0.5 : 1 }]}
          onTap={() => pay('stripe')}
          onBridgePress={() => void payRef.current('stripe', true)}>
          {busy === 'stripe' ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <ThemedText type="smallBold" style={{ color: '#ffffff' }}>
              Mit Karte bezahlen (Stripe)
            </ThemedText>
          )}
        </PayButton>
        <PayButton
          uiId="pay-paypal"
          uiLabel="Mit PayPal bezahlen"
          disabled={!!busy || cart.count === 0 || contactGap !== null}
          style={[styles.payBtn, { backgroundColor: '#ffc439', opacity: contactGap || (busy && busy !== 'paypal') ? 0.5 : 1 }]}
          onTap={() => pay('paypal')}
          onBridgePress={() => void payRef.current('paypal', true)}>
          {busy === 'paypal' ? (
            <ActivityIndicator color="#003087" />
          ) : (
            <ThemedText type="smallBold" style={{ color: '#003087' }}>
              Mit PayPal bezahlen
            </ThemedText>
          )}
        </PayButton>
      </SafeAreaView>
    </ThemedView>
  );
}

/** One of the two Lieferung / Abholung choices. */
function ModeOption({
  uiId,
  title,
  detail,
  selected,
  onPress,
}: {
  uiId: string;
  title: string;
  detail: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <BridgeButton
      uiId={uiId}
      // The label carries the fee and hours: the Bridge's label is also the
      // accessibility label, and they are what the choice turns on.
      uiLabel={`${title}, ${detail}`}
      // Toggle buttons rather than radios: react-native-web activates only
      // role="button" with the Space key.
      role="button"
      aria-pressed={selected}
      onPress={onPress}
      style={({ pressed }) => [
        styles.mode,
        {
          borderColor: selected ? theme.brandText : theme.backgroundSelected,
          backgroundColor: selected || pressed ? theme.backgroundElement : theme.background,
        },
      ]}>
      <ThemedText type="heading">{title}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {detail}
      </ThemedText>
    </BridgeButton>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <ThemedText type="smallBold">
        {label}
      </ThemedText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.gutter, paddingVertical: Spacing.xl, gap: Spacing.lg, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center' },
  field: { gap: Spacing.xs },
  input: { borderWidth: 1, borderRadius: Radius.field, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, fontSize: 16 },
  // Room for about three lines, so the optional note reads as a text area
  // rather than one more single-line field, with the text starting at the top
  // on Android.
  notesInput: { minHeight: 88, verticalAlign: 'top' },
  footer: { paddingHorizontal: Spacing.gutter, paddingVertical: Spacing.lg, gap: Spacing.sm, width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  contactGap: { textAlign: 'center' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.xs },
  payBtn: { padding: Spacing.lg, borderRadius: Radius.card, alignItems: 'center', minHeight: 52, justifyContent: 'center' },
  eyebrow: { marginBottom: -Spacing.sm },
  modes: { flexDirection: 'row', gap: Spacing.md },
  // A 2px border whether selected or not, so choosing does not shift the row.
  mode: { flex: 1, borderWidth: 2, borderRadius: Radius.card, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, minHeight: 64, justifyContent: 'center' },
  pickupPanel: { borderRadius: Radius.card, padding: Spacing.lg, gap: Spacing.xs },
  remember: { gap: Spacing.sm },
  rememberRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, minHeight: 44 },
  checkbox: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  checkmark: { fontSize: 14, lineHeight: 18 },
  rememberText: { flex: 1 },
  forget: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  forgetText: { textDecorationLine: 'underline' },
});

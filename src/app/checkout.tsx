import { useUIComponent } from '@qontinui/ui-bridge-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BridgeButton, BridgeInput } from '@/components/bridge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { api, type PaymentProviders } from '@/lib/api';
import { formatEUR } from '@/lib/format';
import type { PaymentProvider } from '@/lib/types';
import { useCart } from '@/state/cart';

const DELIVERY_FEE = 299;

/**
 * Digits a phone number must contain. MIRRORS `MIN_PHONE_DIGITS` in
 * `backend/src/routes/orders.ts`, which is the enforcement — this copy only
 * keeps a diner from pressing pay into a rejection. If the two disagree the
 * backend wins and the diner sees its German error instead of a disabled button.
 */
const MIN_PHONE_DIGITS = 6;

/** Field length limits. MIRROR the backend's `requiredText` limits. */
const MAX_LENGTH = { name: 200, phone: 50, address: 500 } as const;

/** Rendered as nothing and kept by trim(). MIRRORS the backend's INVISIBLE
 *  exactly, including the Hangul fillers (letters by category). */
const INVISIBLE = /[\u00AD\u115F\u1160\u200B-\u200F\u2060-\u2064\u3164\uFFA0]/g;

const clean = (value: string) => value.replace(INVISIBLE, '').trim();

/**
 * What is still missing before this order can be delivered, or null. The same
 * cleaning, digit floor and length limits as the backend, so a diner is never
 * shown an enabled button that the server then refuses.
 */
function missingContact(name: string, phone: string, address: string): string | null {
  const gaps: string[] = [];
  if (!clean(name)) gaps.push('Name');
  if (!clean(phone)) gaps.push('Telefonnummer');
  else if ((phone.match(/\d/g) ?? []).length < MIN_PHONE_DIGITS) gaps.push('gültige Telefonnummer');
  if (!clean(address)) gaps.push('Lieferadresse');
  if (gaps.length > 0) return `Bitte noch angeben: ${gaps.join(', ')}.`;
  if (clean(name).length > MAX_LENGTH.name) return 'Der Name ist zu lang.';
  if (clean(phone).length > MAX_LENGTH.phone) return 'Die Telefonnummer ist zu lang.';
  if (clean(address).length > MAX_LENGTH.address) return 'Die Lieferadresse ist zu lang.';
  return null;
}

export default function CheckoutScreen() {
  const theme = useTheme();
  const router = useRouter();
  const cart = useCart();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [providers, setProviders] = useState<PaymentProviders | null>(null);
  const [busy, setBusy] = useState<PaymentProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getPaymentProviders().then(setProviders).catch(() => setProviders(null));
  }, []);

  // A synchronous guard against a double submit. `busy` is state, so two pay()
  // calls arriving before the render that follows setBusy() would both read it
  // as null and both create an order — easy to trigger through the UI Bridge.
  const inFlight = useRef(false);

  /**
   * Places the order. Resolves to null once the diner has been sent to the
   * hosted checkout, or to the reason nothing was placed. The UI Bridge actions
   * turn that reason into a FAILED action: a refusal that merely returned would
   * be reported to the Bridge as success with no order behind it.
   */
  async function pay(provider: PaymentProvider): Promise<string | null> {
    if (cart.count === 0) return 'Der Warenkorb ist leer.';
    if (busy || inFlight.current) return 'Eine Bezahlung läuft bereits.';
    // The same rule as the disabled buttons below. The UI Bridge actions call
    // pay() without going through a button, so the rule has to live here too.
    const gap = missingContact(name, phone, address);
    if (gap) {
      setError(gap);
      return gap;
    }
    inFlight.current = true;
    setError(null);
    setBusy(provider);
    try {
      const order = await api.createOrder(
        // The variant carries the price, so every line names one. The API
        // rejects a line without it rather than pricing a guess.
        cart.lines.map((l) => ({
          menuItemId: l.item.id,
          variantId: l.variant.id,
          quantity: l.quantity,
        })),
        { name: clean(name), phone: clean(phone), address: clean(address) },
      );
      const { url } = await api.startCheckout(order.id, provider);
      // Hosted checkout (Stripe Checkout / PayPal). Opens the platform browser;
      // resolves when the user returns. The order screen then polls for "paid".
      await WebBrowser.openBrowserAsync(url);
      cart.clear();
      router.replace(`/order/${order.id}`);
      return null;
    } catch (e) {
      const message = (e as Error).message;
      setError(message);
      return message;
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
  // What the ref does NOT cover: a Bridge WORKFLOW that sets the fields and
  // then calls a pay action in the same run, with no yield between the steps.
  // The setters schedule a render that has not happened yet, so the ref still
  // holds the pre-fill `pay`, which refuses. That is why a refusal THROWS below
  // rather than resolving: the step fails visibly with the German reason, and a
  // workflow that needs it adds a wait before the action.
  const payRef = useRef(pay);
  useEffect(() => {
    payRef.current = pay;
  });

  const payThroughBridge = async (provider: PaymentProvider) => {
    const refusal = await payRef.current(provider);
    if (refusal) throw new Error(refusal);
  };

  useUIComponent({
    id: 'checkout',
    name: 'Checkout',
    actions: [
      { id: 'payWithStripe', handler: () => payThroughBridge('stripe') },
      { id: 'payWithPaypal', handler: () => payThroughBridge('paypal') },
    ],
  });

  const total = cart.subtotal + (cart.count > 0 ? DELIVERY_FEE : 0);
  const contactGap = missingContact(name, phone, address);

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <ThemedText type="subtitle">Lieferdaten</ThemedText>

        <Field label="Name">
          <BridgeInput
            uiId="checkout-name"
            maxLength={MAX_LENGTH.name}
            uiLabel="Name"
            value={name}
            onChangeText={setName}
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
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="+49 …"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
          />
        </Field>
        <Field label="Adresse">
          <BridgeInput
            uiId="checkout-address"
            maxLength={MAX_LENGTH.address}
            uiLabel="Adresse"
            value={address}
            onChangeText={setAddress}
            placeholder="Straße, Hausnummer, Ort"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
          />
        </Field>

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
          <ThemedText type="small" style={{ color: theme.alertUndeclared }}>
            {error}
          </ThemedText>
        ) : null}
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
        <BridgeButton
          uiId="pay-stripe"
          uiLabel="Mit Karte bezahlen (Stripe)"
          disabled={!!busy || cart.count === 0 || contactGap !== null}
          style={[styles.payBtn, { backgroundColor: '#635bff', opacity: contactGap || (busy && busy !== 'stripe') ? 0.5 : 1 }]}
          onPress={() => pay('stripe')}>
          {busy === 'stripe' ? (
            <ActivityIndicator color={theme.onBrand} />
          ) : (
            <ThemedText type="smallBold" style={{ color: theme.onBrand }}>
              Mit Karte bezahlen (Stripe)
            </ThemedText>
          )}
        </BridgeButton>
        <BridgeButton
          uiId="pay-paypal"
          uiLabel="Mit PayPal bezahlen"
          disabled={!!busy || cart.count === 0 || contactGap !== null}
          style={[styles.payBtn, { backgroundColor: '#ffc439', opacity: contactGap || (busy && busy !== 'paypal') ? 0.5 : 1 }]}
          onPress={() => pay('paypal')}>
          {busy === 'paypal' ? (
            <ActivityIndicator color="#003087" />
          ) : (
            <ThemedText type="smallBold" style={{ color: '#003087' }}>
              Mit PayPal bezahlen
            </ThemedText>
          )}
        </BridgeButton>
      </SafeAreaView>
    </ThemedView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: Spacing.lg, gap: Spacing.lg, maxWidth: MaxContentWidth, width: '100%', alignSelf: 'center' },
  field: { gap: Spacing.xs },
  input: { borderWidth: 1, borderRadius: Radius.field, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, fontSize: 16 },
  footer: { padding: Spacing.lg, gap: Spacing.sm },
  contactGap: { textAlign: 'center' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.xs },
  payBtn: { padding: Spacing.lg, borderRadius: Radius.card, alignItems: 'center', minHeight: 52, justifyContent: 'center' },
});

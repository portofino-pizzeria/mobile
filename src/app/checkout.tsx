import { useUIComponent } from '@qontinui/ui-bridge-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
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

  async function pay(provider: PaymentProvider) {
    if (cart.count === 0 || busy) return;
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
        { name, phone, address },
      );
      const { url } = await api.startCheckout(order.id, provider);
      // Hosted checkout (Stripe Checkout / PayPal). Opens the platform browser;
      // resolves when the user returns. The order screen then polls for "paid".
      await WebBrowser.openBrowserAsync(url);
      cart.clear();
      router.replace(`/order/${order.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  useUIComponent({
    id: 'checkout',
    name: 'Checkout',
    actions: [
      { id: 'payWithStripe', handler: async () => pay('stripe') },
      { id: 'payWithPaypal', handler: async () => pay('paypal') },
    ],
  });

  const total = cart.subtotal + (cart.count > 0 ? DELIVERY_FEE : 0);

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <ThemedText type="subtitle">Lieferdaten</ThemedText>

        <Field label="Name">
          <BridgeInput
            uiId="checkout-name"
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
        <View style={styles.totalRow}>
          <ThemedText type="smallBold">Gesamt</ThemedText>
          <ThemedText type="price">{formatEUR(total)}</ThemedText>
        </View>
        <BridgeButton
          uiId="pay-stripe"
          uiLabel="Mit Karte bezahlen (Stripe)"
          disabled={!!busy || cart.count === 0}
          style={[styles.payBtn, { backgroundColor: '#635bff', opacity: busy && busy !== 'stripe' ? 0.5 : 1 }]}
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
          disabled={!!busy || cart.count === 0}
          style={[styles.payBtn, { backgroundColor: '#ffc439', opacity: busy && busy !== 'paypal' ? 0.5 : 1 }]}
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
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.xs },
  payBtn: { padding: Spacing.lg, borderRadius: Radius.card, alignItems: 'center', minHeight: 52, justifyContent: 'center' },
});

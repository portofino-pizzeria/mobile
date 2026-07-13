import { useUIComponent } from '@qontinui/ui-bridge-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BridgeButton, BridgeInput } from '@/components/bridge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
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
        cart.lines.map((l) => ({ menuItemId: l.item.id, quantity: l.quantity })),
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
        <ThemedText type="subtitle">Delivery details</ThemedText>

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
        <Field label="Phone">
          <BridgeInput
            uiId="checkout-phone"
            uiLabel="Phone"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="+49 …"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
          />
        </Field>
        <Field label="Address">
          <BridgeInput
            uiId="checkout-address"
            uiLabel="Address"
            value={address}
            onChangeText={setAddress}
            placeholder="Street, number, city"
            placeholderTextColor={theme.textSecondary}
            style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
          />
        </Field>

        {providers && (!providers.stripe || !providers.paypal) ? (
          <ThemedText type="small" themeColor="textSecondary">
            Note: {[!providers.stripe ? 'Stripe' : null, !providers.paypal ? 'PayPal' : null]
              .filter(Boolean)
              .join(' and ')}{' '}
            {(!providers.stripe && !providers.paypal) ? 'are' : 'is'} in mock mode (no API keys set) —
            checkout still completes for testing.
          </ThemedText>
        ) : null}

        {error ? (
          <ThemedText type="small" style={{ color: '#e5484d' }}>
            {error}
          </ThemedText>
        ) : null}
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.footer}>
        <View style={styles.totalRow}>
          <ThemedText type="smallBold">Total</ThemedText>
          <ThemedText type="smallBold">{formatEUR(total)}</ThemedText>
        </View>
        <BridgeButton
          uiId="pay-stripe"
          uiLabel="Pay with card (Stripe)"
          disabled={!!busy || cart.count === 0}
          style={[styles.payBtn, { backgroundColor: '#635bff', opacity: busy && busy !== 'stripe' ? 0.5 : 1 }]}
          onPress={() => pay('stripe')}>
          {busy === 'stripe' ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <ThemedText type="smallBold" style={{ color: '#fff' }}>
              Pay with card (Stripe)
            </ThemedText>
          )}
        </BridgeButton>
        <BridgeButton
          uiId="pay-paypal"
          uiLabel="Pay with PayPal"
          disabled={!!busy || cart.count === 0}
          style={[styles.payBtn, { backgroundColor: '#ffc439', opacity: busy && busy !== 'paypal' ? 0.5 : 1 }]}
          onPress={() => pay('paypal')}>
          {busy === 'paypal' ? (
            <ActivityIndicator color="#003087" />
          ) : (
            <ThemedText type="smallBold" style={{ color: '#003087' }}>
              Pay with PayPal
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
  scroll: { padding: Spacing.three, gap: Spacing.three, maxWidth: 800, width: '100%', alignSelf: 'center' },
  field: { gap: Spacing.one },
  input: { borderWidth: 1, borderRadius: Spacing.two, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, fontSize: 16 },
  footer: { padding: Spacing.three, gap: Spacing.two },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.one },
  payBtn: { padding: Spacing.three, borderRadius: Spacing.three, alignItems: 'center', minHeight: 52, justifyContent: 'center' },
});

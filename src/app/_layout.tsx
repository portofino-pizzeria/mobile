import { UIBridgeNativeProvider } from '@qontinui/ui-bridge-native';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useMemo } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { UI_BRIDGE_PORT } from '@/lib/config';
import { createTcpServerAdapter } from '@/lib/ui-bridge-server-adapter';
import { CartProvider } from '@/state/cart';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  // The control server runs only in native dev builds. `serverAdapter` binds the
  // HTTP surface to react-native-tcp-socket; web has no TCP server, so omit it.
  const serverAdapter = useMemo(
    () => (__DEV__ && Platform.OS !== 'web' ? createTcpServerAdapter() : undefined),
    [],
  );

  return (
    // UI Bridge wraps the whole app. In dev it starts an embedded control server
    // on UI_BRIDGE_PORT (8087) that the Qontinui runner connects to; in
    // production builds `server`/`debug` are off so nothing is exposed.
    <UIBridgeNativeProvider
      features={{ server: __DEV__, debug: __DEV__ }}
      config={{ serverPort: UI_BRIDGE_PORT }}
      serverAdapter={serverAdapter}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <CartProvider>
            <AnimatedSplashOverlay />
            <Stack>
              <Stack.Screen name="index" options={{ title: 'Portofino Pizzeria' }} />
              <Stack.Screen name="cart" options={{ title: 'Your Cart' }} />
              <Stack.Screen name="checkout" options={{ title: 'Checkout' }} />
              <Stack.Screen name="order/[id]" options={{ title: 'Your Order' }} />
            </Stack>
          </CartProvider>
        </ThemeProvider>
      </GestureHandlerRootView>
    </UIBridgeNativeProvider>
  );
}

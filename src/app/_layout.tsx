import { UIBridgeNativeProvider } from '@qontinui/ui-bridge-native';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useMemo } from 'react';
import { Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { UI_BRIDGE_PORT } from '@/lib/config';
import { createTcpServerAdapter } from '@/lib/ui-bridge-server-adapter';
import { createWindowServerAdapter } from '@/lib/ui-bridge-web-adapter';
import { CartProvider } from '@/state/cart';

export default function RootLayout() {
  const theme = useTheme();

  // Header chrome, per the v0 design's `.portofino-header`: a white bar with a
  // hairline under it (`border-b border-gray-200`) and ink serif titles. The
  // menu screen replaces the title with the gold wordmark.
  const headerScreenOptions = {
    headerStyle: { backgroundColor: theme.background },
    headerShadowVisible: true,
    headerTintColor: theme.text,
    headerTitleStyle: {
      fontFamily: Type.serif,
      fontSize: 20,
      color: theme.text,
    },
    contentStyle: { backgroundColor: theme.background },
  };

  // The control server runs only in dev builds. On native, `serverAdapter` binds
  // the HTTP surface to react-native-tcp-socket. Web has no TCP server, so there
  // the same request handler is published on `window.__uiBridgeNative` for a
  // headless browser to call (see README, "The server transport").
  const serverAdapter = useMemo(() => {
    if (!__DEV__) return undefined;
    return Platform.OS === 'web' ? createWindowServerAdapter() : createTcpServerAdapter();
  }, []);

  return (
    // UI Bridge wraps the whole app. In dev it starts an embedded control server
    // on UI_BRIDGE_PORT (8087) that the Qontinui runner connects to; in
    // production builds `server`/`debug` are off so nothing is exposed.
    <UIBridgeNativeProvider
      features={{ server: __DEV__, debug: __DEV__ }}
      config={{ serverPort: UI_BRIDGE_PORT }}
      serverAdapter={serverAdapter}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        {/* Light only: the design declares `color-scheme: light`. */}
        <ThemeProvider value={DefaultTheme}>
          <CartProvider>
            <AnimatedSplashOverlay />
            <Stack screenOptions={headerScreenOptions}>
              <Stack.Screen name="index" options={{ title: 'Portofino Pizzeria' }} />
              <Stack.Screen name="cart" options={{ title: 'Warenkorb' }} />
              <Stack.Screen name="checkout" options={{ title: 'Kasse' }} />
              <Stack.Screen name="order/[id]" options={{ title: 'Deine Bestellung' }} />
              <Stack.Screen name="kitchen" options={{ title: 'Küche' }} />
              <Stack.Screen name="impressum" options={{ title: 'Impressum' }} />
              <Stack.Screen name="datenschutz" options={{ title: 'Datenschutz' }} />
              <Stack.Screen name="admin/index" options={{ title: 'Verwaltung' }} />
              <Stack.Screen name="admin/restaurant" options={{ title: 'Restaurant & Öffnungszeiten' }} />
              <Stack.Screen name="admin/privacy" options={{ title: 'Datenauskunft / Löschung' }} />
              <Stack.Screen name="admin/item/[id]" options={{ title: 'Gericht' }} />
              <Stack.Screen name="admin/allergene" options={{ title: 'Allergene' }} />
            </Stack>
          </CartProvider>
        </ThemeProvider>
      </GestureHandlerRootView>
    </UIBridgeNativeProvider>
  );
}

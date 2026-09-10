import { UIBridgeNativeProvider } from '@qontinui/ui-bridge-native';
import { Jost_400Regular, Jost_500Medium, Jost_600SemiBold } from '@expo-google-fonts/jost';
import { LeagueGothic_400Regular } from '@expo-google-fonts/league-gothic';
import { Oswald_600SemiBold } from '@expo-google-fonts/oswald';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useMemo } from 'react';
import { Platform, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { UI_BRIDGE_PORT } from '@/lib/config';
import { createTcpServerAdapter } from '@/lib/ui-bridge-server-adapter';
import { CartProvider } from '@/state/cart';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const theme = useTheme();

  // Header chrome, per `domain_spec/visual-system`: the page ground, with a
  // brand-red title. The red is a foreground colour here, not a bar fill —
  // "It is the colour of headings and prices, not primarily of buttons and
  // bars."
  //
  // Read from the THEME, never from `Brand` directly: pinning
  // `backgroundColor` to the literal white put a white header bar over a black
  // screen body on every route in dark mode.
  const headerScreenOptions = {
    headerStyle: { backgroundColor: theme.background },
    headerTintColor: theme.brand,
    headerTitleStyle: {
      fontFamily: Type.displayBold,
      fontSize: 20,
      color: theme.brand,
    },
  };

  // The declared faces.
  const [, fontError] = useFonts({
    LeagueGothic_400Regular,
    Oswald_600SemiBold,
    Jost_400Regular,
    Jost_500Medium,
    Jost_600SemiBold,
  });
  // Not gated on — an unloaded family falls back to the platform face, which
  // is worse-looking but never blank, so the app renders rather than holding a
  // splash on a font fetch. But a failure that is never surfaced is a silent
  // downgrade to the exact template look this change removed, so say so in dev.
  if (__DEV__ && fontError) {
    console.warn('[theme] a declared font failed to load:', fontError);
  }

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
            <Stack screenOptions={headerScreenOptions}>
              <Stack.Screen name="index" options={{ title: 'Portofino Pizzeria' }} />
              <Stack.Screen name="cart" options={{ title: 'Warenkorb' }} />
              <Stack.Screen name="checkout" options={{ title: 'Kasse' }} />
              <Stack.Screen name="order/[id]" options={{ title: 'Deine Bestellung' }} />
              <Stack.Screen name="kitchen" options={{ title: 'Küche' }} />
              <Stack.Screen name="admin/index" options={{ title: 'Speisekarte bearbeiten' }} />
              <Stack.Screen name="admin/item/[id]" options={{ title: 'Gericht' }} />
              <Stack.Screen name="admin/allergene" options={{ title: 'Allergene' }} />
            </Stack>
          </CartProvider>
        </ThemeProvider>
      </GestureHandlerRootView>
    </UIBridgeNativeProvider>
  );
}
